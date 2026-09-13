import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monthlyStats,commonLatest,monthLabel,industryReading} from '../dist/kosis-stats.js';
import {normalizeRows,mergeRows,selectIndustry,parseValue} from '../scripts/kosis-data.mjs';
import {renderKosis,monthlyPlot} from '../dist/kosis.js';
test('KOSIS uses calendar months, complete MA12 and three-month YoY windows',()=>{
  const rows=Array.from({length:15},(_,i)=>({month:monthLabel(2024*12+i),value:i<12?100:120}));
  const stats=monthlyStats(rows);
  assert.equal(stats[10].ma12,null);assert.equal(stats[11].ma12,100);
  assert.ok(Math.abs(stats[12].yoy-20)<1e-8);assert.equal(stats[13].yoy3,null);
  assert.ok(Math.abs(stats[14].yoy3-20)<1e-8);
  const missing=monthlyStats(rows.filter(r=>r.month!=='2024-02'));
  assert.equal(missing[11].ma12,null);assert.equal(missing[13].yoy,null);assert.equal(missing[14].yoy3,null);
});
test('KOSIS archive retains older months while official revisions replace overlaps',()=>{
  const older=Array.from({length:14},(_,i)=>({month:monthLabel(2024*12+i),value:100}));
  const fresh=older.slice(2).map(r=>({...r,value:110}));fresh.push({month:'2025-03',value:120});
  const result=mergeRows(older,fresh);
  assert.equal(result.length,15);assert.equal(result[0].value,100);assert.equal(result[2].value,110);assert.equal(result.at(-1).value,120);
  assert.deepEqual(mergeRows(result,fresh),result);
});
test('KOSIS rejects rebased, duplicate and misclassified observations',()=>{
  const setting={id:'test',orgId:'101',tblId:'DT_1F02001',itmId:'T10',objL1:'00',objL2:'C261',itemName:'생산지수(원지수)'};
  const r={ORG_ID:'101',TBL_ID:setting.tblId,ITM_ID:'T10',C1:'00',C2:'C261',ITM_NM:setting.itemName,UNIT_NM:'2020＝100',PRD_SE:'M',PRD_DE:'202601',DT:'100'};
  assert.equal(normalizeRows([r],setting,'2020=100')[0].value,100);
  assert.throws(()=>normalizeRows([{...r,UNIT_NM:'2025=100'}],setting,'2020=100'));
  assert.throws(()=>normalizeRows([r,r],setting,'2020=100'));
  assert.throws(()=>normalizeRows([{...r,C2:'C999'}],setting,'2020=100'));
  assert.equal(parseValue('-'),null);assert.throws(()=>parseValue('100abc'));
});
test('comparisons use a shared month and industry selection must be unambiguous',()=>{
  assert.equal(commonLatest([{rows:[{month:'2026-06'},{month:'2026-07'}]},{rows:[{month:'2026-06'}]}]),'2026-06');
  assert.equal(selectIndustry([{C2:'C261',C2_NM:'반도체 제조업'}],{id:'semi',match:'^반도체제조업$'}).objL2,'C261');
  assert.throws(()=>selectIndustry([{C2:'A',C2_NM:'반도체 제조업'},{C2:'B',C2_NM:'반도체 제조업'}],{id:'semi',match:'^반도체제조업$'}));
  assert.match(industryReading(null,10),/부족/);
});
test('stored official KOSIS observations reproduce public data and 17 series',()=>{
  const data=JSON.parse(readFileSync('data/kosis.json','utf8'));
  assert.deepEqual(JSON.parse(readFileSync('dist/data/kosis.json','utf8')),data);
  assert.equal(data.series.length,17);assert.equal(new Set(data.series.map(s=>s.id)).size,17);
  for(const s of data.series){
    const raw=JSON.parse(readFileSync(`data/kosis/raw/${s.id}.json`,'utf8'));
    assert.deepEqual(normalizeRows(raw,{...s.selection,id:s.id,itemName:s.itemName},data.basis),s.rows);
    assert.equal(s.rows[0].month,'2015-01');assert.ok(s.rows.length>=139);
  }
  const html=renderKosis(data,'all');assert.match(html,/수출액과 물량/);assert.equal((html.match(/data-industry=/g)||[]).length,5);
  assert.doesNotMatch(html,/NaN|Infinity|undefined/);
  assert.doesNotMatch(JSON.stringify(data),/apiKey|KOSIS_API_KEY/);
});
test('monthly charts break across missing months instead of inventing a connecting line',()=>{
  const html=monthlyPlot([{index:24000,value:1},{index:24002,value:2}],[{key:'value',color:'blue'}],'test');
  assert.match(html,/d="M[^"L]*M/);
});
