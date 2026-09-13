import test from 'node:test';
import assert from 'node:assert/strict';
import {seriesFor} from '../dist/customs.js';
test('Customs compares the same cumulative window, never a full month with ten days',()=>{
 const data={rows:[{month:'2025-09',window:10,values:{a:100}},{month:'2025-09',window:30,values:{a:400}},{month:'2026-09',window:10,values:{a:150}}]};
 assert.equal(seriesFor(data,'a',10).at(-1).yoy,50);
 assert.equal(seriesFor(data,'a',30).at(-1).yoy,null);
});
