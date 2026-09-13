import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculateSeries,classify,monthOffset,validateProducts} from '../dist/products.js';
import {renderDashboard,chart} from '../dist/render.js';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const fixture=()=>Array.from({length:16},(_,i)=>({month:monthOffset('2024-01',i),exports:i<12?100:100+(i-11)*10}));
test('12M MA, YoY, delta and three-month means use unrounded monthly values',()=>{
 const rows=calculateSeries(fixture()),last=rows.at(-1);
 close(last.yoy,40);close(last.delta,10);close(last.avgYoy,30);close(last.avgDelta,10);
 close(last.ma,1300/12);close(last.maGap,(140/(1300/12)-1)*100);
 assert.equal(rows[10].ma,null);close(rows[11].ma,100);
 assert.equal(rows[11].yoy,null);assert.equal(rows[14].avgDelta,null);
});
test('missing calendar month does not get substituted with another row',()=>{
 const rows=fixture().filter(r=>r.month!=='2025-03');
 const last=calculateSeries(rows).at(-1);
 close(last.yoy,40);assert.equal(last.ma,null);assert.equal(last.delta,null);
 assert.equal(last.avgYoy,null);assert.equal(last.avgDelta,null);
 assert.equal(monthOffset('2025-01',-1),'2024-12');
});
test('zero denominators are unavailable; zero growth is valid',()=>{
 const zeros=fixture().map(r=>({...r,exports:0}));
 const last=calculateSeries(zeros).at(-1);
 assert.equal(last.yoy,null);assert.equal(last.maGap,null);assert.equal(last.ma,0);
 assert.equal(classify(last).label,'자료 부족');
 const flat=calculateSeries(fixture().map(r=>({...r,exports:100}))).at(-1);
 assert.equal(flat.yoy,0);assert.equal(flat.avgDelta,0);assert.equal(classify(flat).label,'보합');
});
test('status boundaries and recovery are explicit',()=>{
 assert.equal(classify({yoy:100,avgYoy:100}).label,'초고성장');
 assert.equal(classify({yoy:99,avgYoy:100}).label,'고성장');
 assert.equal(classify({yoy:10,avgYoy:10}).label,'고성장');
 assert.equal(classify({yoy:5,avgYoy:-2}).label,'회복 전환');
 assert.equal(classify({yoy:-1,avgYoy:10}).label,'감소');
});
test('all 20 products render eight metrics, two graphs and source tables',async()=>{
 const data=JSON.parse(await readFile('dist/data/products.json','utf8'));
 assert.equal(validateProducts(data).length,20);
 const html=renderDashboard(data);
 assert.equal((html.match(/<article /g)||[]).length,20);
 assert.equal((html.match(/<dt>/g)||[]).length,160);
 assert.equal((html.match(/<svg /g)||[]).length,40);
 assert.equal((html.match(/<table>/g)||[]).length,20);
 assert.ok(!/NaN|undefined|Infinity/.test(html));
 assert.throws(()=>validateProducts({...data,products:data.products.slice(1)}));
});
test('chart breaks paths across calendar gaps and supplies empty state',()=>{
 const series=[{month:'2025-01',yoy:10},{month:'2025-03',yoy:20}];
 const svg=chart(series,[{key:'yoy',label:'YoY',color:'green'}],'test','%');
 const path=svg.match(/<path d="([^"]+)"/)[1];
 assert.equal((path.match(/M/g)||[]).length,2);
 assert.equal((path.match(/L/g)||[]).length,0);
 assert.match(chart([{month:'2025-01',yoy:null}],[{key:'yoy'}],'test','%'),/자료가 부족/);
});
test('chart includes archived months older than the latest 24 months',()=>{
 const rows=Array.from({length:36},(_,i)=>({month:monthOffset('2024-01',i),yoy:i}));
 const svg=chart(rows,[{key:'yoy',label:'YoY',color:'green'}],'test','%');
 assert.match(svg,/2024\.01/);assert.match(svg,/누적 36개월/);
 assert.equal((svg.match(/<circle /g)||[]).length,36);
});
test('official report values reproduce semiconductor indicators',async()=>{
 const data=JSON.parse(await readFile('dist/data/products.json','utf8'));
 assert.equal(data.mode,'live');assert.equal(data.source,'ministry-report');
 const product=data.products.find(p=>p.id==='semiconductors');
 const row=calculateSeries(product.rows).find(r=>r.month==='2026-08');
 if(row && data.report.lastMonth==='2026-08'){
  close(row.exports,466.52);close(row.yoy,209);close(row.delta,30.2);
  close(row.ma,291.98);close(row.avgYoy,195.76666666666665);close(row.avgDelta,13.2);
 }
 for(const p of data.products)for(const r of p.rows){
  assert.ok(['ministry-report','historical-archive'].includes(r.sourceId));
  if(r.sourceId==='historical-archive')assert.ok(r.month<'2025-08');
  assert.ok(r.month<=data.report.lastMonth);
 }
 assert.equal(data.historySource,undefined);
});
