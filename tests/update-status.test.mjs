import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectSource} from '../scripts/update-market-data.mjs';
import {sourceStatus} from '../dist/update-status.js';
test('Partial write failure restores the entire source; next source and recovery still succeed',async()=>{
 const root=await mkdtemp(join(tmpdir(),'market-update-test-'));
 try{
  for(const key of ['fred','worldbank']){
   await mkdir(join(root,'data',key),{recursive:true});await mkdir(join(root,'dist/data'),{recursive:true});
   await writeFile(join(root,`data/${key}.json`),JSON.stringify({updatedAt:'2026-10-01T00:00:00Z',rows:[1]}));
   await writeFile(join(root,`dist/data/${key}.json`),'old public');await writeFile(join(root,`data/${key}/raw.json`),'old raw');
  }
  const failed=await collectSource({root,key:'worldbank',previous:{lastSuccessAt:'2026-10-02T00:00:00Z'},now:'2026-11-08T00:00:00Z',validate:async()=>{},run:async()=>{
   await writeFile(join(root,'data/worldbank.json'),'broken');await writeFile(join(root,'dist/data/worldbank.json'),'partial');await writeFile(join(root,'data/worldbank/new.json'),'partial');throw Error('403 api_key=SECRET');
  }});
  assert.equal(failed.state,'failed');assert.equal(failed.lastSuccessAt,'2026-10-02T00:00:00Z');assert.equal(failed.usingPreviousData,true);
  assert.equal(await readFile(join(root,'dist/data/worldbank.json'),'utf8'),'old public');assert.equal(await readFile(join(root,'data/worldbank/raw.json'),'utf8'),'old raw');await assert.rejects(readFile(join(root,'data/worldbank/new.json')));
  assert.deepEqual(JSON.parse(await readFile(join(root,'data/worldbank.json'),'utf8')).rows,[1]);assert.doesNotMatch(JSON.stringify(failed),/SECRET|api_key/);
  const success=await collectSource({root,key:'fred',run:async()=>{},validate:async()=>{},now:'2026-11-08T00:00:00Z'});assert.equal(success.state,'success');
  const recovered=await collectSource({root,key:'worldbank',previous:failed,run:async()=>{},validate:async()=>{},now:'2026-11-09T00:00:00Z'});assert.equal(recovered.lastSuccessAt,'2026-11-09T00:00:00Z');assert.equal(recovered.error,null);
  const warning=sourceStatus({sources:{worldbank:failed}},'worldbank');assert.match(warning,/갱신 실패 · 이전 데이터 표시 중/);assert.match(warning,/마지막 수집 성공/);
  assert.doesNotMatch(sourceStatus({sources:{worldbank:recovered}},'worldbank'),/갱신 실패/);assert.match(sourceStatus(null,'fred'),/확인할 수 없습니다/);
 }finally{await rm(root,{recursive:true,force:true});}
});
