import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {yoy,validateRows} from '../dist/stats.js';
test('YoY uses the same calendar month, not the previous row',()=>{
 const rows=[{month:'2024-01',exports:100},{month:'2024-12',exports:160},{month:'2025-01',exports:120}];
 assert.ok(Math.abs(yoy(rows,rows[2],'exports')-20)<1e-9);
 assert.equal(yoy(rows,rows[1],'exports'),null);
 assert.equal(yoy([{month:'2024-01',exports:0}],rows[2],'exports'),null);
});
test('invalid and duplicate rows are rejected',()=>{
 assert.throws(()=>validateRows([{month:'2025-13',exports:1,imports:2}]));
 assert.throws(()=>validateRows([{month:'2025-01',exports:null,imports:2}]));
 const row={month:'2025-01',exports:1,imports:2};
 assert.throws(()=>validateRows([row,row]));
});
test('bundled dataset is labelled and valid',async()=>{
 const data=JSON.parse(await readFile('dist/data/trade.json','utf8'));
 assert.ok(['sample','live'].includes(data.mode));
 assert.ok(validateRows(data.rows).length > 0);
});
