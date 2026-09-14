import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeFred,mergeFred,spreadCheck,validateFredMetadata} from '../scripts/fred-data.mjs';
import {fredStats,cropFred} from '../dist/fred-stats.js';
import {fredPlot,renderFred} from '../dist/fred.js';
test('FRED retains historical dates, corrections, missing values and negative oil prices',()=>{
 const old=normalizeFred([{date:'2020-04-20',value:'-36.98'},{date:'2020-04-21',value:'8.91'}]);
 const revised=normalizeFred([{date:'2020-04-21',value:'.'},{date:'2020-04-22',value:'13.64'}]);
 assert.deepEqual(mergeFred(old,revised),[{date:'2020-04-20',value:-36.98},{date:'2020-04-21',value:null},{date:'2020-04-22',value:13.64}]);
 assert.deepEqual(mergeFred(mergeFred(old,revised),revised),mergeFred(old,revised));
 assert.throws(()=>normalizeFred([{date:'2024-02-30',value:'1'}]));
 assert.throws(()=>normalizeFred([{date:'2024-01-01',value:''}]));
});
test('FRED monthly statistics require actual calendar months and daily changes skip missing values',()=>{
 const rows=Array.from({length:13},(_,i)=>({date:new Date(Date.UTC(2024,i,1)).toISOString().slice(0,10),value:100+i}));
 const stats=fredStats({frequency:'M',rows});
 assert.ok(Math.abs(stats.at(-1).yoy-12)<1e-9);assert.equal(stats.at(-1).ma12,106.5);
 const missing=fredStats({frequency:'M',rows:rows.filter((_,i)=>i!==11)}).at(-1);
 assert.equal(missing.pct,null);assert.equal(missing.ma12,null);
 const daily=fredStats({frequency:'D',rows:[{date:'2024-01-01',value:-1},{date:'2024-01-02',value:null},{date:'2024-01-03',value:2}]}).at(-1);
 assert.equal(daily.change,3);assert.equal(daily.pct,null);assert.equal(daily.previousDate,'2024-01-01');
 assert.equal(cropFred(rows,'1').length,13);
});
test('Spread validation only compares matching observed dates and metadata changes fail closed',()=>{
 const series=[['DGS2',4],['DGS10',3.5],['T10Y2Y',-.5]].map(([id,value])=>({id,rows:[{date:'2024-01-01',value}]}));
 assert.equal(spreadCheck(series).latest.matches,true);
 series[2].rows[0].value=.5;assert.equal(spreadCheck(series).mismatches,1);
 series[1].rows[0].date='2024-01-02';assert.equal(spreadCheck(series).checked,0);
 assert.throws(()=>validateFredMetadata({id:'DGS2',frequency_short:'M',units:'Percent'},{id:'DGS2',frequency:'D',units:'Percent'}));
});
test('FRED plots expose grids, negative spread and missing gaps',()=>{
 const svg=fredPlot([{name:'spread',frequency:'D',color:'#123',rows:[{date:'2024-01-01',value:-1},{date:'2024-01-02',value:null},{date:'2024-01-03',value:1}]}],'spread',true);
 assert.match(svg,/<line/);assert.match(svg,/<rect/);assert.equal((svg.match(/d="M[^\"]*/)?.[0].match(/M/g)||[]).length,2);
 assert.doesNotMatch(svg,/NaN|Infinity/);
});
test('Official FRED archive matches public data and configured FRED series',async t=>{
 let data;try{data=JSON.parse(await readFile('data/fred.json','utf8'));}catch(e){if(e.code==='ENOENT'){t.skip('First API collection pending');return;}throw e;}
 const config=JSON.parse(await readFile('config/fred.json','utf8'));
 assert.deepEqual(data,JSON.parse(await readFile('dist/data/fred.json','utf8')));
 assert.ok(data.series.every(s=>config.series.some(c=>c.id===s.id)));
 for(const s of data.series){const raw=JSON.parse(await readFile('data/fred/raw/'+s.id+'.json','utf8'));assert.deepEqual(s.rows,normalizeFred(raw.observations));assert.ok(s.rows.length>200);}
 assert.deepEqual(data.spreadCheck,spreadCheck(data.series));
 const html=renderFred(data);assert.doesNotMatch(html,/NaN|undefined|Infinity|api_key/i);assert.match(html,/fred-range/);assert.match(html,/PCOPPUSDM/);
});
