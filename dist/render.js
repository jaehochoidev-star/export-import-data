import {calculateSeries,classify,monthOffset,validateProducts} from './products.js';
const num=v=>v===null ? '—' : v.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1});
const signed=(v,unit='%')=>v===null ? '—' : `${v>0?'+':''}${num(v)}${unit}`;
const tone=v=>v>0?'positive':v<0?'negative':'';
const money=v=>v===null?'—':`${num(v)}억`;
const date=m=>m.replace('-','.');
export function chart(series, keys, title, unit) {
  const end=series.at(-1).month, start=monthOffset(end,-23), lookup=new Map(series.map(r=>[r.month,r]));
  const rows=Array.from({length:24},(_,i)=>lookup.get(monthOffset(start,i)) || {month:monthOffset(start,i)});
  const values=rows.flatMap(r=>keys.map(k=>r[k.key])).filter(Number.isFinite);
  if (!values.length) return '<p class="chart-empty">그래프를 그릴 자료가 부족합니다.</p>';
  const width=620,height=240,left=64,right=28,top=16,bottom=38;
  let min=Math.min(0,...values),max=Math.max(0,...values);
  const range=max-min || 1; if(min<0)min-=range*.08; max+=range*.08;
  const x=i=>left+i*(width-left-right)/23, y=v=>height-bottom-(v-min)/(max-min)*(height-top-bottom);
  let svg='';
  for(let i=0;i<=4;i++){
    const v=min+(max-min)*i/4;
    svg+=`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#e6ecf3"/><text x="${left-10}" y="${y(v)+5}" text-anchor="end">${num(v)}</text>`;
  }
  if(min<0)svg+=`<line x1="${left}" x2="${width-right}" y1="${y(0)}" y2="${y(0)}" stroke="#9aaabe" stroke-dasharray="4 4"/>`;
  for(const key of keys){
    let path='',active=false;
    rows.forEach((r,i)=>{const v=r[key.key];if(!Number.isFinite(v)){active=false;return;}path+=`${active?'L':'M'}${x(i)},${y(v)} `;active=true;});
    svg+=`<path d="${path}" fill="none" stroke="${key.color}" stroke-width="2.5" ${key.dash?'stroke-dasharray="6 4"':''} stroke-linejoin="round"/>`;
    rows.forEach((r,i)=>{if(Number.isFinite(r[key.key]))svg+=`<circle cx="${x(i)}" cy="${y(r[key.key])}" r="2.8" fill="${key.color}"><title>${date(r.month)} · ${key.label} ${num(r[key.key])}${unit}</title></circle>`;});
  }
  rows.forEach((r,i)=>{if([0,6,12,18,23].includes(i))svg+=`<text x="${x(i)}" y="${height-10}" text-anchor="middle">${date(r.month)}</text>`;});
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}. 최근 24개월. 상세 값은 아래 월별 원자료에서 확인할 수 있습니다.">${svg}</svg>`;
}
export function renderProduct(product,index){
  const series=calculateSeries(product.rows),r=series.at(-1),status=classify(r);
  const metrics=[['최신월',date(r.month),''],['수출액',money(r.exports),''],['YoY',signed(r.yoy),tone(r.yoy)],['ΔYoY',signed(r.delta,'%p'),tone(r.delta)],['3개월 평균 YoY',signed(r.avgYoy),tone(r.avgYoy)],['3개월 평균 ΔYoY',signed(r.avgDelta,'%p'),tone(r.avgDelta)],['12M MA',money(r.ma),''],['MA 대비',signed(r.maGap),tone(r.maGap)]];
  const acceleration=r.delta===null?'전월 대비 성장률 변화는 자료 부족으로 계산하지 않습니다.':r.delta>0?'YoY가 전월보다 높아졌습니다.':r.delta<0?'YoY가 전월보다 낮아졌습니다.':'YoY가 전월과 같습니다.';
  return `<article class="product panel" id="${product.id}" aria-labelledby="title-${product.id}">
    <div class="product-heading"><div class="product-name"><span class="product-number">${String(index+1).padStart(2,'0')}</span><h2 id="title-${product.id}">${product.name}</h2><span class="badge ${status.tone}">${status.label}</span></div><a href="#top" class="top-link">목록 ↑</a></div>
    <dl class="product-metrics">${metrics.map(([label,value,color])=>`<div><dt>${label}</dt><dd class="${color}">${value}</dd></div>`).join('')}</dl>
    <p class="insight">${status.description} <span>${acceleration}</span></p>
    <div class="charts"><section><h3>수출액 및 12개월 이동평균</h3><div class="chart-meta"><span>억 달러</span><div class="legend"><span class="export">━ 수출액</span><span class="ma">┄ 12M MA</span></div></div><div class="chart-scroll">${chart(series,[{key:'exports',label:'수출액',color:'#216de3'},{key:'ma',label:'12M MA',color:'#e19421',dash:true}],product.name+' 수출액 및 12개월 이동평균','억 달러')}</div></section>
    <section><h3>YoY 성장률</h3><div class="chart-meta"><span>% · 전년 동월 대비</span><span class="growth">━ YoY</span></div><div class="chart-scroll">${chart(series,[{key:'yoy',label:'YoY',color:'#008b76'}],product.name+' YoY 성장률','%')}</div></section></div>
    <details class="raw-data"><summary>월별 원자료 <span>${series.length}개월</span></summary><div class="table-wrap"><table><caption class="sr-only">${product.name} 월별 수출액과 성장 지표</caption><thead><tr>${['기준월','수출액 (억 달러)','YoY (%)','ΔYoY (%p)','3개월 평균 YoY (%)','3개월 평균 ΔYoY (%p)','12M MA (억 달러)','MA 대비 (%)','자료 출처'].map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${[...series].reverse().map(row=>`<tr>${[date(row.month),num(row.exports),signed(row.yoy,''),signed(row.delta,''),signed(row.avgYoy,''),signed(row.avgDelta,''),num(row.ma),signed(row.maGap,''),row.sourceId==='ministry-report'?'산업통상부 PDF':row.sourceId==='reference-snapshot'?'참고 사이트 월별표':'예시'].map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
  </article>`;
}
export function renderDashboard(data) {
  const products=validateProducts(data);
  return products.map(renderProduct).join('');
}
