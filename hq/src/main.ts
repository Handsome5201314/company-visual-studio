import {gameShell} from '../../src/ui/game-shell';
import './style.css';
import {Headquarters,type Mode,type Peer,type LobbyExhibit,type CasesPresentation} from './scene';
import projects from './data/projects.json';
import {renderReception,type ReceptionChat} from './reception';
import {createContentRoom} from './content';
import {createRecruitmentPage} from './recruitment';
import {openApplications} from './recruitment-applications';
import {createCompanyDesk} from './company-desk';
import {THEMES,applyUITheme} from '../../src/theme.js';
import {createDecorationDesk} from './decoration-desk';
import {createMarketReviewDesk} from './market-review-desk';
import {createCommercialDesk} from './commercial';
import {mountBuildUpdate} from './build-update';
import {createCaseStudiesDesk,type CaseRequestSeed} from './case-studies';
import {mountIntake} from './intake';
import {mountConsulting} from './consulting';

type Session={id:string;worldId?:string;role:'owner'|'visitor'};
type RequestRecord={id:string;service:string;name:string;contact:string;brief:string;status:string;reviewNote:string|null;version:number;createdAt:string;updatedAt:string};
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const app=$('#app');
app.innerHTML=gameShell;
mountBuildUpdate();

let hq:Headquarters,session:Session,stream:EventSource|undefined,ready=false,near=false,enterPending=false,recruiting=false;
let lastTrigger:HTMLElement|null=null;
let panelCleanup:(()=>void)|undefined;
const dialog=$<HTMLDialogElement>('#panel');
const recruitment=createRecruitmentPage({apply:async()=>{if(!ready)throw new Error('总部还未就绪，请等待加载完成后重试');if(!session)await enter(false);if(!session)throw new Error('入场失败，请重新进入公司');recruiting=true;await travel('desk');$('#mission-title').textContent='到前台申请写手合作';$('#mission-copy').textContent='你已到接待台。按 E 或点击接待按钮，填写写手合作申请。';},login:async()=>{if(!ready)throw new Error('总部还未就绪，请稍后重试');await employeeEntry();},applications:async()=>{if(!ready)throw new Error('总部还未就绪，请稍后重试');if(!session)await enter(false);if(!session)throw new Error('入场失败，请重试');await applications();},pause:value=>{if(hq)hq.paused=value||dialog.open;}});
document.querySelectorAll<HTMLAnchorElement>('[data-careers]').forEach(a=>a.onclick=e=>{e.preventDefault();recruitment.open();});
const content=createContentRoom({api,open:(title,html)=>{panel(title,html);return $('#panel-body');},cleanup:fn=>{panelCleanup=fn;},enterRoom:async()=>{if(!session)await enter(false);if(!session)throw new Error('入场连接失败，请重试');await travel('content');},accountChanged:account=>{$('#employee-access').textContent=account?'我的工作台':'员工入口';if(session)void api<Session>('/session','POST',{}).then(async s=>{const changed=session.role!==s.role||session.worldId!==s.worldId;session=s;if(changed&&hq?.entered){hq.applyPosition(await api<Peer>('/presence'));hq.enter(s.role,s.worldId||s.id);}$('#records').textContent=s.role==='owner'?'老板工作台':'我的需求';}).catch(e=>notify((e as Error).message));}});
const companyDesk=createCompanyDesk({api,open:(title,html)=>{panel(title,html);return $('#panel-body');},cleanup:fn=>{panelCleanup=fn;},owner:()=>session?.role==='owner',login:()=>void content.openLogin(()=>companyDesk.home()),adopt:(id,version,result)=>void content.openSuggestion(id,version,result),reception:async()=>{await travel('desk');return (await api<{nonce:string}>('/reception','POST',{})).nonce;},meeting:async id=>{await travel('meeting',id);},office:async()=>{await travel('office');closePanel();},walk:()=>travel('workstation'),edit:id=>void content.openEditor(id)});
const decorationDesk=createDecorationDesk({api,open:(title,html)=>{panel(title,html);return $('#panel-body');},cleanup:fn=>{panelCleanup=fn;}});
const marketReviewDesk=createMarketReviewDesk({api,open:(title,html)=>{panel(title,html);return $('#panel-body');},cleanup:fn=>{panelCleanup=fn;}});
const commercialDesk=createCommercialDesk({api,open:(title,html)=>{panel(title,html);return $('#panel-body');},cleanup:fn=>{panelCleanup=fn;},login:after=>void content.openLogin(after),reception:async()=>{if(!session)session=await api<Session>('/session','POST',{});await travel('desk');return (await api<{nonce:string}>('/reception','POST',{})).nonce;}});
const commercialButton=document.createElement('button');commercialButton.textContent='商业项目与交付';document.querySelector('.top-actions')!.append(commercialButton);commercialButton.onclick=()=>{void commercialDesk.home();};
function openIntake(seed?:CaseRequestSeed){panel('需求与真人预约','');const intake=mountIntake($('#panel-body'),{api,seed});panelCleanup=()=>intake.destroy();}
function openConsulting(){panel('真人咨询','');const consulting=mountConsulting($('#panel-body'),{api});panelCleanup=()=>consulting.destroy();}
const caseStudies=createCaseStudiesDesk({api,open:(title,html)=>{panel(title,html);return $('#panel-body');},cleanup:fn=>{panelCleanup=fn;},login:after=>void content.openLogin(after),onRequest:seed=>openIntake(seed)});
const casesButton=document.createElement('button');casesButton.textContent='可信案例';document.querySelector('.top-actions')!.append(casesButton);casesButton.onclick=()=>void caseStudies.home();
const contactLink=document.createElement('a');contactLink.href='/contact';contactLink.textContent='2D 留单与预约';document.querySelector('.top-actions')!.append(contactLink);
const consultingButton=document.createElement('button');consultingButton.textContent='真人咨询';document.querySelector('.top-actions')!.append(consultingButton);consultingButton.onclick=()=>{if(ready)openConsulting();};
const consultingNear=document.createElement('button');consultingNear.textContent='预约真人咨询';document.querySelector('#interaction')!.append(consultingNear);consultingNear.onclick=()=>{if(ready)openConsulting();};
$('#company-desk').onclick=()=>companyDesk.home();
$('#content-room').onclick=()=>void content.openBoard();$('#content-desk').onclick=()=>void content.openDesk();
async function api<T>(path:string,method='GET',data?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch(`/api${path}`,{method,headers:method==='GET'?{}:{'Content-Type':'application/json','X-Company-Request':crypto.randomUUID()},body:data===undefined?undefined:JSON.stringify(data),signal});
 let result;try{result=await response.json();}catch{throw new Error('公司服务未返回有效内容，请确认服务正在运行后重试');}
 if(!response.ok)throw new Error(result.error||`公司服务请求失败（${response.status}）`);return result;
}
function notify(message:string){$('#notice').textContent=message;$('#notice').hidden=false;}
function panel(title:string,html:string){recruitment.close();panelCleanup?.();panelCleanup=undefined;lastTrigger=document.activeElement as HTMLElement;if(hq)hq.paused=true;$('#interaction').hidden=true;$('#exhibit-interaction').hidden=true;$('#panel-title').textContent=title;$('#panel-body').innerHTML=html;dialog.showModal();}
function closePanel(){dialog.close();}
$('#close-panel').onclick=closePanel;
dialog.addEventListener('close',()=>{if(dialog.open)return;panelCleanup?.();panelCleanup=undefined;if(hq)hq.paused=false;lastTrigger?.focus();});
$('#retry').onclick=()=>location.reload();
function setMode(mode:Mode){hq.setMode(mode);document.body.dataset.cameraMode=mode;for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));}
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode as Mode));
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b=>{
 const key=b.dataset.key!;b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);hq.setKey(key,true);};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>hq.setKey(key,false));
});
function connectWorld(){
 stream?.close();stream=new EventSource('/api/world');
 stream.onopen=()=>{$('#connection').textContent='已连接 · 公司总部';$('#connection').classList.remove('offline');};
 stream.onerror=()=>{hq.updateBusiness(null);hq.updateCases(null);$('#connection').textContent='连接中断 · 正在重连';$('#connection').classList.add('offline');};
 stream.onmessage=event=>{try{const data=JSON.parse(event.data) as {caseStudies?:CasesPresentation;lobbyMessages?:{approvedCount:number;items:{name:string;body:string;createdAt:string}[]};ownCommercial?:{workingTasks:number}|null;commercial?:{publicProjects:number;confirmedDeliveries:number};consulting?:{total:number;byStatus:Record<string,number>;upcoming:number;outbox:{total:number;byStatus:Record<string,number>}}|null;peers:Peer[];activity?:{accountId:string;name:string;state:string;stage:string}[]};const own=data.peers.find(p=>p.id===(session.worldId||session.id));if(own&&(own.moving||serverMoving)){hq.applyServerPosition(own);serverMoving=Boolean(own.moving);}hq.updatePeers(data.peers);hq.updateActivity(data.activity||[]);hq.updateCases(data.caseStudies||null);hq.updateBusiness(data.commercial||null);hq.updateOwnBusiness(data.ownCommercial||null);hq.updateMessages(data.lobbyMessages||null);hq.updateDashboard({visitors:(data.peers?.length||0)+1,publishedCases:data.caseStudies?.publishedCases||0,publicProjects:data.commercial?.publicProjects||0,confirmedDeliveries:data.commercial?.confirmedDeliveries||0,consulting:data.consulting??null,updatedAt:new Date().toISOString()});}catch{notify('多人状态更新失败，请刷新后重新进入');}};
}
const appearance=document.createElement('button');appearance.textContent='外观';appearance.disabled=true;document.querySelector('.top-actions')!.append(appearance);
const decorationButton=document.createElement('button');decorationButton.textContent='公司装修';document.querySelector('.top-actions')!.append(decorationButton);decorationButton.onclick=()=>{if(ready)void decorationDesk.home();};
const marketReviewButton=document.createElement('button');marketReviewButton.textContent='总部市场审核';document.querySelector('.top-actions')!.append(marketReviewButton);marketReviewButton.onclick=()=>{if(ready)void marketReviewDesk.home();};
let appearancePending=false;
let selectedAppearance={environment:'default',ui:'default',character:'sage'};
appearance.onclick=()=>{
 if(appearancePending)return;
 panel('公司外观',`<p class="intro">仅调整当前浏览器的画面；不改变角色、业务数据、地图布局或智能体授权。</p><form id="appearance-form"><label>空间装修<select id="environment-theme">${THEMES.map(t=>`<option value="${t.id}">${escape(t.name)}</option>`).join('')}</select></label><label>界面皮肤<select id="interface-theme"><option value="default">暖纸与森林绿</option><option value="cyber">矿物白与深海蓝</option></select></label><label>通用角色配色<select id="character-theme"><option value="sage">鼠尾草绿</option><option value="cobalt">钴蓝</option></select></label><button class="primary">应用外观</button><p id="appearance-status" role="status"></p></form>`);
 {const box=document.createElement('div');box.innerHTML='<p>员工动作样板（只改变人物表现）</p>';for(const [label,pose]of [['站立',null],['坐下','Sit'],['打字','Type'],['交谈','Talk'],['指向','Point'],['交接','Handover']] as const){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{hq.setEmployeePose(pose);closePanel();};box.append(b);}$('#panel-body').append(box);}
 const form=$<HTMLFormElement>('#appearance-form'),status=$('#appearance-status');
 const environment=$<HTMLSelectElement>('#environment-theme'),interfaceTheme=$<HTMLSelectElement>('#interface-theme'),character=$<HTMLSelectElement>('#character-theme');
 environment.value=selectedAppearance.environment;interfaceTheme.value=selectedAppearance.ui;character.value=selectedAppearance.character;
 let alive=true;panelCleanup=()=>{alive=false;};
 form.onsubmit=async e=>{
  e.preventDefault();if(appearancePending)return;
  const selected={environment:environment.value,ui:interfaceTheme.value,character:character.value};
  const theme=THEMES.find(t=>t.id===selected.environment)!,ui=THEMES.find(t=>t.id===selected.ui)!;
  const controls=Array.from(form.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select'));
  appearancePending=true;appearance.disabled=true;controls.forEach(control=>control.disabled=true);status.textContent='正在加载装修…';
  try{
   await hq.setTheme(theme);hq.renderer.toneMappingExposure=theme.environment.exposure;
   applyUITheme(document.documentElement,ui);hq.setCharacterSkin(selected.character);selectedAppearance=selected;
   if(alive)status.textContent='外观已应用，角色与任务保持原状态。';else notify('外观已应用，角色与任务保持原状态。');
  }catch(error){const message='加载失败，保留原装修：'+(error as Error).message;if(alive)status.textContent=message;else notify(message);}
  finally{appearancePending=false;appearance.disabled=false;if(alive)controls.forEach(control=>control.disabled=false);}
 };
};
let travelPending=false,serverMoving=false,pendingMove:Promise<void>|null=null;
async function travel(destination:'desk'|'content'|'office'|'meeting'|'workstation',meetingId?:string){travelPending=true;try{await pendingMove;const position=await api<Peer&{actionId?:string}>('/travel','POST',{destination,meetingId});if(!position.actionId){hq?.applyPosition(position);return;}notify('角色正在走向目的地，可用方向键接管。');let done=false;const until=Date.now()+60000;while(Date.now()<until){const action=await api<{state:string;result:{reason?:string}}>('/employee/actions','POST',{type:'action.get',args:{actionId:position.actionId}});if(action.state==='completed'){done=true;break;}if(action.state!=='running')throw new Error(action.result.reason||'移动已被本人接管或中断');await new Promise(r=>setTimeout(r,300));}if(!done)throw new Error('移动仍未完成，请在角色控制中查看或接管');hq?.applyPosition(await api<Peer>('/presence'));$('#notice').hidden=true;}finally{travelPending=false;}}
async function enter(owner:boolean){
 if(!ready||enterPending)return;enterPending=true;$('#notice').hidden=true;
 try{
  session=await api<Session>('/session','POST',{});
  if(owner){const account=await content.refreshIdentity();if(account?.role!=='owner')throw new Error('请先使用老板账号登录');session=await api<Session>('/session','POST',{});}
  hq.applyPosition(await api<Peer>('/presence'));hq.enter(session.role,session.worldId||session.id);document.body.dataset.cameraMode=hq.mode;$('#entry').hidden=true;
  document.body.classList.add('company-entered');
  for(const id of ['mission','camera-controls','records','works','guide','touch','content-room','content-desk','company-desk'])$('#'+id).hidden=false;
  $('#records').textContent=session.role==='owner'?'老板工作台':'我的需求';
  if(session.role==='owner'){$('#mission-title').textContent='欢迎回公司，帅帅';$('#mission-copy').textContent='巡视总部、查看作品，或在老板工作台审核客户需求。';}
  connectWorld();
 }catch(e){notify((e as Error).message);}finally{enterPending=false;}
}
async function employeeEntry(register=false){
 const after=()=>{dialog.close();void enter(false).then(()=>{if($('#entry').hidden)void content.openDesk();});};
 if(register)await content.openRegister(after);else await content.openLogin(after);
}
$('#enter-visitor').onclick=()=>void enter(false);$('#enter-owner').onclick=()=>void content.openOwnerLogin(()=>{dialog.close();void enter(true);});
$('#enter-employee').onclick=()=>void employeeEntry();$('#register-employee').onclick=()=>void employeeEntry(true);$('#employee-access').onclick=()=>void employeeEntry();
const labels:Record<string,string>={submitted:'待老板审核',reviewing:'老板审核中','needs-info':'需要补充信息',declined:'暂不承接'};
const services:Record<string,string>={'ai-coaching':'AI 工具辅导','web-app':'网页应用制作'};
let openingReception=false;
async function reception(){
 if(!near||dialog.open||openingReception)return;
 openingReception=true;$<HTMLButtonElement>('#talk').disabled=true;
 try{
  // 等待最后位置成功上报再申请场景交互，避免刚走近时与服务端不同步。
  await api('/presence','PUT',hq.getPresence());
  const {nonce,chat}=await api<{nonce:string;chat:ReceptionChat}>('/reception','POST',{});
  panel('童医魔盒 · 公司接待台','');
  panelCleanup=renderReception({container:$('#panel-body'),nonce,chat,api,application:recruiting,onSaved:record=>{
   recruiting=false;
   const application=record.service==='writer-application';
   $('#panel-body').innerHTML=`<div class="confirmation"><h3>${application?'合作申请':'需求'}已经交到老板桌上。</h3><p>${application?'医疗内容写手合作':escape(services[record.service])} · ${escape(labels[record.status])}</p><p>你可以在${application?'“招聘信息 → 我的合作申请”':'“我的需求”'}里查看记录。请保留此浏览器的公司会话；清除 Cookie 后，当前匿名身份无法找回。</p><small>登记号 ${escape(record.id.slice(0,8))} · ${application?'申请不代表录用或付费约稿，等待老板联系确认':'价格与交期仍待老板确认'}</small><button id="back-world" class="primary">回公司逛逛</button></div>`;$('#back-world').onclick=closePanel;$('#back-world').focus();
  }});
 }catch(e){notify((e as Error).message);}finally{openingReception=false;$<HTMLButtonElement>('#talk').disabled=false;}
}
$('#talk').onclick=()=>void reception();
async function applications(){await openApplications({api,show:(title,html)=>{panel(title,html);return $('#panel-body');},owner:session.role==='owner',invite:()=>void content.openDesk()});}
async function records(){
 panel(session.role==='owner'?'老板工作台':'我的需求','<p role="status">正在读取公司记录…</p>');
 try{
  const {items}=await api<{items:RequestRecord[]}>('/requests');
  let consultingCard='';
  if(session.role==='owner'){
   try{
    const board=await api<{stats:{total:number;byStatus:Record<string,number>;upcoming:number;outbox:{total:number;byStatus:Record<string,number>}}|null}>('/consulting');
    const stats=board.stats;
    if(stats){
     const n=(key:string)=>stats.byStatus?.[key]??0;
     const outbox=stats.outbox?.byStatus??{};
     consultingCard=`<section class="owner-consulting" aria-label="真人咨询真实统计"><div class="owner-consulting-head"><h3>真人咨询 · 真实统计</h3><span>来源：公司数据库 · REAL</span></div><div class="owner-consulting-kpis"><span><b>${stats.total}</b>总记录</span><span><b>${n('requested')}</b>待确认</span><span><b>${n('confirmed')}</b>已确认</span><span><b>${n('in_progress')}</b>进行中</span><span><b>${n('completed')}</b>已完成</span><span><b>${n('cancelled')}</b>已取消</span><span><b>${n('archived')}</b>已归档</span></div><p class="owner-consulting-note">未来已确认 ${stats.upcoming} 条 · 通知未配置 ${outbox.not_configured??0} 条 · 已发送 ${outbox.sent??0} 条。这里只有真实记录数，不包含营收、成交或估算。</p><button id="open-consulting-from-records" type="button">打开咨询队列</button></section>`;
    }
   }catch{consultingCard='<p class="intro">真人咨询统计暂不可用；咨询队列仍可从顶栏“真人咨询”打开。</p>';}
  }
  $('#panel-body').innerHTML=`${consultingCard}${session.role==='owner'?'<button id="review-applications">招聘 · 审核写手申请</button>':''}<p class="intro">${session.role==='owner'?'这里只显示真实登记的需求。审核备注会出现在客户自己的需求记录中；尚未连接对外消息或交付渠道。':'这些需求仅你和老板可见。状态以公司保存的记录为准。'}</p><div id="request-list"></div>`;
  const openConsultingFromRecords=document.querySelector<HTMLButtonElement>('#open-consulting-from-records');if(openConsultingFromRecords)openConsultingFromRecords.onclick=()=>{dialog.close();openConsulting();};
  const reviewApplications=document.querySelector<HTMLButtonElement>('#review-applications');if(reviewApplications)reviewApplications.onclick=()=>void applications();
  if(!items.length){$('#request-list').innerHTML='<p class="empty">还没有需求记录。客户走到接待台确认后，记录会出现在这里。</p>';return;}
  for(const item of items){
   const article=document.createElement('article');article.className='request';
   article.innerHTML=`<div class="request-heading"><h3>${escape(services[item.service])}</h3><span class="status">${escape(labels[item.status])}</span></div><p class="request-brief">${escape(item.brief)}</p><dl><dt>称呼</dt><dd>${escape(item.name)}</dd><dt>联系方式</dt><dd>${escape(item.contact)}</dd><dt>登记时间</dt><dd>${new Date(item.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</dd></dl>${item.reviewNote?`<p class="review-note">老板备注：${escape(item.reviewNote)}</p>`:''}`;
   if(session.role==='owner'){
    const form=document.createElement('form');form.className='review-form';form.innerHTML=`<label>审核状态<select name="status" aria-label="审核状态"><option value="reviewing">开始审核</option><option value="needs-info">需要补充信息</option><option value="declined">暂不承接</option></select></label><label>给客户的审核备注<textarea name="note" aria-label="给客户的审核备注" rows="2" maxlength="2000" placeholder="确认范围，或说明还需要哪些信息"></textarea></label><p class="error" role="alert"></p><button type="submit">保存审核</button>`;
    (form.elements.namedItem('status') as HTMLSelectElement).value=item.status==='submitted'?'reviewing':item.status;
    (form.elements.namedItem('note') as HTMLTextAreaElement).value=item.reviewNote??'';
    form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button')!;button.disabled=true;const data=Object.fromEntries(new FormData(form));try{await api(`/requests/${item.id}/review`,'POST',{...data,version:item.version});dialog.close();await records();}catch(error){form.querySelector('.error')!.textContent=(error as Error).message;button.disabled=false;}};
    article.append(form);
   }
   $('#request-list').append(article);
  }
 }catch(e){$('#panel-body').innerHTML=`<p class="error" role="alert">${escape((e as Error).message)}</p><button id="retry-records">重新读取</button>`;$('#retry-records').onclick=()=>{dialog.close();void records();};}
}
$('#records').onclick=()=>void records();
$('#works').onclick=()=>panel('帅帅正在做的事',`<p class="intro">来自个人官网的公开项目快照 · ${projects.checkedAt}。本游戏独立开发，不访问其他本地项目或临床资料。</p><div class="project-list">${projects.items.map(p=>`<article class="project"><img src="${p.image}" alt=""><div><h3>${escape(p.title)}</h3><span class="project-status">${escape(p.status)}</span><p>${escape(p.description)}</p></div></article>`).join('')}</div><a class="source" href="${projects.source}" target="_blank" rel="noopener noreferrer">查看帅帅的个人官网与原始项目介绍 ↗</a>`);
let nearbyExhibit:LobbyExhibit|null=null;
async function messagesPanel(){
 try{
  const data=await api<{items:{id:string;name:string;body:string;createdAt:string;version:number}[];scope:string}>('/lobby/messages');
  const approved=data.scope==='public-approved';
  const shown=approved?data.items:[];
  const pending=approved?[]:data.items;
  panel('访客留言板',`<div class="company-introduction"><p class="exhibit-kicker">留言板</p>${shown.length?shown.map(m=>`<blockquote><strong>${escape(m.name)}</strong> · ${new Date(m.createdAt).toLocaleString('zh-CN',{hour12:false})}<p>${escape(m.body)}</p></blockquote>`).join(''):'<p>还没有公开留言，你可以留下第一句。</p>'}<form id="lobby-message-form"><label>称呼<input name="name" maxlength="40" placeholder="访客"></label><label>留言<textarea name="body" rows="3" maxlength="300" required placeholder="写下想法或建议（2–300字）。留言经负责人审核后公开，请勿包含隐私信息。"></textarea></label><label><input type="checkbox" name="confirmed" required>我同意保存本留言，并了解其经负责人审核后公开展示。</label><p id="lobby-message-status" role="alert"></p><button class="primary" type="submit">提交留言</button></form>${pending.length?`<h3>待审核 ${pending.length} 条</h3>${pending.map(m=>`<blockquote data-id="${m.id}" data-version="${m.version}"><strong>${escape(m.name)}</strong> · ${new Date(m.createdAt).toLocaleString('zh-CN',{hour12:false})}<p>${escape(m.body)}</p><button data-decision="approved">通过公开</button> <button data-decision="declined">不公开</button> <span role="alert"></span></blockquote>`).join('')}`:''}</div>`);
  const form=document.querySelector<HTMLFormElement>('#lobby-message-form');
  if(form){
   const status=form.querySelector<HTMLElement>('#lobby-message-status')!;
   let busy=false;
   form.onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const input=Object.fromEntries(new FormData(form));
    const content=JSON.stringify(input),key=sessionStorage.getItem('lobby-message:'+content)||crypto.randomUUID();
    sessionStorage.setItem('lobby-message:'+content,key);
    busy=true;status.textContent='正在提交…';
    try{
     await api('/lobby/messages','POST',{name:input.name,body:input.body,confirmed:input.confirmed==='on',clientRequestId:key});
     sessionStorage.removeItem('lobby-message:'+content);
     status.textContent='已提交，等待负责人审核后公开。';form.reset();
    }catch(error){status.textContent=error instanceof Error?error.message:'提交失败，请重试。';}
    finally{busy=false;}
   };
  }
  for(const block of document.querySelectorAll<HTMLElement>('blockquote[data-id]'))
   for(const button of block.querySelectorAll<HTMLButtonElement>('button'))
    button.addEventListener('click',async()=>{
     try{await api(`/lobby/messages/${block.dataset.id}/review`,'POST',{status:button.dataset.decision,confirmed:true,version:Number(block.dataset.version)});void messagesPanel();}
     catch(error){(block.querySelector('[role=alert]') as HTMLElement).textContent=error instanceof Error?error.message:'操作失败';}
    });
 }catch(error){panel('访客留言板',`<p>${error instanceof Error?error.message:'读取失败，请重试。'}</p>`);}
}
function openExhibit(exhibit:LobbyExhibit){
 if(exhibit.kind==='cases'){void caseStudies.home();return;}
 if(exhibit.kind==='business'){void commercialDesk.home();return;}
 if(exhibit.kind==='navigation'){
  panel('总部导航',`<div class="company-introduction"><p class="exhibit-kicker">快速导航</p><h3>你要去哪里？</h3><div class="nav-actions"><button id="nav-reception">前台接待</button><button id="nav-gallery">作品展廊</button><button id="nav-data">实时数据</button><button id="nav-consulting">真人咨询</button><button id="nav-messages">访客留言板</button><button id="nav-upstairs">上二楼 / 三楼</button></div><p class="intro">这是空间导视，不会瞬移；请按提示步行前往。</p></div>`);
  const bind=(id:string,fn:()=>void)=>{const b=document.querySelector<HTMLButtonElement>('#'+id);if(b)b.onclick=fn;};
  bind('nav-reception',()=>notify('向前台走约 4 米，接待员在左侧。'));
  bind('nav-gallery',()=>{dialog.close();document.querySelector<HTMLButtonElement>('#works')?.click();});
  bind('nav-data',()=>{dialog.close();openExhibit({kind:'dashboard'});});
  bind('nav-consulting',()=>{dialog.close();openConsulting();});
  bind('nav-messages',()=>{dialog.close();void messagesPanel();});
  bind('nav-upstairs',()=>notify('沿右侧楼梯上二楼：内容房、员工工作区；三楼是管理与老板私室。'));
  return;
 }
 if(exhibit.kind==='dashboard'){
  void api<{publicProjects:number;confirmedDeliveries:number}>('/public/commercial-dashboard').then(d=>{
   panel('总部实时数据 · 公开口径',`<div class="company-introduction"><p class="exhibit-kicker">实时大屏</p><h3>只显示服务端真实计数</h3><p>授权公开项目 ${d.publicProjects} · 确认交付 ${d.confirmedDeliveries}</p><p>在线访客数来自当前实时会话；公开案例数来自案例库。交易金额、客户身份、对话内容与医疗资料不在公开范围。</p><p>收款方式为人工核验账本；AI 成本未接入，不虚构 Token 数据。</p></div>`);
  }).catch(()=>panel('总部实时数据','<p>实时数据暂不可用，请刷新后重试。</p>'));
  return;
 }
 if(exhibit.kind==='messages'){void messagesPanel();return;}
 if(exhibit.kind==='company'){
  panel('北京童医魔盒科技服务有限公司',`<div class="company-introduction"><p class="exhibit-kicker">公司介绍</p><h3>把真实问题，做成真实作品</h3><p>聚焦医疗与 AI，把专业经验转化为可使用的工具与服务。</p><h3>我们的愿景</h3><p>让人与自己信任的智能体协作，把想法做成真实成果。</p><h3>来到这里，可以做什么？</h3><p>在作品展区了解公开项目；到前台咨询 AI 工具辅导、网页应用制作，或预约会面。员工在内部办公区处理自己的任务，也可以授权自己的智能体协作。</p><button id="intro-projects">查看五个公开项目</button></div>`);
  $('#intro-projects').onclick=()=>{closePanel();$('#works').click();};return;
 }
 const project=projects.items[exhibit.projectIndex!];if(!project)return;
 panel(project.title,`<article class="project exhibit-detail"><img src="${project.image}" alt=""><div><span class="project-status">${escape(project.status)}</span><p>${escape(project.description)}</p></div></article><p class="intro">项目来源：个人官网公开信息 · 核对日期 ${projects.checkedAt}。</p><a class="source" href="${projects.source}" target="_blank" rel="noopener noreferrer">查看官网原始项目介绍 ↗</a>`);
}
$('#read-exhibit').onclick=()=>{if(nearbyExhibit)openExhibit(nearbyExhibit);};

let publishedDecoration:string|null=null,decorationSyncPending=false,decorationSyncTimer:ReturnType<typeof setInterval>|undefined;
async function syncDecoration(){
 if(decorationSyncPending)return;decorationSyncPending=true;
 try{const result=await api<{enabled:boolean;publicationId?:string|null;theme?:unknown;scene?:unknown;assetBase?:string|null}>('/decoration/published');if(result.enabled&&result.publicationId&&result.publicationId!==publishedDecoration){await hq.setTheme(result.theme,result.scene,result.assetBase);publishedDecoration=result.publicationId;notify('公司正式装修已更新，角色与工作状态保持原位。');}}
 catch(e){notify('装修同步失败，保留原场景：'+(e as Error).message);}
 finally{decorationSyncPending=false;}
}
window.addEventListener('pagehide',()=>{if(decorationSyncTimer)clearInterval(decorationSyncTimer);},{once:true});
async function boot(){
 try{
  hq=new Headquarters($('#world'));
  if(location.pathname==='/careers')recruitment.open(false);
  hq.onProximity=value=>{near=value;$('#interaction').hidden=!value||dialog.open||hq.mode==='overview'||hq.mode==='lobby';$('#location').textContent=hq.pos.y>6.4?'三楼 · 管理与老板私室':hq.pos.y>2.4?'二楼 · 内容房与员工工作区':hq.pos.x<-2.3?'一楼 · 接待大厅与作品展区':hq.pos.z>11.4?'总部入口与户外园区':'一楼 · 内部办公与会客区';document.body.dataset.cameraMode=hq.mode;for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===hq.mode));};
  hq.onExhibitInteract=openExhibit;
  hq.onBusinessInteract=()=>void commercialDesk.home();
  hq.onExhibitNear=exhibit=>{const changed=exhibit?.kind!==nearbyExhibit?.kind||exhibit?.projectIndex!==nearbyExhibit?.projectIndex;nearbyExhibit=exhibit;$('#exhibit-interaction').hidden=!exhibit||hq.paused||hq.mode==='overview'||hq.mode==='lobby';if(exhibit&&changed)$('#read-exhibit').textContent=exhibit.kind==='navigation'?'使用导航屏 · 前台/展廊/咨询':exhibit.kind==='cases'?'可信案例 · 我要类似项目':exhibit.kind==='business'?'商业项目 · 提交与审核':exhibit.kind==='company'?'阅读公司介绍':'阅读 · '+projects.items[exhibit.projectIndex!].title;};
  let movePending=false;
  hq.onMove=p=>{if(movePending||!session)return;movePending=true;pendingMove=(async()=>{try{const accepted=await api<Peer>('/presence','PUT',p);hq.applyPosition(accepted,false);}catch(e){$('#connection').textContent=(e as Error).message;$('#connection').classList.add('offline');try{hq.applyPosition(await api<Peer>('/presence'));}catch(recovery){notify((recovery as Error).message);}}finally{movePending=false;pendingMove=null;}})();};
  hq.onInteract=()=>void reception();hq.onContentInteract=()=>void content.openBoard();hq.onCompanyInteract=()=>companyDesk.home();
 hq.onActivityInteract=item=>{if(!item||item.accountId===content.account?.id){void companyDesk.delegation();return;}panel('同事的公开工作状态','<p>'+escape(item.name)+' 的智能体正在代班。正文、指令与结果仅本人可见。</p><button data-my-delegation>打开我的代班工作台</button>');document.querySelector<HTMLButtonElement>('[data-my-delegation]')!.onclick=()=>void companyDesk.delegation();};hq.onError=notify;
  await hq.load(text=>{$('#load-status').textContent=text;});
  hq.updateCases(null);void api<{items:{title:string;serviceType:string}[];updatedAt:string|null}>('/public/cases').then(data=>hq.updateCases({...data,publishedCases:data.items.length})).catch(()=>hq.updateCases(null));
  ready=true;appearance.disabled=false;$('#load-status').textContent='总部已就绪 · 开始后可自由走动';
  await syncDecoration();decorationSyncTimer=setInterval(()=>{if(!document.hidden)void syncDecoration();},5000);
  for(const id of ['enter-visitor','enter-owner','enter-employee','register-employee','employee-access'])$<HTMLButtonElement>('#'+id).disabled=false;
  $('#connection').textContent='总部就绪 · 等待入场';
  const shared=location.pathname.match(/^\/a\/([a-zA-Z0-9-]+)$/);
  if(shared)await content.openArticle(shared[1]);
  else if(new URLSearchParams(location.search).has('invite')){await enter(false);await content.openRegister();}
 }catch(e){hq?.dispose();$('#load-status').textContent=`总部加载失败：${(e as Error).message}`;$('#retry').hidden=false;$('#connection').textContent='画面尚未就绪';}
}
void boot();


