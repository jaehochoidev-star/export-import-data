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
 const explanations=['최신 10일 구간 수출액을 전년 같은 구간과 비교합니다.','최근 9구간의 YoY입니다. 점은 현재이며 색은 최신값의 부호입니다.','최근 3구간 평균 YoY − 직전 3구간 평균 YoY (%p).','당월 1일부터 최신 구간까지의 누적을 전년 같은 기간과 비교합니다.','최근 36개 구간 수출액 합계를 직전 36개 구간과 비교합니다.','최근 36개 구간의 수출액 합계. 단위는 억 달러입니다.'];
 const headers=['최신구간 YoY','3개월 추세','모멘텀(pp)','당월누적 YoY','TTM YoY','TTM(억$)'];
 return `<section class="panel signal-panel"><div class="signal-heading"><h2>시그널 보드 · 최신구간 <strong>${segmentLabel(board[0].latest)}</strong></h2><span class="muted">행 클릭 = 상세 · 모멘텀 순</span></div><p class="signal-intro"><strong>판단 기준은 ‘레벨’이 아니라 ‘속도’입니다.</strong> 같은 상승이라도 YoY가 계속 빨라지는지(가속), 식는 중인지(둔화)를 구분합니다.</p><p class="signal-legend">🔴 가속 상승 · 🟠 상승 유지 · 🟡 상승 둔화 · 🟣 꼭지 의심 · 🟢 반전 조짐 · 🔵 하락 · ⬜ 중립</p><details class="signal-method"><summary>지표 설명과 시그널 분류 기준</summary><ul>${headers.map((h,i)=>`<li><strong>${h}</strong>: ${explanations[i]}</li>`).join('')}</ul><p>10일 구간액은 1~10일 누적, 1~20일 누적−1~10일 누적, 월 전체−1~20일 누적으로 계산합니다. TTM은 최신 구간까지 36개 구간을 사용합니다. 계절·조업일수 영향이 완전히 제거되는 것은 아닙니다.</p><p>자체 분류 기준: 최근 3구간 평균 YoY를 레벨로 사용합니다. 레벨 ≥30%, 모멘텀 ≤−15pp는 꼭지 의심. 나머지 중 레벨 ≥5%이면 모멘텀 ≥5pp 가속 상승, ≤−5pp 상승 둔화, 그 외 상승 유지. 레벨이 음수이고 모멘텀 ≥5pp이면 반전 조짐, 나머지 중 레벨 ≤−5%이면 하락. 나머지는 중립입니다. 필요한 구간이 없으면 자료 부족으로 표시합니다.</p></details><div class="signal-table-wrap"><table class="signal-table"><caption class="sr-only">품목별 수출 시그널, 모멘텀 내림차순</caption><thead><tr><th>품목</th><th>시그널</th>${headers.map((h,i)=>`<th>${h} <span tabindex="0" class="metric-help" aria-label="${explanations[i]}" title="${explanations[i]}">?</span></th>`).join('')}<th><span class="sr-only">상세 보기</span></th></tr></thead><tbody>${board.map(p=>{const r=p.latest;return `<tr data-product="${p.id}"><td>${escape(p.name)}</td><td><span class="signal-badge ${p.signal.tone}">${p.signal.icon} ${p.signal.label}</span></td><td class="${color(r.yoy)}">${rate(r.yoy)}</td><td>${signalPlot(p.series,[{key:'yoy',color:r.yoy>=0?'#158563':'#ce4f5f'}],p.name+' 최근 9구간 YoY',true)}</td><td class="${color(r.momentum)}">${signed(r.momentum)}</td><td class="${color(r.cumulativeYoy)}">${rate(r.cumulativeYoy)} <small class="window-tag">${period[r.window]}</small></td><td class="${color(r.ttmYoy)}">${rate(r.ttmYoy)}</td><td>${number(r.ttm==null?null:r.ttm/100000)}</td><td><button type="button" class="signal-detail-button" aria-label="${escape(p.name)} 상세 보기">상세 ›</button></td></tr>`;}).join('')}</tbody></table></div></section>`;
}
