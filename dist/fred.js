import {fredStats,cropFred} from './fred-stats.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:2,minimumFractionDigits:2}):'—';
const signed=(v,unit='')=>Number.isFinite(v)?`${v>0?'+':''}${number(v)}${unit}`:'—';
const colors=['#216de3','#168b78','#9365c9'];
export function fredPlot(series,label,zero=false){
  const points=series.flatMap(s=>s.rows.filter(r=>Number.isFinite(r.value)));
  if(!points.length)return '<p class="muted">표시할 자료가 없습니다.</p>';
  const w=800,h=280,l=80,r=45,t=18,b=42;
  const dates=series.flatMap(s=>s.rows.map(r=>Date.parse(r.date))),first=Math.min(...dates),last=Math.max(...dates);
  let min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value));
  if(zero){min=Math.min(0,min);max=Math.max(0,max);}
  const rough=(max-min||1)/4,power=10**Math.floor(Math.log10(rough)),step=([1,2,5,10].find(v=>v*power>=rough)||10)*power;
  min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;if(min===max){min-=step;max+=step;}
  const x=d=>l+(Date.parse(d)-first)*(w-l-r)/Math.max(1,last-first),y=v=>h-b-(v-min)*(h-t-b)/(max-min);
  let svg='';
  if(zero&&min<0)svg+=`<rect x="${l}" y="${y(0)}" width="${w-l-r}" height="${y(min)-y(0)}" fill="#fff1f3"/>`;
  for(let i=0;i<=Math.round((max-min)/step);i++){
    const value=min+i*step;svg+=`<line x1="${l}" x2="${w-r}" y1="${y(value)}" y2="${y(value)}" stroke="${Math.abs(value)<1e-9?'#91a3b9':'#dce5ee'}"/><text x="${l-10}" y="${y(value)+4}" text-anchor="end">${number(value)}</text>`;
  }
  for(let i=0;i<5;i++){
    const date=new Date(first+(last-first)*i/4).toISOString().slice(0,10),xx=x(date);
    svg+=`<line x1="${xx}" x2="${xx}" y1="${t}" y2="${h-b}" stroke="#dce5ee" stroke-dasharray="3 3"/><text x="${xx}" y="${h-12}" text-anchor="middle">${date.slice(0,7)}</text>`;
  }
  for(const s of series){
    let path='',prior=null;
    for(const row of s.rows){
      if(!Number.isFinite(row.value)){prior=null;continue;}
      const gap=prior?(Date.parse(row.date)-Date.parse(prior.date))/86400000:Infinity;
      path+=(gap<=(s.frequency==='M'?32:4)?'L':'M')+x(row.date)+','+y(row.value);prior=row;
    }
    svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.2"/>`;
    const lastValue=s.rows.findLast(row=>Number.isFinite(row.value));
    if(lastValue)svg+=`<circle cx="${x(lastValue.date)}" cy="${y(lastValue.value)}" r="3" fill="${s.color}"><title>${esc(s.name)} ${lastValue.date}: ${number(lastValue.value)}</title></circle>`;
  }
  return `<div class="fred-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${svg}</svg></div>`;
}
const legend=items=>`<p class="kosis-legend">${items.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</p>`;
function rawTable(s){
  const rows=s.rows.slice(-(s.frequency==='M'?24:60));
  return `<details class="raw-data"><summary>최근 ${rows.length}개 원자료 · ${esc(s.unit)}</summary><div class="table-wrap"><table><thead><tr><th>기준일${s.frequency==='M'?' (월)':''}</th><th>${esc(s.name)}</th></tr></thead><tbody>${[...rows].reverse().map(r=>`<tr><td>${r.date}</td><td>${Number.isFinite(r.value)?r.value.toLocaleString('ko-KR',{maximumFractionDigits:12}):'—'}</td></tr>`).join('')}</tbody></table></div></details>`;
}
const source=s=>`<a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">FRED · ${esc(s.id)}</a>`;
export function renderFred(data,range='3'){
  if(data.status!=='live'||data.series?.length!==10)return '<p class="notice">FRED 공식 자료를 준비하고 있습니다. 첫 수집이 완료되면 표시됩니다.</p>';
  const series=data.series.map(s=>({...s,stats:fredStats(s)})),at=s=>s.stats.findLast(r=>Number.isFinite(r.value));
  const rates=series.filter(s=>s.group==='rates'),spread=series.find(s=>s.group==='spread');
  const lines=rates.map((s,i)=>({...s,rows:cropFred(s.rows,range),color:colors[i]}));
  const latest=at(spread),check=data.spreadCheck?.latest;
  return `<div class="kosis-toolbar fred-toolbar"><p class="muted">최근 자료 반영 ${esc(new Date(data.updatedAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}))} · 각 지표의 기준일을 확인하세요.</p><label>그래프 기간 <select id="fred-range">${[['1','최근 1년'],['3','최근 3년'],['5','최근 5년'],['all','저장된 전체 기간']].map(([v,n])=>`<option value="${v}" ${v===range?'selected':''}>${n}</option>`).join('')}</select></label></div>
  <section class="panel"><h2>미국 국채 금리</h2><p class="muted">만기별 금리와 장단기 차이를 함께 확인하세요. 변화는 직전 값이 있는 발표일 대비입니다.</p><div class="fred-rate-cards">${[...rates,spread].map(s=>{const r=at(s);return `<article><h3>${esc(s.name)}</h3><strong>${number(r?.value)} <small>${s.unit}</small></strong><p>${signed(r?.change,' %p')} <span class="muted">직전 대비</span></p><p class="muted">${r?.date||'자료 부족'} · 일별</p></article>`;}).join('')}</div>${legend(lines)}${fredPlot(lines,'미국 국채 2년·5년·10년 수익률, %')}<div class="fred-raw-group">${rates.map(s=>`<div>${source(s)}${rawTable(s)}</div>`).join('')}</div></section>
  <section class="panel"><h2>10년−2년 금리차 <span class="fred-badge">${latest?.value<0?'장단기 금리 역전':latest?.value>0?'10년물 금리가 더 높음':'금리차 0'}</span></h2><p class="muted">0 아래에서는 2년물 금리가 10년물보다 높습니다. 분홍색 영역은 금리차가 음수인 구간입니다.</p>${fredPlot([{...spread,rows:cropFred(spread.rows,range),color:colors[2]}],'10년−2년 금리차, %p',true)}<p class="fred-note">${check?`${check.date} 공통 기준일 검산: 10년물−2년물 ${signed(check.calculated,' %p')} · FRED 금리차 ${signed(check.published,' %p')} · ${check.matches?'일치 (허용 오차 0.01%p)':'차이 있음: 발표 시점이나 수정 여부를 확인하세요.'}`:'세 지표의 같은 날짜 자료가 부족해 검산할 수 없습니다.'}</p><p>${source(spread)}</p>${rawTable(spread)}</section>
  ${[['metals','금속 · 월평균 가격'],['oil','원유 · 일별 현물 가격'],['grains','곡물 · 월평균 가격']].map(([group,title])=>`<section class="fred-group"><h2>${title}</h2><div class="fred-price-grid">${series.filter(s=>s.group===group).map(s=>{
    const r=at(s),monthly=s.frequency==='M',rows=cropFred(s.stats,range),line=[{...s,rows,color:colors[0]}];
    if(monthly)line.push({...s,name:'12개월 이동평균',rows:rows.map(r=>({...r,value:r.ma12})),color:colors[2]});
    return `<article class="panel"><div class="signal-heading"><h3>${s.name}</h3><span class="muted">${monthly?r?.date.slice(0,7):r?.date}</span></div><p class="fred-price">${number(r?.value)} <small>${s.unit}</small></p><p class="fred-change">${monthly?'전월':'직전 발표일'} 대비 ${signed(r?.pct,'%')}${monthly?` · 전년 동월 대비 ${signed(r?.yoy,'%')}`:` <span class="muted">(비교일 ${r?.previousDate||'—'})</span>`}</p>${legend(line)}${fredPlot(line,s.name+' 가격, '+s.unit)}<p class="muted">${monthly?'월평균 · 12개월 이동평균은 해당 월 포함 12개월 평균':'일별 · 휴일·미발표일은 빈 값으로 보관'} · ${source(s)}</p>${rawTable(s)}</article>`;
  }).join('')}</div></section>`).join('')}
  <section class="panel"><h2>은 가격 · 연결 확인 중</h2><p>요청한 FRED 코드 PSILVUSDM은 현재 조회되지 않아 가격을 표시하지 않습니다. 다른 지표나 임의의 값으로 대체하지 않았습니다.</p></section><section class="panel source-details"><h2>자료 출처와 갱신</h2><p>제공: FRED, Federal Reserve Bank of St. Louis. 국채 금리: Federal Reserve Board · 원유: U.S. Energy Information Administration · 금속·곡물: International Monetary Fund. IMF 원자재 자료: Copyright © 2016, International Monetary Fund · <a href="https://www.imf.org/external/terms.htm" target="_blank" rel="noopener">이용 조건</a>.</p><p>매일 오전 10시(한국 시간)에 새 자료와 과거 수정치를 확인합니다. 일별 지표도 발표가 늦거나 휴일이면 최신 날짜가 다를 수 있습니다. 월별 가격의 날짜는 해당 월을 나타내며 월초 하루의 가격이 아닙니다.</p><p>원자료를 2000년부터 누적 보관합니다. —는 미발표 또는 계산 자료 부족입니다. 결측치를 0으로 바꾸지 않으며, 금리차와 변화율은 반올림 전 값으로 계산합니다. 가격 변화율은 비교값이 양수일 때만 계산합니다.</p><p><a href="./data/fred.json" download="fred-history.json">저장된 전체 FRED 데이터 받기 (JSON)</a> · 각 지표의 FRED 링크에서 정의와 최신 발표를 확인할 수 있습니다.</p></section>`;
}
export async function mountFred(root){
  try{
    const response=await fetch('./data/fred.json');if(!response.ok)throw Error('FRED 자료를 아직 불러올 수 없습니다. 첫 수집 완료 후 새로고침해 주세요.');
    const data=await response.json();let range='3';
    function render(){root.innerHTML=renderFred(data,range);root.querySelector('#fred-range')?.addEventListener('change',e=>{range=e.target.value;render();root.querySelector('#fred-range').focus();});}
    render();
  }catch{root.innerHTML='<p class="notice">FRED 자료를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';}
}
