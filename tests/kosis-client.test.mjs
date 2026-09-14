import test from 'node:test';
import assert from 'node:assert/strict';
import {createKosisClient,parseResponse} from '../scripts/kosis-client.mjs';
const params={orgId:'101',tblId:'DT_1F02001'};
test('network timeout retries, logs safe cause, and never logs secrets or URLs',async()=>{
  const waits=[],logs=[];let attempts=0;
  const request=createKosisClient({apiKey:'PRIVATE_KEY',sleep:async ms=>waits.push(ms),log:s=>logs.push(s),fetchImpl:async()=>{
    attempts++;
    if(attempts===1)throw new TypeError('fetch failed https://kosis.kr/?apiKey=PRIVATE_KEY',{cause:{code:'UND_ERR_CONNECT_TIMEOUT',message:'PRIVATE_KEY'}});
    return new Response('[{"DT":"100"}]');
  }});
  assert.deepEqual(await request(params),[{DT:'100'}]);assert.deepEqual(waits,[2500,10000]);
  assert.match(logs.join(),/UND_ERR_CONNECT_TIMEOUT/);assert.doesNotMatch(logs.join(),/PRIVATE_KEY|https:/);
});
test('expired credentials fail immediately while KOSIS server errors retry',async()=>{
  let count=0;const logs=[];
  const request=createKosisClient({apiKey:'PRIVATE_KEY',sleep:async()=>{},log:s=>logs.push(s),fetchImpl:async()=>{count++;return new Response('{"err":"11","errMsg":"PRIVATE_KEY"}');}});
  await assert.rejects(request(params),/API_11/);assert.equal(count,1);assert.doesNotMatch(logs.join(),/PRIVATE_KEY/);
  assert.equal(parseResponse('{"err":"50"}',200).error.retryable,true);
  assert.equal(parseResponse('<error><err>21</err></error>',200).error.retryable,false);
  assert.equal(parseResponse('[]',200).error.code,'EMPTY_DATA');
});
test('rate limit respects Retry-After and eventually succeeds',async()=>{
  let count=0;const waits=[];
  const request=createKosisClient({apiKey:'key',sleep:async ms=>waits.push(ms),log:()=>{},fetchImpl:async()=>++count===1?new Response('limited',{status:429,headers:{'Retry-After':'60'}}):new Response('[{}]')});
  await request(params);assert.deepEqual(waits,[2500,60000]);
});
test('persistent outage stops after five attempts with actionable safe error',async()=>{
  let count=0;
  const request=createKosisClient({apiKey:'key',sleep:async()=>{},log:()=>{},fetchImpl:async()=>{count++;return new Response('private diagnostic',{status:503});}});
  await assert.rejects(request(params),/HTTP_503.*Stored observations were not changed/);assert.equal(count,5);
});
