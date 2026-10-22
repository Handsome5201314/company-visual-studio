import {mountCaseStudiesPage,type CaseRequestSeed} from './case-studies';
import {mountIntake} from './intake';
import {founderHtml,focusFounder} from './founder';
import './portal.css';
const root=document.querySelector<HTMLElement>('#portal')!;
root.innerHTML='<header class="portal-header"><a class="portal-brand" href="/">童医魔盒 <span>数字公司</span></a><nav aria-label="主要导航"><a href="/cases">可信案例</a><a href="/contact">需求与预约</a><a href="/cases#founder">创始人</a><a href="/">进入 3D 总部</a></nav></header><main id="portal-main"></main>'+founderHtml+'<footer class="portal-footer">北京童医魔盒科技服务有限公司 · 真实需求、人工确认、可核验交付</footer>';
const main=document.querySelector<HTMLElement>('#portal-main')!;
async function api<T=any>(path:string,method='GET',data?:unknown):Promise<T>{const response=await fetch('/api'+path,{method,headers:method==='GET'?{}:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});let value;try{value=await response.json();}catch{throw new Error('公司服务响应异常，请稍后重试');}if(!response.ok)throw new Error(value.error||'请求失败');return value;}
let controller:{destroy():void}|undefined;
function request(seed?:CaseRequestSeed){controller?.destroy();main.innerHTML='';controller=mountIntake(main,{api,seed});document.title='需求与预约 · 童医魔盒';history.replaceState(null,'','/contact');}
const caseId=location.pathname.match(/^\/cases\/([a-f0-9-]{36})\/?$/)?.[1];
if(location.pathname.startsWith('/contact'))request();
else controller=mountCaseStudiesPage(main,{api,initialCaseId:caseId,onRequest:seed=>request(seed)});
focusFounder();
window.addEventListener('pagehide',event=>{if(!event.persisted)controller?.destroy();});
