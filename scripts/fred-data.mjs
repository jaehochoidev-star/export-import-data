export function normalizeFred(observations){
  const seen=new Set();
  return observations.map(r=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||seen.has(r.date))throw Error('Invalid or duplicate FRED observation date');
    seen.add(r.date);
    const missing=r.value==='.';
    if(!missing&&!/^-?\d+(\.\d+)?$/.test(r.value))throw Error('Invalid FRED observation value');
    const value=missing?null:Number(r.value);
    if(value!==null&&!Number.isFinite(value))throw Error('Invalid FRED number');
    return {date:r.date,value};
  }).sort((a,b)=>a.date.localeCompare(b.date));
}
export const mergeFred=(older,newer)=>[...new Map([...older,...newer].map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));
export function validateFredMetadata(meta,setting){
  if(meta?.id!==setting.id||meta.frequency_short!==setting.frequency||meta.units!==setting.units||meta.seasonal_adjustment_short!=='NSA')throw Error(setting.id+': unexpected FRED series identity, frequency, units or adjustment');
}
export function spreadCheck(series){
  const map=id=>new Map(series.find(s=>s.id===id).rows.filter(r=>Number.isFinite(r.value)).map(r=>[r.date,r.value]));
  const two=map('DGS2'),ten=map('DGS10'),spread=map('T10Y2Y');
  let checked=0,mismatches=0,latest=null;
  for(const [date,value] of spread)if(two.has(date)&&ten.has(date)){
    checked++;const difference=ten.get(date)-two.get(date)-value;
    if(Math.abs(difference)>.011)mismatches++;
    latest={date,calculated:Number((ten.get(date)-two.get(date)).toFixed(4)),published:value,matches:Math.abs(difference)<=.011};
  }
  return {checked,mismatches,latest};
}
