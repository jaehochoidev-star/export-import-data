const number=v=>v==null?'—':v.toLocaleString('ko-KR',{maximumFractionDigits:1});
const rate=v=>v==null?'—':`${v>0?'+':''}${number(v)}%`;
const period={10:'1~10일',20:'1~20일',30:'월 전체'};
export function seriesFor(data,product,window){
 const rows=data.rows.filter(r=>r.window===Number(window)).sort((a,b)=>a.month.localeCompare(b.month));
 const values=new Map(rows.map(r=>[r.month,r.values[product]]));
 return rows.map(r=>{const value=r.values[product],previous=values.get(`${Number(r.month.slice(0,4))-1}${r.month.slice(4)}`);return {...r,value,yoy:previous>0?(value/previous-1)*100:null};});
}
function plot(rows,key,label){
 const vals=rows.map(r=>r[key]).filter(Number.isFinite);
 if(!vals.length)return '<p>전년 같은 기간의 자료가 쌓이면 성장률 그래프가 표시됩니다.</p>';
 const min=Math.min(0,...vals),max=Math.max(1,...vals),x=i=>55+i*660/Math.max(rows.length-1,1),y=v=>195-(v-min)/(max-min)*160;
 let path='',previous=null;
 rows.forEach((r,i)=>{if(!Number.isFinite(r[key])){previous=null;return;}const serial=Number(r.month.slice(0,4))*12+Number(r.month.slice(5));path+=(previous===serial-1?'L':'M')+x(i)+','+y(r[key]);previous=serial;});
 return `<svg class="customs-plot" viewBox="0 0 750 230" role="img" aria-label="${label}"><title>${label}</title><path d="M55 35V195H720" stroke="#cbd5e1" fill="none"/><text x="0" y="40">${number(max)}</text><text x="0" y="195">${number(min)}</text><path d="${path}" stroke="#168b78" stroke-width="3" fill="none"/>${rows.map((r,i)=>Number.isFinite(r[key])?`<circle cx="${x(i)}" cy="${y(r[key])}" r="3" fill="#168b78"><title>${r.month}: ${number(r[key])}</title></circle>`:'').join('')}<text x="55" y="222">${rows[0]?.month||''}</text><text x="650" y="222">${rows.at(-1)?.month||''}</text></svg>`;
}
export async function mountCustoms(root){
 try{
  const response=await fetch('./data/customs.json');if(!response.ok)throw Error('데이터를 불러오지 못했습니다.');
  const data=await response.json();
  if(data.status!=='live'||!data.rows.length){root.innerHTML='<div class="panel"><h2>관세청 자료 연결 준비 중</h2><p>공식 API 인증이 완료되면 주요 10대 품목의 누적 수출액과 전년 동기 대비 그래프가 이곳에 표시됩니다.</p></div>';return;}
  root.innerHTML='<div class="customs-controls"><label>수출품목<select id="customs-product"></select></label><label>비교 기간<select id="customs-window"><option value="10">1~10일</option><option value="20">1~20일</option><option value="30">월 전체</option></select></label></div><div id="customs-detail"></div>';
  const select=root.querySelector('#customs-product');
  for(const p of data.products){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}
  const windowSelect=root.querySelector('#customs-window');
  function render(){
   const rows=seriesFor(data,select.value,windowSelect.value),last=rows.at(-1),detail=root.querySelector('#customs-detail');
   if(!last){detail.textContent='선택한 기간의 자료가 없습니다.';return;}
   detail.innerHTML=`<div class="panel"><div class="customs-summary"><div>최신 기준월<strong>${last.month}</strong>${period[last.window]}</div><div>누적 수출액<strong>${number(last.value/100000)}억 달러</strong></div><div>전년 같은 기간 대비<strong>${rate(last.yoy)}</strong></div></div><h2>누적 수출액 · 억 달러</h2>${plot(rows.slice(-36).map(r=>({...r,value:r.value/100000})),'value','누적 수출액')}<h2>전년 같은 기간 대비 · %</h2>${plot(rows.slice(-36),'yoy','누적 YoY')}<details class="raw-data"><summary>월별 원자료</summary><div class="table-wrap"><table><thead><tr><th>기준월</th><th>기간</th><th>누적 수출액 (억 달러)</th><th>YoY</th></tr></thead><tbody>${[...rows].reverse().map(r=>`<tr><td>${r.month}</td><td>${period[r.window]}</td><td>${number(r.value/100000)}</td><td>${rate(r.yoy)}</td></tr>`).join('')}</tbody></table></div></details></div>`;
  }
  select.addEventListener('change',render);windowSelect.addEventListener('change',render);render();
 }catch(error){root.textContent=error.message;}
}
