import {monthlyStats,combineSeries,commonLatest,monthIndex,monthLabel,industryReading} from './kosis-stats.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>Number.isFinite(v)?v.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
const rate=v=>Number.isFinite(v)?`${v>0?'+':''}${number(v)}%`:'—';
const colors={value:'#216de3',volume:'#168b78',production:'#216de3',shipment:'#168b78',inventory:'#cc8a28',ma12:'#9365c9'};
export function monthlyPlot(rows,keys,label,small=false){
  const valid=rows.flatMap(r=>keys.map(k=>r[k.key])).filter(Number.isFinite);
  if(!valid.length)return '<p class="muted">비교할 자료가 부족합니다.</p>';
  const w=small?130:800,h=small?42:290,l=small?5:70,r=small?5:42,t=small?5:20,b=small?5:40;
  let min=Math.min(...valid),max=Math.max(...valid);
  const rough=(max-min||Math.max(Math.abs(max)*.2,1))/4,power=10**Math.floor(Math.log10(rough));
  const step=([1,2,5,10].find(v=>v*power>=rough)||10)*power;
  min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;if(min===max){min-=step;max+=step;}
  const first=rows[0].index,last=rows.at(-1).index;
  const x=i=>l+(i-first)*(w-l-r)/Math.max(1,last-first),y=v=>h-b-(v-min)*(h-t-b)/(max-min);
  let svg='';
  if(!small){
    for(let k=0;k<=Math.round((max-min)/step);k++){
      const v=min+k*step;
      svg+=`<line x1="${l}" x2="${w-r}" y1="${y(v)}" y2="${y(v)}" stroke="${Math.abs(v)<1e-9?'#97abc4':'#e1e8f0'}"/><text x="${l-10}" y="${y(v)+4}" text-anchor="end">${number(v)}</text>`;
    }
    for(const i of new Set(Array.from({length:5},(_,k)=>Math.round(first+(last-first)*k/4))))svg+=`<line x1="${x(i)}" x2="${x(i)}" y1="${t}" y2="${h-b}" stroke="#e1e8f0" stroke-dasharray="3 3"/><text x="${x(i)}" y="${h-13}" text-anchor="middle">${monthLabel(i)}</text>`;
  }
  for(const k of keys){
    let path='',previous=null;
    for(const row of rows){if(!Number.isFinite(row[k.key])){previous=null;continue;}path+=(previous===row.index-1?'L':'M')+x(row.index)+','+y(row[k.key]);previous=row.index;}
    svg+=`<path d="${path}" fill="none" stroke="${k.color}" stroke-width="${small?2:2.3}"/>`;
    if(Number.isFinite(rows.at(-1)[k.key]))svg+=`<circle cx="${x(last)}" cy="${y(rows.at(-1)[k.key])}" r="3" fill="${k.color}"/>`;
  }
  return `<svg class="${small?'kosis-spark':'customs-plot'}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${svg}</svg>`;
}
const legend=items=>`<p class="kosis-legend">${items.map(([label,color])=>`<span><i style="background:${color}"></i>${label}</span>`).join('')}</p>`;
const metric=(title,value,note)=>`<div><dt>${title}</dt><dd>${value}</dd><small>${note}</small></div>`;
const source=s=>`<a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">${esc(s.tableName)}</a>`;
export function renderKosis(data,range='36'){
  if(data.status!=='live'||!data.series?.length)return '<div class="panel"><h2>공식 자료를 준비하고 있습니다</h2><p>첫 자료 수집이 완료되면 수출금액·물량과 생산·출하·재고의 흐름이 표시됩니다.</p></div>';
  const trade=data.series.filter(s=>s.group==='trade'),latest=commonLatest(trade);
  const tradeRows=combineSeries(trade).map(r=>({index:r.index,month:r.month,value:r['export-value']?.yoy,volume:r['export-volume']?.yoy}));
  const crop=rows=>range==='all'?rows:rows.filter(r=>r.index>=rows.at(-1).index-Number(range)+1);
  const value=monthlyStats(trade.find(s=>s.id==='export-value').rows).find(r=>r.month===latest);
  const volume=monthlyStats(trade.find(s=>s.id==='export-volume').rows).find(r=>r.month===latest);
  const industries=[...new Set(data.series.filter(s=>s.group==='industry').map(s=>s.industryId))];
  return `<div class="kosis-toolbar"><p class="muted">월별 공식 지수 · ${esc(data.basis)} · 최근 자료 반영 ${esc(new Date(data.updatedAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}))}</p><label>그래프 기간 <select id="kosis-range">${[['36','최근 3년'],['60','최근 5년'],['all','저장된 전체 기간']].map(([v,n])=>`<option value="${v}" ${v===range?'selected':''}>${n}</option>`).join('')}</select></label></div>
  <section class="panel kosis-trade"><div class="signal-heading"><h2>수출액과 물량이 함께 늘고 있나요?</h2><span class="muted">비교 기준월 ${latest||'자료 부족'}</span></div><p class="muted">수출금액은 수출 대금의 규모가 얼마나 늘었는지, 수출물량은 가격 변동을 조정한 수출 규모가 얼마나 늘었는지 보여줍니다.</p><dl class="product-metrics kosis-metrics">${metric('수출금액 YoY',rate(value?.yoy),'작년 같은 달 대비')}${metric('수출물량 YoY',rate(volume?.yoy),'작년 같은 달 대비')}${metric('금액 · 3개월 평균 YoY',rate(value?.yoy3),'최근 3개월 증가율의 평균')}${metric('물량 · 3개월 평균 YoY',rate(volume?.yoy3),'최근 3개월 증가율의 평균')}</dl>${legend([['수출금액 YoY',colors.value],['수출물량 YoY',colors.volume]])}${monthlyPlot(crop(tradeRows),[{key:'value',color:colors.value},{key:'volume',color:colors.volume}],'월별 수출금액·물량 증가율, 단위 %')}<p class="kosis-note">두 증가율의 차이가 곧 가격 상승률은 아닙니다. 이 지수의 조사 범위는 기존 탭의 통관 수출총액과 다를 수 있습니다.</p><p class="muted">${trade.map(s=>`${esc(s.name)} 기준월 ${s.rows.at(-1).month}`).join(' · ')}</p><details class="raw-data"><summary>수출금액·물량 원자료 보기</summary>${rawTable(trade)}</details></section>
  <section class="panel"><div class="signal-heading"><h2>생산·출하·재고 흐름</h2><span class="muted">업종을 누르면 상세 그래프</span></div><p class="muted">생산한 제품이 출하되고 있는지, 재고로 남아 있는지 함께 살펴보세요. 재고 증감만으로 호황·불황을 단정하지 않습니다.</p><div class="table-wrap"><table class="kosis-industry-table"><thead><tr><th>업종</th><th>기준월</th><th>생산 YoY</th><th>출하 YoY</th><th>재고 YoY</th><th>생산 · 최근 3개월</th><th>흐름 읽기</th></tr></thead><tbody>${industries.map(id=>{
    const series=data.series.filter(s=>s.industryId===id),month=commonLatest(series),at=metric=>monthlyStats(series.find(s=>s.metric===metric).rows).find(r=>r.month===month);
    const p=at('production'),s=at('shipment'),i=at('inventory'),trend=monthlyStats(series.find(s=>s.metric==='production').rows).filter(r=>month&&r.index<=monthIndex(month)).slice(-3);
    return `<tr data-industry="${id}"><td><button class="kosis-detail-button" type="button">${esc(series[0].name)} 상세 ›</button><small>${esc(series[0].officialName)}</small></td><td>${month||'자료 부족'}</td><td>${rate(p?.yoy)}</td><td>${rate(s?.yoy)}</td><td>${rate(i?.yoy)}</td><td>${monthlyPlot(trend,[{key:'yoy',color:colors.production}],series[0].name+' 최근 3개월 생산 YoY',true)}</td><td class="kosis-reading">${industryReading(s?.yoy,i?.yoy)}</td></tr>`;
  }).join('')}</tbody></table></div><p class="kosis-note">전국 기준 원지수입니다. 출하는 내수와 수출을 포함하며, 업종 범위는 산업통상부·관세청의 수출품목 분류와 다릅니다.</p></section>
  <section class="panel source-details"><h2>자료를 읽는 방법과 출처</h2><p>YoY는 작년 같은 달 대비 증가율입니다. 12개월 이동평균은 해당 월과 앞선 11개월의 지수 평균입니다. 필요한 월이 빠지면 계산하지 않고 —로 표시합니다.</p><p>각 지수의 100은 기준연도 수준을 뜻합니다. 생산·출하·재고 지수끼리 빼서 실제 물량이나 재고량을 계산할 수는 없습니다.</p><p>매주 월요일 오전 10시(한국 시간)에 새 자료와 과거 수정치를 확인합니다. 통계별 발표일이 달라 기준월도 다를 수 있습니다. 자료가 바뀌면 누적 저장 데이터와 웹페이지를 갱신합니다.</p><p>한국은행 · 수출입물가조사: ${trade.map(source).join(' · ')}<br>국가데이터처 · 광업제조업동향조사: ${source(data.series.find(s=>s.group==='industry'))}</p><p>제공: KOSIS 국가통계포털 · 출처의 최신 수정치로 계산한 자체 시각화입니다. 잠정치 및 과거 수치는 수정될 수 있습니다.</p></section>`;
}
function rawTable(series){
  const rows=combineSeries(series);
  return `<div class="table-wrap"><table class="kosis-raw"><thead><tr><th>월</th>${series.map(s=>`<th>${esc(s.itemName)}<br>${esc(s.unit)}</th>`).join('')}</tr></thead><tbody>${[...rows].reverse().map(r=>`<tr><td>${r.month}</td>${series.map(s=>`<td>${(Number.isFinite(r[s.id]?.value)?r[s.id].value.toLocaleString('ko-KR',{maximumFractionDigits:8}):'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export async function mountKosis(root){
  try{
    const response=await fetch('./data/kosis.json');if(!response.ok)throw Error('KOSIS 자료를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
    const data=await response.json();let range='36';
    function render(){
      root.innerHTML=renderKosis(data,range)+`<dialog class="signal-dialog kosis-dialog" aria-labelledby="kosis-detail-title"><div class="signal-dialog-head"><h2 id="kosis-detail-title"></h2><button type="button" class="signal-close">닫기 ×</button></div><div class="signal-detail-body"></div></dialog>`;
      root.querySelector('#kosis-range')?.addEventListener('change',e=>{range=e.target.value;render();root.querySelector('#kosis-range').focus();});
      const dialog=root.querySelector('dialog');dialog.querySelector('.signal-close').addEventListener('click',()=>dialog.close());
      root.querySelector('.kosis-industry-table tbody')?.addEventListener('click',e=>{
        const row=e.target.closest('[data-industry]');if(!row)return;
        const series=data.series.filter(s=>s.industryId===row.dataset.industry),month=commonLatest(series);
        const all=combineSeries(series),crop=range==='all'?all:all.filter(r=>r.index>=all.at(-1).index-Number(range)+1);
        const rows=crop.map(r=>({index:r.index,month:r.month,...Object.fromEntries(series.map(s=>[s.metric,r[s.id]?.yoy])),value:r[series.find(s=>s.metric==='production').id]?.value,ma12:r[series.find(s=>s.metric==='production').id]?.ma12}));
        dialog.querySelector('h2').textContent=series[0].name+' · '+month;
        dialog.querySelector('.signal-detail-body').innerHTML=`<p>${esc(series[0].officialName)} · 전국 · ${esc(data.basis)}</p><h3>생산·출하·재고의 전년 동월 대비 변화 · %</h3>${legend([['생산',colors.production],['출하',colors.shipment],['재고',colors.inventory]])}${monthlyPlot(rows,['production','shipment','inventory'].map(key=>({key,color:colors[key]})),'생산·출하·재고 YoY')}<h3>생산지수와 12개월 이동평균</h3>${legend([['생산지수',colors.production],['12개월 이동평균',colors.ma12]])}${monthlyPlot(rows,[{key:'value',color:colors.production},{key:'ma12',color:colors.ma12}],'생산지수 및 12개월 이동평균')}<p class="muted">${series.map(s=>`${esc(s.itemName)}: ${s.rows.at(-1).month}`).join(' · ')}</p><details class="raw-data"><summary>저장된 전체 월별 원자료</summary>${rawTable(series)}</details>`;
        dialog.showModal();
      });
    }
    render();
  }catch(e){root.textContent=e.message;}
}
