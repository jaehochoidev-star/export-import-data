import {validateProducts} from './products.js';
import {renderDashboard} from './render.js';
const $=id=>document.getElementById(id);
try {
 const response=await fetch('./data/products.json');
 if(!response.ok)throw new Error('데이터 파일을 불러올 수 없습니다.');
 const data=await response.json(),products=validateProducts(data);
 $('products').innerHTML=renderDashboard(data);
 $('product-nav').innerHTML=products.map(p=>`<a href="#${p.id}">${p.name}</a>`).join('');
 const months=[...new Set(products.map(p=>p.rows.at(-1).month))].sort();
 $('period').textContent=months.length===1?`최신월 ${months[0].replace('-','.')} · 20개 품목`:'20개 품목 · 최신월은 품목별로 확인';
 $('notice').textContent=data.mode==='sample'?'가상 예시 데이터 · 아래 수치·그래프·상태 분류는 화면 확인용이며 실제 수출 통계가 아닙니다.':'산업통상부 수출입동향 · 공식 PDF에서 직접 수집한 월별 자료입니다. 잠정치 및 수정치가 포함됩니다.';
 $('source').textContent=data.mode==='sample'?'화면 확인용 가상 데이터 · KOSIS 연결 전':`출처: 산업통상부 · 수집: ${data.updatedAt?.slice(0,10) || '확인 필요'}`;
} catch(error) { $('products').replaceChildren();$('product-nav').replaceChildren();$('notice').textContent=`데이터를 표시할 수 없습니다. ${error.message}`; }
