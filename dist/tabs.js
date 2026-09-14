import {mountCustoms} from './customs.js';
import {mountKosis} from './kosis.js';
import {mountFred} from './fred.js';
const names=['ministry','customs','kosis','fred'];
let fredLoaded=false;
let loaded=false;
let kosisLoaded=false;
function show(name){
 if(!names.includes(name))name='ministry';
 document.title=({ministry:'20대 주요 수출품목',customs:'관세청 10일 수출 잠정치',kosis:'KOSIS 통계',fred:'FRED 금리와 원자재'})[name]+' | 한국 수출 대시보드';
 for(const n of names){document.getElementById(n+'-panel').hidden=n!==name;document.querySelector('[data-source="'+n+'"]').setAttribute('aria-pressed',String(n===name));}
 if(name==='customs'&&!loaded){loaded=true;mountCustoms(document.getElementById('customs-content'));}
 if(name==='kosis'&&!kosisLoaded){kosisLoaded=true;mountKosis(document.getElementById('kosis-content'));}
 if(name==='fred'&&!fredLoaded){fredLoaded=true;mountFred(document.getElementById('fred-content'));}
}
for(const button of document.querySelectorAll('[data-source]'))button.addEventListener('click',()=>{const n=button.dataset.source;const url=new URL(location.href);url.searchParams.set('source',n);url.hash='';history.pushState(null,'',url);show(n);});
window.addEventListener('popstate',()=>show(new URL(location.href).searchParams.get('source')));
show(new URL(location.href).searchParams.get('source'));
