const finite=Number.isFinite;
const average=values=>values.length&&values.every(finite)?values.reduce((a,b)=>a+b,0)/values.length:null;
const sum=values=>values.length&&values.every(finite)?values.reduce((a,b)=>a+b,0):null;
const growth=(a,b)=>finite(a)&&finite(b)&&b>0?(a/b-1)*100:null;
export const segmentIndex=(month,window)=>(Number(month.slice(0,4))*12+Number(month.slice(5))-1)*3+[10,20,30].indexOf(window);
export function classifySignal(level,momentum){
 if(!finite(level)||!finite(momentum))return {label:'자료 부족',icon:'⬜',tone:'neutral'};
 if(level>=30&&momentum<=-15)return {label:'꼭지 의심',icon:'🟣',tone:'peak'};
 if(level>=5&&momentum>=5)return {label:'가속 상승',icon:'🔴',tone:'accelerating'};
 if(level>=5&&momentum<=-5)return {label:'상승 둔화',icon:'🟡',tone:'slowing'};
 if(level>=5)return {label:'상승 유지',icon:'🟠',tone:'steady'};
 if(level<0&&momentum>=5)return {label:'반전 조짐',icon:'🟢',tone:'turning'};
 if(level<=-5)return {label:'하락',icon:'🔵',tone:'falling'};
 return {label:'중립',icon:'⬜',tone:'neutral'};
}
export function signalSeries(data,id){
 const records=[...data.rows].sort((a,b)=>segmentIndex(a.month,a.window)-segmentIndex(b.month,b.window));
 const value=r=>id==='excluding-semiconductors'?(finite(r.values.itemUsdAmt00)&&finite(r.values.itemUsdAmt01)?r.values.itemUsdAmt00-r.values.itemUsdAmt01:null):r.values[id];
 const cumulative=new Map(records.map(r=>[segmentIndex(r.month,r.window),value(r)]));
 const amounts=new Map(records.map(r=>{const i=segmentIndex(r.month,r.window),v=value(r),p=cumulative.get(i-1);return [i,r.window===10?v:finite(v)&&finite(p)?v-p:null];}));
 const rates=new Map([...amounts].map(([i,v])=>[i,growth(v,amounts.get(i-36))]));
 const windowValues=(map,i,n)=>Array.from({length:n},(_,k)=>map.get(i-n+1+k));
 return records.map(r=>{
  const i=segmentIndex(r.month,r.window),ma9=average(windowValues(rates,i,9)),recent=average(windowValues(rates,i,3)),prior=average(windowValues(rates,i-3,3));
  const ttm=sum(windowValues(amounts,i,36)),previousTtm=sum(windowValues(amounts,i-36,36));
  return {month:r.month,window:r.window,index:i,value:amounts.get(i),cumulative:value(r),yoy:rates.get(i),ma9,level:recent,momentum:finite(recent)&&finite(prior)?recent-prior:null,cumulativeYoy:growth(value(r),cumulative.get(i-36)),ttm,ttmYoy:growth(ttm,previousTtm)};
 });
}
export function signalBoard(data){
 const products=data.products.map(p=>({...p,name:p.id==='itemUsdAmt00'?'총계':p.name}));
 products.push({id:'excluding-semiconductors',name:'총계(반도체 제외)'});
 return products.map(p=>{const series=signalSeries(data,p.id),latest=series.at(-1);return {...p,series,latest,signal:classifySignal(latest.level,latest.momentum)};}).sort((a,b)=>(b.latest.momentum??-Infinity)-(a.latest.momentum??-Infinity)||a.name.localeCompare(b.name));
}
export const segmentLabel=r=>`${r.month} ${r.window===10?'01~10':r.window===20?'11~20':'21~말일'}`;
