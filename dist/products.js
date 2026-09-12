export const PRODUCTS = [
  ['semiconductors','반도체'],['computers','컴퓨터'],['petroleum','석유제품'],
  ['petrochemicals','석유화학'],['automobiles','자동차'],['machinery','일반기계'],
  ['steel','철강제품'],['auto-parts','자동차부품'],['displays','디스플레이'],
  ['ships','선박'],['wireless','무선통신기기'],['biohealth','바이오헬스'],
  ['textiles','섬유'],['batteries','이차전지'],['appliances','가전'],
  ['electrical','전기기기'],['nonferrous','비철금속'],['food','농수산식품'],
  ['cosmetics','화장품'],['household','생활용품']
].map(([id,name])=>({id,name}));

export function monthOffset(month, offset) {
  const [year,m] = month.split('-').map(Number);
  const total = year*12 + m-1 + offset;
  return `${Math.floor(total/12)}-${String((total%12+12)%12+1).padStart(2,'0')}`;
}
export function validateProductRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('월별 수출 데이터가 없습니다.');
  const seen = new Set();
  for (const row of rows) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || seen.has(row.month) || !Number.isFinite(row.exports) || row.exports<0) throw new Error('수출 데이터의 월 또는 금액이 올바르지 않습니다.');
    if (row.reportedYoy !== undefined && (!Number.isFinite(row.reportedYoy) || row.reportedYoy < -100)) throw new Error('공표 YoY 형식이 올바르지 않습니다.');
    seen.add(row.month);
  }
  return [...rows].sort((a,b)=>a.month.localeCompare(b.month));
}
export function validateProducts(data) {
  if (!['sample','live'].includes(data.mode) || data.unit!=='억 달러' || !Array.isArray(data.products) || data.products.length!==20) throw new Error('20개 품목과 데이터 구분·단위를 확인하세요.');
  if (new Set(data.products.map(p=>p.id)).size!==20) throw new Error('중복 품목이 있습니다.');
  return PRODUCTS.map(p=>{
    const item=data.products.find(item=>item.id===p.id);
    if (!item) throw new Error(`${p.name} 데이터가 없습니다.`);
    return {...p,rows:validateProductRows(item.rows)};
  });
}
const average = values => values.every(Number.isFinite) ? values.reduce((a,b)=>a+b,0)/values.length : null;
export function calculateSeries(input) {
  const rows=validateProductRows(input), byMonth=new Map(rows.map(r=>[r.month,r]));
  const growth=month=>{
    const current=byMonth.get(month), prior=byMonth.get(monthOffset(month,-12));
    if (current && Number.isFinite(current.reportedYoy)) return current.reportedYoy;
    return current && prior && prior.exports!==0 ? (current.exports/prior.exports-1)*100 : null;
  };
  const delta=month=>{
    const now=growth(month), before=growth(monthOffset(month,-1));
    return now!==null && before!==null ? now-before : null;
  };
  return rows.map(row=>{
    const ma=average(Array.from({length:12},(_,i)=>byMonth.get(monthOffset(row.month,-i))?.exports));
    return {...row,yoy:growth(row.month),delta:delta(row.month),ma,
      avgYoy:average([0,-1,-2].map(i=>growth(monthOffset(row.month,i)))),
      avgDelta:average([0,-1,-2].map(i=>delta(monthOffset(row.month,i)))),
      maGap:ma!==null && ma!==0 ? (row.exports/ma-1)*100 : null};
  });
}
export function classify(r) {
  if (r.yoy===null || r.avgYoy===null) return {label:'자료 부족',tone:'neutral',description:'전년 동월 자료 또는 최근 3개월 성장률이 부족해 흐름을 판단하지 않습니다.'};
  if (r.yoy>=100 && r.avgYoy>=100) return {label:'초고성장',tone:'strong',description:'최신 YoY와 최근 3개월 평균 YoY가 모두 100% 이상입니다.'};
  if (r.yoy>=10 && r.avgYoy>=10) return {label:'고성장',tone:'strong',description:'최신 YoY와 최근 3개월 평균 YoY가 모두 두 자릿수 증가율입니다.'};
  if (r.yoy>0 && r.avgYoy<=0) return {label:'회복 전환',tone:'recovery',description:'최근 3개월 평균 YoY는 0% 이하이지만 최신월은 증가로 돌아섰습니다.'};
  if (r.yoy>0) return {label:'성장',tone:'recovery',description:'최신월 수출액이 전년 동월보다 증가했습니다.'};
  if (r.yoy<0) return {label:'감소',tone:'weak',description:'최신월 수출액이 전년 동월보다 감소했습니다.'};
  return {label:'보합',tone:'neutral',description:'최신월 수출액이 전년 동월과 같습니다.'};
}
