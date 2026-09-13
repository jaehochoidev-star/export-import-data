import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {normalizeRows,mergeRows,selectIndustry} from './kosis-data.mjs';
const key=process.env.KOSIS_API_KEY;
if(!key)throw Error('Register KOSIS_API_KEY as a repository Actions secret.');
const config=JSON.parse(await readFile('config/kosis.json','utf8'));
const file='data/kosis.json';
let previous={series:[]};try{previous=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(previous.basis&&previous.basis!==config.basis)throw Error('Review changed index basis before merging.');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(params){
  const url=new URL('https://kosis.kr/openapi/Param/statisticsParameterData.do');
  for(const [k,v] of Object.entries({method:'getList',format:'json',jsonVD:'Y',prdSe:'M',...params,apiKey:key}))url.searchParams.set(k,v);
  for(let attempt=0;attempt<3;attempt++){
    await pause(2500*(attempt+1));
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(60000),redirect:'error'});
      if(!response.ok)throw Error('HTTP');
      const rows=await response.json();
      if(!Array.isArray(rows)||!rows.length)throw Error('No rows');
      return rows;
    }catch{/* Never log URLs or exception causes containing a credential. */}
  }
  throw Error('KOSIS API request failed for '+params.tblId+'. Check credential and query configuration.');
}
const discovery=await request({...config.industryTable,itmId:'T10',objL2:'ALL',newEstPrdCnt:'1'});
console.log('Available industry labels:',[...new Set(discovery.map(r=>r.C2_NM))].filter(n=>/반도체|자동차|화학|철강|석유/.test(n)).join(' / '));
const industrySettings=config.industries.map(i=>({...i,...selectIndustry(discovery,i)}));
const settings=[...config.trade.map(s=>({...s,group:'trade',officialName:'총지수'})),...industrySettings.flatMap(i=>config.metrics.map(m=>({...config.industryTable,...m,id:i.id+'-'+m.id,name:i.name,industryId:i.id,metric:m.id,group:'industry',objL2:i.objL2,officialName:i.officialName})))];
const end=new Date().toISOString().slice(0,7).replace('-','');
const series=[],rawFiles=[];
for(const setting of settings){
  const {orgId,tblId,itmId,objL1,objL2}=setting;
  const selection={orgId,tblId,itmId,objL1,...(objL2?{objL2}:{})};
  const raw=await request({...selection,startPrdDe:config.startMonth,endPrdDe:end});
  const rows=normalizeRows(raw,setting,config.basis);
  const old=previous.series.find(s=>s.id===setting.id);
  if(old&&(old.officialName!==setting.officialName||JSON.stringify(old.selection)!==JSON.stringify(selection)))throw Error('Series classification changed: '+setting.id);
  series.push({id:setting.id,name:setting.name,group:setting.group,...(setting.industryId?{industryId:setting.industryId,metric:setting.metric}:{}),officialName:setting.officialName,selection,tableName:raw[0].TBL_NM,itemName:raw[0].ITM_NM,unit:raw[0].UNIT_NM,sourceUrl:`https://kosis.kr/statHtml/statHtml.do?orgId=${orgId}&tblId=${tblId}`,rows:mergeRows(old?.rows||[],rows)});
  const rawPath=`data/kosis/raw/${setting.id}.json`;
  let older=[];try{older=JSON.parse(await readFile(rawPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const merged=[...new Map([...older,...raw].map(r=>[r.PRD_DE,r])).values()].sort((a,b)=>a.PRD_DE.localeCompare(b.PRD_DE));
  rawFiles.push([rawPath,JSON.stringify(merged,null,2)+'\n']);
  console.log(setting.id+': '+rows[0].month+' to '+rows.at(-1).month+' ('+rows.length+' months)');
}
const changed=JSON.stringify(series)!==JSON.stringify(previous.series);
const data={version:1,status:'live',basis:config.basis,updatedAt:changed?new Date().toISOString():previous.updatedAt,series};
await mkdir('data/kosis/raw',{recursive:true});await mkdir('dist/data',{recursive:true});
// Write only after every selected series validates. API errors leave all archives intact.
for(const [path,content] of [...rawFiles,[file,JSON.stringify(data,null,2)+'\n'],['dist/data/kosis.json',JSON.stringify(data,null,2)+'\n']]){
  await writeFile(path+'.tmp',content);await rename(path+'.tmp',path);
}
console.log(changed?'KOSIS archive updated.':'No observation changes; existing archive retained.');
