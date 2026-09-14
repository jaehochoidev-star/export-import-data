import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {normalizeFred,mergeFred,validateFredMetadata,spreadCheck} from './fred-data.mjs';
const apiKey=process.env.FRED_API_KEY?.trim();
if(!apiKey)throw Error('Register FRED_API_KEY as a repository Actions secret.');
const config=JSON.parse(await readFile('config/fred.json','utf8'));
let previous={series:[]};try{previous=JSON.parse(await readFile('data/fred.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(endpoint,id,params={}){
  const url=new URL('https://api.stlouisfed.org/fred/'+endpoint);
  for(const [k,v] of Object.entries({series_id:id,api_key:apiKey,file_type:'json',...params}))url.searchParams.set(k,v);
  for(let attempt=0;attempt<4;attempt++){
    await sleep([500,5000,15000,60000][attempt]);
    let code='NETWORK_TIMEOUT',retry=true;
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(60000),redirect:'error'});
      code='HTTP_'+response.status;retry=[408,429,500,502,503,504].includes(response.status);
      if(response.ok){
        const data=await response.json();
        if(!data.error_code)return data;
        code='API_ERROR';retry=false;
      }
    }catch{code='NETWORK_OR_RESPONSE_ERROR';retry=true;}
    // Neither request URLs nor response bodies or underlying exceptions may reach logs.
    console.log(`${id} ${endpoint}: ${code}, attempt ${attempt+1}/4`);
    if(!retry||attempt===3)throw Error(`${id}: ${code}. Existing FRED archive was not changed.`);
  }
}
const series=[],files=[];
for(const setting of config.series.filter(s=>s.enabled!==false)){
  const metadata=await request('series',setting.id),meta=metadata.seriess?.[0];
  validateFredMetadata(meta,setting);
  const result=await request('series/observations',setting.id,{observation_start:config.startDate,limit:100000,sort_order:'asc'});
  if(!result.observations?.length||Number(result.count)!==result.observations.length)throw Error(setting.id+': incomplete FRED response');
  const incoming=normalizeFred(result.observations);
  if(!incoming.some(r=>r.value!==null))throw Error(setting.id+': no valid FRED observations');
  const old=previous.series.find(s=>s.id===setting.id);
  if(old&&(old.units!==setting.units||old.frequency!==setting.frequency))throw Error(setting.id+': historical series definition changed');
  series.push({...setting,title:meta.title,sourceUrl:'https://fred.stlouisfed.org/series/'+setting.id,rows:mergeFred(old?.rows||[],incoming)});
  const path='data/fred/raw/'+setting.id+'.json';let older=[];
  try{older=JSON.parse(await readFile(path,'utf8')).observations;}catch(e){if(e.code!=='ENOENT')throw e;}
  // FRED's realtime query dates change each day even when values do not.
  // Keep each unchanged observation's original response, recording revisions only.
  const oldRaw=new Map(older.map(r=>[r.date,r]));
  const observations=mergeFred(older,result.observations.map(r=>oldRaw.get(r.date)?.value===r.value?oldRaw.get(r.date):r));
  const {realtime_start,realtime_end,...definition}=meta;
  files.push([path,JSON.stringify({metadata:definition,observations},null,2)+'\n']);
  console.log(`${setting.id}: ${incoming[0].date} to ${incoming.at(-1).date}, ${incoming.length} observations`);
}
const changed=JSON.stringify(series)!==JSON.stringify(previous.series);
const data={version:1,status:'live',updatedAt:changed?new Date().toISOString():previous.updatedAt,spreadCheck:spreadCheck(series),series};
const content=JSON.stringify(data,null,2)+'\n';
files.push(['data/fred.json',content],['dist/data/fred.json',content]);
// Validate every requested series before changing any archive.
await mkdir('data/fred/raw',{recursive:true});await mkdir('dist/data',{recursive:true});
for(const [path,text] of files){await writeFile(path+'.tmp',text);await rename(path+'.tmp',path);}
console.log(changed?'FRED cumulative archive updated.':'No observation changes; existing FRED archive retained.');
