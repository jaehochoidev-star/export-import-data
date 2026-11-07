import {readFile,writeFile,mkdir,mkdtemp,cp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {normalizeFred,spreadCheck} from './fred-data.mjs';

async function exists(path){try{await access(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
const json=async path=>JSON.parse(await readFile(path,'utf8'));
export async function collectSource({root,key,previous={},run,validate,now=new Date().toISOString()}){
  if(!['fred','worldbank'].includes(key)||resolve(root)!==root)throw Error('Invalid archive root or source');
  const paths=[`data/${key}.json`,`data/${key}`,`dist/data/${key}.json`];
  const backup=await mkdtemp(join(tmpdir(),'trade-source-'));
  const present=[];
  try{
    for(let i=0;i<paths.length;i++){present[i]=await exists(join(root,paths[i]));if(present[i])await cp(join(root,paths[i]),join(backup,String(i)),{recursive:true});}
    try{
      await run();await validate();
      const data=await json(join(root,paths[0]));
      return {state:'success',lastAttemptAt:now,lastSuccessAt:now,lastDataUpdatedAt:data.updatedAt,error:null};
    }catch{
      // Restore every source file, including partially written raw/public files.
      for(let i=0;i<paths.length;i++){
        const target=join(root,paths[i]);
        await rm(target,{recursive:true,force:true});
        if(present[i])await cp(join(backup,String(i)),target,{recursive:true});
      }
      const data=present[0]?await json(join(root,paths[0])):null;
      return {state:'failed',lastAttemptAt:now,lastSuccessAt:previous.lastSuccessAt||null,lastDataUpdatedAt:data?.updatedAt||null,error:'collection_or_validation_failed',usingPreviousData:!!data};
    }
  }finally{await rm(backup,{recursive:true,force:true});}
}
function command(executable,args){return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{stdio:'inherit',env:process.env});
  child.on('error',()=>reject(Error('Collection process unavailable')));
  child.on('exit',code=>code===0?resolve():reject(Error('Collection process failed')));
});}
async function validateSource(key){
  const data=await json(`data/${key}.json`),publicData=await json(`dist/data/${key}.json`);
  const ids=key==='fred'?(await json('config/fred.json')).series.filter(s=>s.enabled!==false).map(s=>s.id):['WB_SILVER'];
  if(data.status!=='live'||JSON.stringify(data)!==JSON.stringify(publicData)||JSON.stringify(data.series.map(s=>s.id))!==JSON.stringify(ids))throw Error('Invalid source archive');
  for(const series of data.series){
    if(!series.rows.length||new Set(series.rows.map(r=>r.date)).size!==series.rows.length||!series.rows.some(r=>Number.isFinite(r.value)))throw Error('Invalid observations');
    for(const r of series.rows)if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||(r.value!==null&&!Number.isFinite(r.value)))throw Error('Invalid observation');
    if(key==='fred'){
      const raw=await json(`data/fred/raw/${series.id}.json`);
      if(JSON.stringify(series.rows)!==JSON.stringify(normalizeFred(raw.observations)))throw Error('Raw archive mismatch');
    }
  }
  if(key==='fred'&&JSON.stringify(data.spreadCheck)!==JSON.stringify(spreadCheck(data.series)))throw Error('Spread validation failed');
}
export async function main(){
  const root=process.cwd();let previous={};
  if(await exists('data/update-status.json'))previous=await json('data/update-status.json');
  const sources={...previous.sources};
  for(const key of ['fred','worldbank']){
    sources[key]=await collectSource({root,key,previous:sources[key],validate:()=>validateSource(key),run:async()=>{
      if(key==='fred')await command(process.execPath,['scripts/fetch-fred.mjs']);
      else{
        if(process.env.WORLDBANK_PYTHON_READY==='failure')throw Error('Python setup failed');
        await command('python',['-m','pip','install','openpyxl==3.1.5']);
        await command('python',['scripts/fetch-worldbank.py']);
      }
    }});
    if(sources[key].state==='failed')console.log(`::warning::${key}: update failed; previous data retained. Continuing other sources.`);
  }
  const text=JSON.stringify({version:1,sources},null,2)+'\n';
  for(const path of ['data/update-status.json','dist/data/update-status.json']){await mkdir(join(path,'..'),{recursive:true});await writeFile(path,text);}
  if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,Object.entries(sources).map(([key,s])=>`- ${key}: ${s.state==='success'?'collection succeeded':'FAILED — previous data retained'}; attempted ${s.lastAttemptAt}; last successful collection ${s.lastSuccessAt||'not recorded'}\n`).join(''),{flag:'a'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
