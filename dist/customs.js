import {signalBoard,segmentLabel} from './customs-signals.js';
const number=v=>v==null?'—':v.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1});
const rate=v=>v==null?'—':`${v>0?'+':''}${number(v)}%`;
const signed=v=>v==null?'—':`${v>0?'+':''}${number(v)}`;
const color=v=>v>0?'signal-positive':v<0?'signal-negative':'';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const period={10:'1~10일',20:'1~20일',30:'월 전체'};
export function seriesFor(data,product,window){
 const rows=data.rows.filter(r=>r.window===Number(window)).sort((a,b)=>a.month.localeCompare(b.month));
 const values=new Map(rows.map(r=>[r.month,r.values[product]]));
 return rows.map(r=>{const value=r.values[product],previous=values.get(`${Number(r.month.slice(0,4))-1}${r.month.slice(4)}`);return {...r,value,yoy:previous>0?(value/previous-1)*100:null};});
}
export async function mountCustoms(root){
 try{
  const response=await fetch('./data/customs.json');if(!response.ok)throw Error('데이터를 불러오지 못했습니다.');
  const data=await response.json();
  if(data.status!=='live'||!data.rows.length){root.innerHTML='<div class="panel"><h2>관세청 자료 연결 준비 중</h2><p>공식 API 인증이 완료되면 주요 10대 품목의 누적 수출액과 전년 동기 대비 그래프가 이곳에 표시됩니다.</p></div>';return;}
  const board=signalBoard(data);
  root.innerHTML=renderSignalBoard(board)+`<dialog class="signal-dialog" aria-labelledby="signal-detail-title"><div class="signal-dialog-head"><h2 id="signal-detail-title"></h2><button type="button" class="signal-close">닫기 ×</button></div><div class="signal-detail-body"></div></dialog>`;
  const dialog=root.querySelector('dialog');
  root.querySelector('.signal-close').addEventListener('click',()=>dialog.close());
  root.querySelector('.signal-table tbody').addEventListener('click',event=>{
   const row=event.target.closest('tr[data-product]');if(!row)return;
   const p=board.find(p=>p.id===row.dataset.product),r=p.latest;
   root.querySelector('#signal-detail-title').textContent=p.name+' · '+segmentLabel(r);
   root.querySelector('.signal-detail-body').innerHTML=`<p class="signal-badge ${p.signal.tone}">${p.signal.icon} ${p.signal.label}</p><dl class="product-metrics signal-detail-metrics">${[['최신구간 YoY',rate(r.yoy)],['모멘텀',signed(r.momentum)+' pp'],['당월누적 YoY',rate(r.cumulativeYoy)],['TTM YoY',rate(r.ttmYoy)]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><h3>10일 구간 YoY 및 9구간 이동평균 · %</h3><p class="muted">초록: 구간 YoY · 보라: MA9 · 저장된 전체 기간</p>${signalPlot(p.series,[{key:'yoy',color:'#168b78'},{key:'ma9',color:'#9365c9'}],'구간 YoY 및 MA9')}<h3>TTM YoY · %</h3>${signalPlot(p.series,[{key:'ttmYoy',color:'#216de3'}],'TTM YoY')}<h3>최근 12개월 수출액 · 억 달러</h3>${signalPlot(p.series.map(r=>({...r,ttm:r.ttm==null?null:r.ttm/100000})),[{key:'ttm',color:'#9365c9'}],'TTM 수출액')}<details class="raw-data"><summary>구간별 원자료와 계산 결과</summary><div class="table-wrap"><table><thead><tr><th>구간</th><th>구간액(억 달러)</th><th>구간 YoY</th><th>누적 YoY</th><th>모멘텀(pp)</th><th>TTM YoY</th></tr></thead><tbody>${[...p.series].reverse().map(r=>`<tr><td>${segmentLabel(r)}</td><td>${number(r.value==null?null:r.value/100000)}</td><td>${rate(r.yoy)}</td><td>${rate(r.cumulativeYoy)}</td><td>${signed(r.momentum)}</td><td>${rate(r.ttmYoy)}</td></tr>`).join('')}</tbody></table></div></details>`;
   dialog.showModal();
  });
 }catch(error){root.textContent=error.message;}
}

export function signalPlot(series,keys,label,small=false){
 const end=series.at(-1)?.index,start=small?end-8:series[0]?.index;
 const lookup=new Map(series.map(r=>[r.index,r]));
 const rows=Array.from({length:Math.max(0,end-start+1)},(_,i)=>lookup.get(start+i)||{index:start+i});
 const vals=rows.flatMap(r=>keys.map(k=>r[k.key])).filter(Number.isFinite);
 if(!vals.length)return '<span class="muted">자료 부족</span>';
 const w=small?120:750,h=small?36:270,left=small?4:78,right=small?4:24,top=small?4:20,bottom=small?4:52;
 let min=Math.min(...vals),max=Math.max(...vals),step=1;
 if(!small){
  const rough=(max-min||Math.max(Math.abs(max)*.2,1))/4,power=10**Math.floor(Math.log10(rough));
  step=([1,2,5,10].find(n=>n*power>=rough)||10)*power;
  min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;
  if(min===max){min-=step;max+=step;}
 }
 const range=max-min||1;
 const x=i=>left+i*(w-left-right)/Math.max(1,rows.length-1),y=v=>h-bottom-(v-min)/range*(h-top-bottom);
 let svg='';
 if(!small){
  for(let i=0;i<=Math.round((max-min)/step);i++){
   const value=min+i*step,zero=Math.abs(value)<step*1e-8;
   svg+=`<line class="signal-grid-y" x1="${left}" x2="${w-right}" y1="${y(value)}" y2="${y(value)}" stroke="${zero?'#9caec5':'#e0e7f0'}" stroke-width="${zero?1.4:1}"/><text x="${left-12}" y="${y(value)+4}" text-anchor="end">${number(zero?0:value)}</text>`;
  }
  const ticks=new Set(Array.from({length:5},(_,i)=>Math.round(i*(rows.length-1)/4)));
  for(const i of ticks){
   const serial=start+i,monthIndex=Math.floor(serial/3),month=`${Math.floor(monthIndex/12)}-${String(monthIndex%12+1).padStart(2,'0')}`,segment=['01~10','11~20','21~말일'][serial%3];
   svg+=`<line class="signal-grid-x" x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${h-bottom}" stroke="#e0e7f0" stroke-dasharray="3 3"/><text x="${x(i)}" y="${h-bottom+22}" text-anchor="middle"><tspan x="${x(i)}">${month}</tspan><tspan x="${x(i)}" dy="16">${segment}</tspan></text>`;
  }
 }
 for(const k of keys){let path='',active=false;rows.forEach((r,i)=>{if(!Number.isFinite(r[k.key])){active=false;return;}path+=(active?'L':'M')+x(i)+','+y(r[k.key]);active=true;});svg+=`<path d="${path}" stroke="${k.color}" stroke-width="${small?1.8:2.4}" fill="none"/>`;const last=rows.at(-1);if(Number.isFinite(last[k.key]))svg+=`<circle cx="${x(rows.length-1)}" cy="${y(last[k.key])}" r="3" fill="${k.color}"/>`;}
 return `<svg class="${small?'signal-spark':'customs-plot'}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title>${svg}</svg>`;
}
export function renderSignalBoard(board){
 const explanations=["최근 10일 구간의 수출이 작년 같은 구간보다 얼마나 늘거나 줄었는지 보여줍니다. +20%라면 작년보다 20% 늘었다는 뜻입니다.","최근 약 3개월(9개 구간)의 전년 대비 증가율 변화입니다. 끝의 점은 최신값이며, 초록은 작년보다 증가, 빨강은 감소를 뜻합니다.","최근 3구간의 평균 증가율에서 직전 3구간의 평균 증가율을 뺀 값입니다. 양수면 증가율이 높아지는 중, 음수면 낮아지는 중입니다.","이번 달 1일부터 최신 집계일까지의 총수출을 작년 같은 기간과 비교합니다. 20일 집계라면 올해와 작년의 1~20일을 비교합니다.","최근 12개월에 해당하는 36개 구간의 총수출이 그 이전 36개 구간보다 얼마나 늘거나 줄었는지 보여줍니다. 장기 흐름을 보는 지표입니다.","최신 구간까지 최근 12개월에 해당하는 36개 구간의 총수출액입니다. 1억 달러 단위로 표시합니다."];
 const headers=['최신구간 YoY','3개월 추세','모멘텀(pp)','당월누적 YoY','TTM YoY','TTM(억$)'];
 return `<section class="panel signal-panel"><div class="signal-heading"><h2>시그널 보드 · 최신구간 <strong>${segmentLabel(board[0].latest)}</strong></h2><span class="muted">행 클릭 = 상세 · 모멘텀 순</span></div><p class="signal-intro"><strong>수출 증가세가 더 강해지는지, 약해지는지 살펴보세요.</strong> 작년 같은 기간보다 수출이 얼마나 늘었는지를 ‘전년 대비 증가율(YoY)’이라고 합니다. 최근 증가율과 그 변화 폭을 함께 보고, 증가세가 강해지는 품목부터 보여줍니다.</p><p class="signal-legend">🔴 가속 상승 · 🟠 상승 유지 · 🟡 상승 둔화 · 🟣 꼭지 의심 · 🟢 반전 조짐 · 🔵 하락 · ⬜ 중립</p><details class="signal-method"><summary>지표와 색깔 신호, 이렇게 읽으세요</summary><ul>${headers.map((h,i)=>`<li><strong>${h}</strong>: ${explanations[i]}</li>`).join('')}</ul><p><strong>모멘텀 예시:</strong> 직전 3구간의 평균 증가율이 +10%, 최근 3구간이 +20%라면 모멘텀은 +10%p입니다. 반대로 +20%에서 +10%로 낮아지면 −10%p입니다. 수출은 작년보다 늘었어도 증가세는 약해질 수 있습니다. pp와 %p는 모두 두 증가율의 차이인 ‘퍼센트포인트’를 뜻합니다.</p><h3>색깔 신호의 의미</h3><p>아래의 <strong>평균 증가율</strong>은 최근 3개 구간(약 한 달)의 YoY 평균입니다. 위에서부터 확인해 처음 해당하는 신호를 표시합니다.</p><div class="table-wrap"><table class="signal-guide"><thead><tr><th>신호</th><th>쉽게 풀면</th><th>분류 기준</th></tr></thead><tbody><tr><td>🟣 꼭지 의심</td><td>증가율은 높지만 증가세가 크게 약해졌습니다. 실제 정점을 확인했다는 뜻은 아닙니다.</td><td>평균 증가율 30% 이상, 모멘텀 −15%p 이하</td></tr><tr><td>🔴 가속 상승</td><td>작년보다 수출이 늘고, 증가세도 강해지고 있습니다.</td><td>평균 증가율 5% 이상, 모멘텀 +5%p 이상</td></tr><tr><td>🟡 상승 둔화</td><td>작년보다 수출은 늘지만, 증가세는 약해지고 있습니다.</td><td>평균 증가율 5% 이상, 모멘텀 −5%p 이하</td></tr><tr><td>🟠 상승 유지</td><td>작년보다 수출이 늘고, 증가세도 대체로 유지됩니다.</td><td>평균 증가율 5% 이상, 모멘텀 −5%p 초과·+5%p 미만</td></tr><tr><td>🟢 반전 조짐</td><td>평균적으로 작년보다 수출이 적지만, 감소 폭이 줄어드는 흐름입니다.</td><td>평균 증가율 0% 미만, 모멘텀 +5%p 이상</td></tr><tr><td>🔵 하락</td><td>작년보다 수출이 줄었고, 뚜렷한 회복 신호가 아직 없습니다.</td><td>위 기준에 해당하지 않고 평균 증가율 −5% 이하</td></tr><tr><td>⬜ 중립</td><td>위의 상승·하락 신호로 분류하기 어려운 상태입니다.</td><td>위 기준에 해당하지 않는 경우</td></tr></tbody></table></div><p>이 신호는 대시보드의 자체 기준입니다. 계산에 필요한 기간의 데이터가 없으면 ‘자료 부족’으로 표시합니다.</p><h3>기간과 계산 방식</h3><p>한 달을 <strong>1~10일, 11~20일, 21일~말일</strong>의 세 구간으로 나눕니다. 관세청의 누적 발표 금액에서 앞 구간의 누적 금액을 빼서 각 구간의 수출액을 구합니다. 예를 들어 11~20일 수출액은 ‘1~20일 누적 − 1~10일 누적’입니다.</p><p>TTM은 ‘최근 12개월 합계’를 뜻하며, 여기서는 최신 구간까지 36개 구간을 합산합니다. 한 구간보다 장기 흐름을 보기 좋지만, 계절이나 실제 일한 날 수의 영향이 완전히 사라지는 것은 아닙니다.</p></details><div class="signal-table-wrap"><table class="signal-table"><caption class="sr-only">품목별 수출 시그널, 모멘텀 내림차순</caption><thead><tr><th>품목</th><th>시그널</th>${headers.map((h,i)=>`<th>${h} <span tabindex="0" class="metric-help" aria-label="${explanations[i]}" title="${explanations[i]}">?</span></th>`).join('')}<th><span class="sr-only">상세 보기</span></th></tr></thead><tbody>${board.map(p=>{const r=p.latest;return `<tr data-product="${p.id}"><td>${escape(p.name)}</td><td><span class="signal-badge ${p.signal.tone}">${p.signal.icon} ${p.signal.label}</span></td><td class="${color(r.yoy)}">${rate(r.yoy)}</td><td>${signalPlot(p.series,[{key:'yoy',color:r.yoy>=0?'#158563':'#ce4f5f'}],p.name+' 최근 9구간 YoY',true)}</td><td class="${color(r.momentum)}">${signed(r.momentum)}</td><td class="${color(r.cumulativeYoy)}">${rate(r.cumulativeYoy)} <small class="window-tag">${period[r.window]}</small></td><td class="${color(r.ttmYoy)}">${rate(r.ttmYoy)}</td><td>${number(r.ttm==null?null:r.ttm/100000)}</td><td><button type="button" class="signal-detail-button" aria-label="${escape(p.name)} 상세 보기">상세 ›</button></td></tr>`;}).join('')}</tbody></table></div></section>`;
}
