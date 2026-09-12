import {readFile,writeFile,rename} from 'node:fs/promises';
import {PRODUCTS,validateProducts} from '../dist/products.js';
const config=JSON.parse((await readFile('config/kosis.json','utf8')).replace(/^\uFEFF/,''));
if(!process.env.KOSIS_API_KEY) throw new Error('KOSIS_API_KEY 환경변수를 설정하세요.');
async function series(c){
  if(!c.url || !c.unit || !Number.isFinite(c.multiplierToHundredMillionUSD) || c.multiplierToHundredMillionUSD<=0) throw new Error('config/kosis.json의 조회 URL, 원자료 단위, 환산 배수를 설정하세요.');
  const url=new URL(c.url);
  if(url.origin!=='https://kosis.kr' || !['/openapi/Param/statisticsParameterData.do','/openapi/statisticsData.do'].includes(url.pathname)) throw new Error('KOSIS 통계자료 조회 URL만 사용할 수 있습니다.');
  if(url.searchParams.has('apiKey')) throw new Error('설정 파일의 URL에서 apiKey를 제거하세요.');
  url.searchParams.set('apiKey',process.env.KOSIS_API_KEY);
  url.searchParams.set('format','json');url.searchParams.set('jsonVD','Y');
  let response;
  try {response=await fetch(url,{signal:AbortSignal.timeout(60000),redirect:'error'});} catch {throw new Error('KOSIS 요청에 실패했습니다. 네트워크 및 조회 설정을 확인하세요.');}
  if(!response.ok) throw new Error(`KOSIS HTTP ${response.status}`);
  let data;try{data=await response.json();}catch{throw new Error('KOSIS 응답이 JSON 형식이 아닙니다.');}
  if(!Array.isArray(data)||!data.length)throw new Error('KOSIS가 통계 배열을 반환하지 않았습니다. 인증키 및 조회 설정을 확인하세요.');
  const result=new Map();
  for(const r of data){
    if(r.PRD_SE!=='M'||!/^\d{4}(0[1-9]|1[0-2])$/.test(r.PRD_DE))throw new Error('월별 자료만 지원합니다.');
    if(r.UNIT_NM!==c.unit)throw new Error('원자료 단위가 설정한 단위와 다릅니다.');
    const month=r.PRD_DE.slice(0,4)+'-'+r.PRD_DE.slice(4);
    if(result.has(month))throw new Error('월별 값이 중복됩니다. 합계 한 시계열만 선택하세요.');
    const raw=String(r.DT).replaceAll(',','').trim();
    if(!/^\d+(\.\d+)?$/.test(raw))throw new Error('결측값 또는 숫자가 아닌 값이 있습니다.');
    const value=Number(raw)*c.multiplierToHundredMillionUSD;
    if(!Number.isFinite(value))throw new Error('잘못된 금액입니다.');
    result.set(month,value);
  }
  return result;
}
if(!Array.isArray(config.products) || config.products.length!==20 || new Set(config.products.map(p=>p.id)).size!==20)throw new Error('20개 품목의 조회 설정이 필요합니다.');
const products=[];
for(const product of PRODUCTS){
  const setting=config.products.find(p=>p.id===product.id);
  if(!setting)throw new Error('품목별 조회 설정이 누락되었습니다.');
  const values=await series(setting);
  products.push({...product,rows:[...values].map(([month,exports])=>({month,exports}))});
}
const data={mode:'live',unit:'억 달러',source:'KOSIS',updatedAt:new Date().toISOString(),products};
validateProducts(data);
await writeFile('dist/data/products.json.tmp',JSON.stringify(data,null,2)+'\n');
await rename('dist/data/products.json.tmp','dist/data/products.json');
console.log('20개 품목 데이터 갱신 완료');
