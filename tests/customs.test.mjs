import test from 'node:test';
import assert from 'node:assert/strict';
import {seriesFor} from '../dist/customs.js';
import {signalSeries,signalBoard,classifySignal} from '../dist/customs-signals.js';
import {renderSignalBoard} from '../dist/customs.js';
import {readFile} from 'node:fs/promises';
test('Customs compares the same cumulative window, never a full month with ten days',()=>{
 const data={rows:[{month:'2025-09',window:10,values:{a:100}},{month:'2025-09',window:30,values:{a:400}},{month:'2026-09',window:10,values:{a:150}}]};
 assert.equal(seriesFor(data,'a',10).at(-1).yoy,50);
 assert.equal(seriesFor(data,'a',30).at(-1).yoy,null);
});
test('segments subtract cumulative amounts and require contiguous comparison windows',()=>{
 const rows=[];
 for(let year=2024;year<=2026;year++)for(let m=1;m<=12;m++)for(const w of [10,20,30])rows.push({month:`${year}-${String(m).padStart(2,'0')}`,window:w,values:{a:w*(year===2024?10:20)}});
 let series=signalSeries({rows},'a');
 assert.equal(series[1].value,100);assert.equal(series[36].yoy,100);
 assert.equal(series[71].ttm,7200);assert.equal(series[71].ttmYoy,100);
 const missing=rows.filter(r=>!(r.month==='2025-12'&&r.window===20));
 const last=signalSeries({rows:missing},'a').find(r=>r.month==='2025-12'&&r.window===30);
 assert.equal(last.value,null);assert.equal(last.momentum,null);assert.equal(last.ttm,null);
});
test('signal boundaries and unknown values are explicit',()=>{
 assert.equal(classifySignal(35,-16).label,'꼭지 의심');
 assert.equal(classifySignal(10,5).label,'가속 상승');
 assert.equal(classifySignal(10,-5).label,'상승 둔화');
 assert.equal(classifySignal(10,0).label,'상승 유지');
 assert.equal(classifySignal(-1,6).label,'반전 조짐');
 assert.equal(classifySignal(-6,0).label,'하락');
 assert.equal(classifySignal(1,8).label,'중립');
 assert.equal(classifySignal(null,8).label,'자료 부족');
});
test('official archive reproduces user signal board and semiconductor-excluded total',async()=>{
 const data=JSON.parse(await readFile('dist/data/customs.json','utf8')),board=signalBoard(data);
 assert.equal(board.length,12);
 for(let i=1;i<board.length;i++)assert.ok(board[i-1].latest.momentum>=board[i].latest.momentum);
 const total=board.find(p=>p.id==='itemUsdAmt00'),semi=board.find(p=>p.id==='itemUsdAmt01'),other=board.find(p=>p.id==='excluding-semiconductors');
 assert.ok(Math.abs(total.latest.ttm-semi.latest.ttm-other.latest.ttm)<1e-6);
 if(semi.latest.month==='2026-09'&&semi.latest.window===10){
  assert.equal(semi.latest.yoy.toFixed(1),'270.1');assert.equal(semi.latest.momentum.toFixed(1),'74.7');
  assert.equal(semi.latest.ttmYoy.toFixed(1),'129.2');assert.equal((semi.latest.ttm/100000).toFixed(1),'3642.3');
  assert.equal(board.find(p=>p.name==='선박').signal.label,'중립');
  assert.equal(board.find(p=>p.name==='자동차부품').signal.label,'반전 조짐');
 }
 const html=renderSignalBoard(board);
 assert.equal((html.match(/data-product=/g)||[]).length,12);
 assert.equal((html.match(/class="signal-spark"/g)||[]).length,12);
 assert.ok(!/NaN|undefined|Infinity/.test(html));
});
