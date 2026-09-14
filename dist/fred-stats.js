export function fredStats(series){
  const byDate=new Map(series.rows.map(r=>[r.date,r.value]));let previous=null;
  return series.rows.map(row=>{
    let change=null,pct=null,yoy=null,ma12=null;
    if(Number.isFinite(row.value)){
      let base=previous?.value;
      if(series.frequency==='M'){
        const d=new Date(row.date);d.setUTCMonth(d.getUTCMonth()-1);base=byDate.get(d.toISOString().slice(0,10));
        const y=new Date(row.date);y.setUTCFullYear(y.getUTCFullYear()-1);const prior=byDate.get(y.toISOString().slice(0,10));
        if(Number.isFinite(prior)&&prior>0)yoy=(row.value/prior-1)*100;
        const values=Array.from({length:12},(_,i)=>{const m=new Date(row.date);m.setUTCMonth(m.getUTCMonth()-i);return byDate.get(m.toISOString().slice(0,10));});
        if(values.every(Number.isFinite))ma12=values.reduce((a,b)=>a+b,0)/12;
      }
      if(Number.isFinite(base)){change=row.value-base;if(base>0)pct=change/base*100;}
      const result={...row,change,pct,yoy,ma12,previousDate:previous?.date};previous=row;return result;
    }
    return {...row,change,pct,yoy,ma12};
  });
}
export function cropFred(rows,years){
  if(years==='all'||!rows.length)return rows;
  const start=new Date(rows.at(-1).date);start.setUTCFullYear(start.getUTCFullYear()-Number(years));
  return rows.filter(r=>r.date>=start.toISOString().slice(0,10));
}
