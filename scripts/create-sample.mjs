import {writeFile} from 'node:fs/promises';
import {PRODUCTS} from '../dist/products.js';
const bases=[95,7,42,38,52,43,28,19,16,22,13,12,9,7,6,13,12,9,8,5];
const rates=[1.5,1.8,.3,-.07,-.2,.02,-.05,-.1,.08,-.3,.2,.25,-.04,.1,-.08,.15,.18,.08,.4,-.02];
const products=PRODUCTS.map((p,j)=>({...p,rows:Array.from({length:44},(_,i)=>{
 const seasonal=1+.10*Math.sin((i%12)*Math.PI/6+j*.5);
 const trend=Math.pow(1+rates[j],i/12);
 const ripple=1+.04*Math.sin(i*1.9+j);
 return {month:`${2023+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,exports:Math.round(bases[j]*seasonal*trend*ripple*100)/100};
})}));
await writeFile('dist/data/products.json',JSON.stringify({mode:'sample',unit:'억 달러',products},null,2)+'\n');
