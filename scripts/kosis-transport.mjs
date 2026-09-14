import https from 'node:https';
// Node's built-in fetch has a separate short connection timeout. Use HTTPS with
// an explicit overall AbortSignal, IPv4, keep-alive and normal TLS verification.
const agent=new https.Agent({keepAlive:true,family:4});
export function kosisHttps(url,{signal}={}){
  if(url.origin!=='https://kosis.kr')return Promise.reject(Error('Unexpected KOSIS origin'));
  return new Promise((resolve,reject)=>{
    const request=https.get(url,{agent,signal,headers:{Accept:'application/json','Accept-Encoding':'identity'}},response=>{
      const chunks=[];let size=0;
      response.on('data',chunk=>{
        size+=chunk.length;
        if(size>10*1024*1024){response.destroy();reject(Error('Response size limit'));return;}
        chunks.push(chunk);
      });
      response.on('error',reject);
      response.on('end',()=>resolve({status:response.statusCode,headers:{get:name=>response.headers[name.toLowerCase()]||null},text:async()=>Buffer.concat(chunks).toString('utf8')}));
    });
    request.on('error',reject);
  });
}
