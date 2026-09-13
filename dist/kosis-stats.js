export const monthIndex=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
export const monthLabel=i=>`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;
const mean=values=>values.length&&values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0)/values.length:null;
export function monthlyStats(rows){
  if(!rows.length)return [];
  const map=new Map(rows.map(r=>[monthIndex(r.month),r]));
  const first=Math.min(...map.keys()),last=Math.max(...map.keys());
  const values=i=>map.get(i)?.value;
  const yoy=i=>Number.isFinite(values(i))&&values(i-12)>0?(values(i)/values(i-12)-1)*100:null;
  return Array.from({length:last-first+1},(_,offset)=>{
    const i=first+offset;
    return {index:i,month:monthLabel(i),value:values(i)??null,yoy:yoy(i),ma12:mean(Array.from({length:12},(_,k)=>values(i-k))),yoy3:mean(Array.from({length:3},(_,k)=>yoy(i-k)))};
  });
}
export function combineSeries(series){
  const combined=new Map();
  for(const s of series)for(const r of monthlyStats(s.rows)){
    const row=combined.get(r.month)||{month:r.month,index:r.index};
    row[s.id]=r;combined.set(r.month,row);
  }
  return [...combined.values()].sort((a,b)=>a.index-b.index);
}
export function commonLatest(series){
  if(!series.length)return null;
  const months=series.map(s=>new Set(s.rows.map(r=>r.month)));
  return [...months[0]].filter(m=>months.every(s=>s.has(m))).sort().at(-1)||null;
}
export function industryReading(shipment,inventory){
  if(!Number.isFinite(shipment)||!Number.isFinite(inventory))return '출하·재고를 함께 비교할 자료가 부족합니다.';
  const flow=shipment>0?'출하가 작년보다 늘고':shipment<0?'출하가 작년보다 줄고':'출하가 작년과 비슷하고';
  const stock=inventory>0?'재고는 늘었습니다.':inventory<0?'재고는 줄었습니다.':'재고는 비슷합니다.';
  return flow+' '+stock;
}
