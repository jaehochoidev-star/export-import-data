export const clean=s=>String(s??'').normalize('NFKC').replace(/\s/g,'');
export function parseValue(value){
  const s=String(value??'').trim().replaceAll(',','');
  if(['','-','…','...','x','X'].includes(s))return null;
  if(!/^\d+(\.\d+)?$/.test(s))throw Error('Unrecognized KOSIS observation');
  return Number(s);
}
export function normalizeRows(raw,setting,basis){
  if(!Array.isArray(raw)||!raw.length)throw Error('Empty KOSIS series: '+setting.id);
  const months=new Set();
  return raw.map(r=>{
    if(r.ORG_ID!==setting.orgId||r.TBL_ID!==setting.tblId||r.ITM_ID!==setting.itmId||r.C1!==setting.objL1||(setting.objL2&&r.C2!==setting.objL2))throw Error('Unexpected series: '+setting.id);
    if(clean(r.ITM_NM)!==clean(setting.itemName)||clean(r.UNIT_NM)!==clean(basis))throw Error('KOSIS definition/basis changed: '+setting.id);
    if(r.PRD_SE!=='M'||!/^\d{4}(0[1-9]|1[0-2])$/.test(r.PRD_DE)||months.has(r.PRD_DE))throw Error('Invalid/duplicate monthly observation');
    months.add(r.PRD_DE);
    return {month:r.PRD_DE.slice(0,4)+'-'+r.PRD_DE.slice(4),value:parseValue(r.DT),sourceUpdatedAt:r.LST_CHN_DE||null};
  }).sort((a,b)=>a.month.localeCompare(b.month));
}
export function mergeRows(oldRows,newRows){
  return [...new Map([...oldRows,...newRows].map(r=>[r.month,r])).values()].sort((a,b)=>a.month.localeCompare(b.month));
}
export function selectIndustry(rows,industry){
  const found=new Map(rows.filter(r=>new RegExp(industry.match).test(clean(r.C2_NM))).map(r=>[r.C2,r.C2_NM]));
  if(found.size!==1)throw Error('Industry definition needs review: '+industry.id);
  const [objL2,officialName]=[...found][0];return {objL2,officialName};
}
