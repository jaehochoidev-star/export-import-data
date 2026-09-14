// Only fixed descriptions and allowlisted error codes reach logs. Never log a URL,
// response body, credential, or the underlying exception message/cause.
const descriptions={
  10:'Missing API credential',11:'Expired API credential',
  20:'Missing query parameter',21:'Invalid query parameter',30:'No observations for query',
  31:'Query exceeds response size limit',40:'API request limit reached',
  41:'API row limit reached',42:'API user access restricted',50:'KOSIS server error'
};
const networkCodes=new Set(['UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN']);
export class KosisRequestError extends Error{
  constructor(code,message,retryable=false,retryAfterMs=0){super(message);this.name='KosisRequestError';this.code=code;this.retryable=retryable;this.retryAfterMs=retryAfterMs;}
}
function apiFailure(code){
  const safe=/^\d{1,3}$/.test(String(code))?String(code):'UNKNOWN';
  return new KosisRequestError('API_'+safe,descriptions[safe]||'Unrecognized KOSIS API error',['40','50'].includes(safe),safe==='40'?60000:0);
}
export function parseResponse(text,status,retryAfter,now=Date.now()){
  if(status<200||status>=300){
    const seconds=/^\d+$/.test(retryAfter||'')?Number(retryAfter):Math.max(0,(Date.parse(retryAfter)-now)/1000);
    return {error:new KosisRequestError('HTTP_'+status,'KOSIS HTTP '+status,[408,429,500,502,503,504].includes(status)&&!(seconds>120),Number.isFinite(seconds)?seconds*1000:0)};
  }
  let data;
  try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{
    const code=text.match(/<err>\s*(\d{1,3})\s*<\/err>/)?.[1];
    return {error:code?apiFailure(code):new KosisRequestError('NON_JSON','KOSIS returned a non-JSON response',true)};
  }
  if(Array.isArray(data)&&data.length)return {rows:data};
  if(data?.err!=null||data?.errCode!=null)return {error:apiFailure(data.err??data.errCode)};
  return {error:new KosisRequestError('EMPTY_DATA','KOSIS returned no observation array')};
}
export function createKosisClient({apiKey,fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),log=console.log,delays=[2500,10000,30000,60000,60000]}={}){
  if(!apiKey)throw Error('Register KOSIS_API_KEY as a repository Actions secret.');
  return async function request(params){
    const url=new URL('https://kosis.kr/openapi/Param/statisticsParameterData.do');
    for(const [k,v] of Object.entries({method:'getList',format:'json',jsonVD:'Y',prdSe:'M',...params,apiKey}))url.searchParams.set(k,v);
    const table=/^[A-Za-z0-9_]+$/.test(params.tblId)?params.tblId:'selected table';
    let retryAfterMs=0;
    for(let attempt=0;attempt<delays.length;attempt++){
      await sleep(Math.max(delays[attempt],retryAfterMs));
      let failure;
      try{
        const response=await fetchImpl(url,{signal:AbortSignal.timeout(60000),redirect:'error'});
        const result=parseResponse(await response.text(),response.status,response.headers.get('retry-after'));
        if(result.rows)return result.rows;
        failure=result.error;
      }catch(e){
        const code=networkCodes.has(e?.cause?.code)?e.cause.code:networkCodes.has(e?.code)?e.code:e?.name==='TimeoutError'?'REQUEST_TIMEOUT':'NETWORK_ERROR';
        failure=new KosisRequestError(code,'KOSIS connection failed',true);
      }
      log(`${table}: attempt ${attempt+1}/${delays.length}: ${failure.code} (${failure.message})`);
      if(!failure.retryable||attempt===delays.length-1)throw new KosisRequestError(failure.code,`${table}: ${failure.code} (${failure.message}). Stored observations were not changed.`,failure.retryable);
      retryAfterMs=failure.retryAfterMs;
    }
  };
}
