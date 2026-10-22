import './intake.css';
import type {CaseRequestSeed} from './case-studies';
type Api=<T=any>(path:string,method?:string,data?:unknown)=>Promise<T>;
type RequestRecord={id:string;service:string;name:string;brief:string;contact:string;sourceCaseTitle?:string;projectId?:string|null;status:string;reviewNote:string|null;version:number;createdAt:string};
type Appointment={id:string;requesterName:string;topic:string;contact:string;preferredAt:string;duration:number;mode:string;status:string;confirmedAt:string|null;meetingUrl:string|null;note:string;version:number};
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const date=(v:string)=>new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
const requestStates:Record<string,string>={submitted:'等待人工处理',reviewing:'正在处理','needs-info':'请补充资料',declined:'暂不承接'};
const bookingStates:Record<string,string>={requested:'等待确认',confirmed:'已确认',declined:'未接受',cancelled:'已取消'};
const serviceNames:Record<string,string>={'web-app':'网站与应用制作','ai-coaching':'AI 工具辅导'};
function beijingTime(value:unknown){
 const text=String(value??'');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text)||Number(text.slice(0,4))<1)throw new Error('请填写有效的北京时间，包括日期、小时和分钟');
 const local=text.length===16?text+':00':text,instant=new Date(local+'+08:00');
 if(!Number.isFinite(instant.getTime())||new Date(instant.getTime()+8*3600000).toISOString().slice(0,19)!==local)throw new Error('预约日期或时间无效，请重新填写');
 return instant.toISOString();
}
export function mountIntake(container:HTMLElement,{api,seed}:{api:Api;seed?:CaseRequestSeed}){
 let alive=true,generation=0;
 const drafts=new Map<'request'|'booking',Record<string,FormDataEntryValue>>(),submissionKeys=new Map<string,string>();
 const messageDrafts=new Map<string,string>(),messageKeys=new Map<string,string>();
 const render=(html:string)=>{container.innerHTML='<section class="intake">'+html+'</section>';};
 function error(e:unknown){return e instanceof Error?e.message:'操作未完成，请重试';}
 async function home(){
  const token=++generation;
  render('<p role="status">正在恢复你的公司会话…</p>');
  try{
   await api('/session','POST',{});const info=await api<{owner:boolean}>('/intake');
   if(!alive||generation!==token)return;
   render(`<p class="intake-eyebrow">童医魔盒 · 联系与预约</p><h2>把想法留下，我们一起确认下一步。</h2><p>无需等待 3D 场景或 AI 模型。信息仅本人和经授权的公司负责人可见，提交后等待人工确认范围、价格和时间。</p>${seed?`<p class="intake-seed">参考案例：${esc(seed.title)} · ${esc(seed.serviceType)}</p>`:''}<div class="intake-tabs"><button data-request>提交需求 / 留言</button><button data-booking>预约真人</button><button data-records>${info.owner?'待办与客户记录':'查看我的记录'}</button></div><div data-intake-body></div><p class="intake-footnote">匿名记录跟随此浏览器的公司会话保存；清除 Cookie 后无法凭匿名身份找回。请勿提交病历、患者信息、账号密码或密钥。</p>`);
   container.querySelector<HTMLButtonElement>('[data-request]')!.onclick=()=>form('request');
   container.querySelector<HTMLButtonElement>('[data-booking]')!.onclick=()=>form('booking');
   container.querySelector<HTMLButtonElement>('[data-records]')!.onclick=()=>void records();
   form('request');
  }catch(e){if(!alive||token!==generation)return;render(`<p class="intake-error" role="alert">${esc(error(e))}</p><button data-retry>重新连接</button>`);container.querySelector<HTMLButtonElement>('[data-retry]')!.onclick=()=>void home();}
 }
 function form(kind:'request'|'booking'){
  generation++;const slot=container.querySelector<HTMLElement>('[data-intake-body]')!;
  slot.innerHTML=`<form class="intake-form"><h3>${kind==='request'?'需求与留言':'申请预约'}</h3><div class="intake-grid"><label>你的称呼<input name="name" autocomplete="name" required maxlength="80"></label><label>联系方式<input name="contact" required maxlength="200" placeholder="邮箱、手机或方便联系的方式"></label></div>${kind==='request'?`<label>服务方向<select name="service"><option value="web-app">网站与应用制作</option><option value="ai-coaching">AI 工具辅导</option></select></label><label>希望解决的问题<textarea name="brief" required rows="5" maxlength="5000" placeholder="请描述目标、交付内容、期望时间与预算；也可以留下需要人工回复的问题。"></textarea></label>`:`<label>会面主题<textarea name="topic" required rows="3" maxlength="500"></textarea></label><div class="intake-grid"><label>期望时间（北京时间）<input name="preferredAt" type="datetime-local" required></label><label>时长<select name="duration"><option value="30">30 分钟</option><option value="15">15 分钟</option><option value="60">60 分钟</option></select></label></div><p>先申请公司在线文字会面。负责人确认后，可在记录中查看会面时间与会客室。</p>`}<label class="intake-consent"><input type="checkbox" name="confirmed" required>我同意公司保存本次联系信息，并由负责人联系我确认服务。本次登记不代表订单成立或完成付款。</label><p data-status role="status" aria-live="polite"></p><button class="intake-primary" type="submit">${kind==='request'?'确认提交':'提交预约申请'}</button></form>`;
  const node=slot.querySelector<HTMLFormElement>('form')!,status=node.querySelector<HTMLElement>('[data-status]')!;
  const draft=drafts.get(kind);
  if(draft)for(const [name,value] of Object.entries(draft)){const field=node.elements.namedItem(name);if(field instanceof HTMLInputElement&&field.type==='checkbox')field.checked=value==='on';else if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement||field instanceof HTMLSelectElement)field.value=String(value);}
  const remember=()=>drafts.set(kind,Object.fromEntries(new FormData(node)));
  node.oninput=remember;node.onchange=remember;
  let pending=false;
  node.onsubmit=async event=>{
   event.preventDefault();if(pending)return;
   const token=generation,input=Object.fromEntries(new FormData(node));drafts.set(kind,input);
   let data:Record<string,unknown>={...input,confirmed:input.confirmed==='on'};
   try{if(kind==='request'){if(seed)data.caseId=seed.caseId;}else{data.duration=Number(input.duration);data.mode='chat';data.preferredAt=beijingTime(input.preferredAt);}}
   catch(e){status.textContent=error(e);status.className='intake-error';return;}
   const content=JSON.stringify({kind,data}),key=submissionKeys.get(content)||crypto.randomUUID();submissionKeys.set(content,key);
   data={...data,[kind==='request'?'clientRequestId':'requestKey']:key};
   const controls=Array.from(node.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement|HTMLSelectElement>('input,button,textarea,select'));
   pending=true;controls.forEach(c=>c.disabled=true);status.textContent='正在保存，请稍候…';status.className='';
   try{
    const saved=await api<{id:string}>(kind==='request'?'/intake/requests':'/intake/appointments','POST',data);
    if(!alive||generation!==token||!node.isConnected)return;
    submissionKeys.delete(content);drafts.delete(kind);
    slot.innerHTML=`<div class="intake-saved"><h3>${kind==='request'?'需求已登记':'预约申请已保存'}</h3><p>登记号 ${esc(saved.id)}。${kind==='request'?'等待负责人审核和联系。':'等待负责人确认；请以记录里的确认时间为准。'}</p><button data-open-records>查看状态</button></div>`;
    slot.querySelector<HTMLButtonElement>('[data-open-records]')!.onclick=()=>void records();
   }catch(e){if(alive&&generation===token&&node.isConnected){status.textContent=error(e)+'；可保持原内容重试，或先查看记录确认是否已保存。';status.className='intake-error';}}
   finally{pending=false;if(node.isConnected)controls.forEach(c=>c.disabled=false);}
  };
 }
 async function records(){
  const token=++generation,slot=container.querySelector<HTMLElement>('[data-intake-body]')!;slot.innerHTML='<p role="status">正在读取记录…</p>';
  try{
   const data=await api<{requests:RequestRecord[];appointments:Appointment[];owner:boolean;source:string;updatedAt:string}>('/intake');
   if(!alive||token!==generation)return;
   slot.innerHTML=`<div class="intake-record-head"><h3>${data.owner?'客户待办':'我的记录'}</h3><button data-refresh>刷新状态</button></div><p class="intake-footnote">公司真实记录 · ${esc(date(data.updatedAt))} · 数据来源：公司接待记录</p><div data-record-list></div>`;
   slot.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>void records();
   const list=slot.querySelector<HTMLElement>('[data-record-list]')!;
   if(!data.requests.length&&!data.appointments.length)list.innerHTML='<p>还没有登记记录。可提交需求或申请一次真人预约。</p>';
   for(const r of data.requests){
    const article=document.createElement('article');article.className='intake-record';
    article.innerHTML=`<p class="intake-eyebrow">${esc(serviceNames[r.service]||r.service)} · ${esc(requestStates[r.status]||r.status)}</p><h4>${esc(r.name)} 的需求</h4><p class="intake-pre">${esc(r.brief)}</p>${r.sourceCaseTitle?`<p>参考案例：${esc(r.sourceCaseTitle)}</p>`:''}<p>联系方式：${esc(r.contact)}</p>${r.reviewNote?`<p class="intake-note">负责人回复：${esc(r.reviewNote)}</p>`:''}${r.projectId?`<p class="intake-note">${data.owner?`已转为正式商业项目：${esc(r.projectId)}`:'此需求已转为正式项目；负责人将向你提供项目登录方式。'}</p>`:''}<small>登记号 ${esc(r.id)} · 版本 ${r.version}</small>${data.owner?`<form data-review><label>处理状态<select name="status"><option value="reviewing">正在处理</option><option value="needs-info">需要补充</option><option value="declined">暂不承接</option></select></label><label>给客户的回复<textarea name="note" rows="2" maxlength="2000"></textarea></label><p role="alert"></p><button>保存回复</button></form>${r.projectId?'':`<form data-convert><h4>转为正式商业项目</h4><label>项目标题<input name="title" required maxlength="120"></label><label>交付物类型<input name="deliverable" required maxlength="120" placeholder="如：商业海报、企业网站、AI 工具"></label><div class="intake-grid"><label>交期（北京时间）<input type="datetime-local" name="dueAt" required></label><label>预算下限（元）<input type="number" name="budgetMin" min="0" step="0.01" required value="0"></label><label>预算上限（元）<input type="number" name="budgetMax" min="0" step="0.01" required></label></div><label class="intake-consent"><input type="checkbox" name="confirmed" required>确认为此需求立项；系统将为该客户创建登录账号，一次性密码仅显示一次，由我安全转交。</label><p role="alert"></p><button>立项并生成客户账号</button></form>`}`:''}`;
    if(data.owner){const f=article.querySelector<HTMLFormElement>('form[data-review]')!;(f.elements.namedItem('note') as HTMLTextAreaElement).value=r.reviewNote||'';if(r.status!=='submitted')(f.elements.namedItem('status') as HTMLSelectElement).value=r.status;bindReview(f,`/requests/${r.id}/review`,r.version);const c=article.querySelector<HTMLFormElement>('form[data-convert]');if(c)bindConvert(c,r);}
    list.append(article);
   }
   for(const b of data.appointments){
    const article=document.createElement('article');article.className='intake-record';
    const url=b.meetingUrl&&/^https:\/\/(?:[\w-]+\.)*(?:feishu\.cn|larksuite\.com)(?:\/|$)/.test(b.meetingUrl)?b.meetingUrl:null;
    article.innerHTML=`<p class="intake-eyebrow">预约 · ${esc(bookingStates[b.status]||b.status)}</p><h4>${esc(b.topic)}</h4><p>${esc(b.requesterName)} · ${esc(b.contact)}</p><p>期望 ${esc(date(b.preferredAt))} · ${b.duration} 分钟</p>${b.confirmedAt?`<p>已确认 ${esc(date(b.confirmedAt))}（北京时间）</p>`:''}${b.note?`<p class="intake-note">负责人回复：${esc(b.note)}</p>`:''}${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开负责人提供的会议链接</a>`:''}${b.status==='confirmed'?'<button data-room>进入文字会客室</button>':''}<small>登记号 ${esc(b.id)} · 版本 ${b.version}</small>${data.owner?`<form data-review><label>预约处理<select name="status"><option value="confirmed">确认文字会面</option><option value="declined">暂不接受</option><option value="cancelled">取消</option></select></label><label>确认时间（北京时间）<input type="datetime-local" name="confirmedAt"></label><label>给客户的说明<textarea name="note" maxlength="2000" rows="2"></textarea></label><p role="alert"></p><button>保存预约处理</button></form>`:''}`;
    if(data.owner){
     const f=article.querySelector<HTMLFormElement>('form')!,choice=f.elements.namedItem('status') as HTMLSelectElement,time=f.elements.namedItem('confirmedAt') as HTMLInputElement;
     const at=new Date(b.confirmedAt||b.preferredAt);time.value=Number.isFinite(at.getTime())?new Date(at.getTime()+8*3600000).toISOString().slice(0,16):'';
     (f.elements.namedItem('note') as HTMLTextAreaElement).value=b.note;
     const confirm=choice.querySelector<HTMLOptionElement>('[value="confirmed"]')!;
     confirm.textContent=b.mode==='chat'?'确认文字会面':b.mode==='feishu-voice'?'确认飞书语音会面':'确认飞书视频会面';
     const prompt=document.createElement('option');prompt.value='';prompt.textContent='请选择处理结果';prompt.disabled=true;choice.prepend(prompt);choice.required=true;
     const canConfirm=b.mode==='chat'||Boolean(b.meetingUrl);confirm.disabled=!canConfirm;
     choice.value=['confirmed','declined','cancelled'].includes(b.status)?b.status:'';
     const syncTime=()=>{time.disabled=choice.value!=='confirmed';time.required=choice.value==='confirmed';};choice.onchange=syncTime;syncTime();
     if(b.mode!=='chat'){const hint=document.createElement('p');hint.className='intake-footnote';hint.textContent=canConfirm?'此预约使用原有飞书会面方式，保存时保留已登记的会议链接。':'此预约尚无已登记的飞书会议链接。这里可以拒绝或取消，请到总部预约工作台填写会议链接后确认。';f.prepend(hint);}
     bindReview(f,`/meetings/${b.id}/review`,b.version,b);
    }
    article.querySelector<HTMLButtonElement>('[data-room]')?.addEventListener('click',()=>void room(b.id));list.append(article);
   }
  }catch(e){if(!alive||token!==generation)return;slot.innerHTML=`<p class="intake-error" role="alert">${esc(error(e))}</p><button data-retry>重新读取</button>`;slot.querySelector<HTMLButtonElement>('button')!.onclick=()=>void records();}
 }
 function bindReview(f:HTMLFormElement,path:string,version:number,booking?:Appointment){
  let pending=false;
  f.onsubmit=async e=>{
   e.preventDefault();if(pending)return;
   const token=generation,data:Record<string,unknown>={...Object.fromEntries(new FormData(f)),version},status=f.querySelector<HTMLElement>('[role=alert]')!;
   try{if(booking){data.mode=booking.mode;if(data.status==='confirmed'){data.confirmedAt=beijingTime(data.confirmedAt);if(booking.mode!=='chat'){if(!booking.meetingUrl)throw new Error('请先到总部预约工作台登记飞书会议链接');data.meetingUrl=booking.meetingUrl;}}else delete data.confirmedAt;}}
   catch(err){status.textContent=error(err);return;}
   const controls=Array.from(f.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement|HTMLSelectElement>('input,button,textarea,select')),disabled=controls.map(c=>c.disabled);
   pending=true;controls.forEach(c=>c.disabled=true);status.textContent='正在保存…';
   try{await api(path,'POST',data);if(alive&&token===generation&&f.isConnected)await records();}
   catch(err){if(alive&&token===generation&&f.isConnected)status.textContent=error(err);}
   finally{pending=false;if(f.isConnected)controls.forEach((c,i)=>c.disabled=disabled[i]);}
  };
 }
 const convertKeys=new Map<string,string>();
 function bindConvert(f:HTMLFormElement,r:RequestRecord){
  let pending=false;
  f.onsubmit=async e=>{
   e.preventDefault();if(pending)return;
   const token=generation,input=Object.fromEntries(new FormData(f)),status=f.querySelector<HTMLElement>('[role=alert]')!;
   let dueAt:string,budgetMinCents:number,budgetMaxCents:number;
   try{
    dueAt=beijingTime(input.dueAt);
    const yuan=(v:FormDataEntryValue)=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1000000)throw new Error('预算需在 0 到 100 万元之间');return Math.round(n*100);};
    budgetMinCents=yuan(input.budgetMin);budgetMaxCents=yuan(input.budgetMax);
    if(budgetMinCents>budgetMaxCents)throw new Error('预算下限不能高于上限');
   }catch(err){status.textContent=error(err);return;}
   const signature=JSON.stringify({id:r.id,title:input.title,deliverable:input.deliverable,dueAt,budgetMinCents,budgetMaxCents});
   const key=convertKeys.get(signature)||crypto.randomUUID();convertKeys.set(signature,key);
   const controls=Array.from(f.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button'));
   pending=true;controls.forEach(c=>c.disabled=true);status.textContent='正在立项，请稍候…';
   try{
    const result=await api<{projectId:string;clientAccount?:{username:string;password:string}}>(`/intake/requests/${r.id}/convert`,'POST',{version:r.version,confirmed:true,title:String(input.title),deliverable:String(input.deliverable),dueAt,budgetMinCents,budgetMaxCents,operationKey:key});
    if(!alive||generation!==token||!f.isConnected)return;
    convertKeys.delete(signature);
    if(result.clientAccount){
     const box=document.createElement('div');box.className='intake-credentials';
     box.innerHTML=`<h4>项目已创建</h4><p>项目号 ${esc(result.projectId)}</p><p>客户登录名 <code>${esc(result.clientAccount.username)}</code></p><p>一次性密码 <code>${esc(result.clientAccount.password)}</code></p><p class="intake-footnote">密码仅此一次显示，请立即通过已确认的联系方式安全转交客户；本页关闭后无法再次查看。后续报价、验收请在公司商业项目工作台继续。</p>`;
     f.replaceWith(box);
    }else{status.textContent='该需求此前已立项：'+result.projectId;(f.querySelector('button') as HTMLButtonElement).disabled=true;}
   }catch(err){if(alive&&generation===token&&f.isConnected)status.textContent=error(err)+'；同内容重试不会重复立项。';}
   finally{pending=false;if(f.isConnected)controls.forEach(c=>c.disabled=false);}
  };
 }
 async function room(id:string){
  const token=++generation,slot=container.querySelector<HTMLElement>('[data-intake-body]')!;slot.innerHTML='<p role="status">正在打开会客室…</p>';
  try{const result=await api<{booking:Appointment;items:{id:string;senderName:string;body:string;createdAt:string}[];before:string|null}>(`/meetings/${id}/room`);if(!alive||generation!==token)return;
   slot.innerHTML=`<h3>${esc(result.booking.topic)}</h3><p>文字会客室 · 消息仅本人与公司负责人可见</p><button data-refresh>刷新消息</button><div class="intake-messages">${result.items.map(m=>`<article><strong>${esc(m.senderName)}</strong><small>${esc(date(m.createdAt))}</small><p class="intake-pre">${esc(m.body)}</p></article>`).join('')||'<p>还没有消息。</p>'}</div>${result.before?'<p>当前显示最近 50 条消息，更早记录保留在公司系统。</p>':''}<form><label>发送消息<textarea name="body" maxlength="8000" required rows="3"></textarea></label><p role="alert"></p><button>发送</button></form>`;
   slot.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>void room(id);
   const f=slot.querySelector<HTMLFormElement>('form')!,input=f.elements.namedItem('body') as HTMLTextAreaElement;
   input.value=messageDrafts.get(id)||'';input.oninput=()=>{messageDrafts.set(id,input.value);};let pending=false;
   f.onsubmit=async e=>{
    e.preventDefault();if(pending)return;
    const view=generation,text=String(new FormData(f).get('body')),signature=JSON.stringify({id,text}),key=messageKeys.get(signature)||crypto.randomUUID();
    messageDrafts.set(id,text);messageKeys.set(signature,key);
    const controls=Array.from(f.querySelectorAll<HTMLTextAreaElement|HTMLButtonElement>('textarea,button')),status=f.querySelector<HTMLElement>('[role=alert]')!;
    pending=true;controls.forEach(c=>c.disabled=true);status.textContent='正在发送…';
    try{await api(`/meetings/${id}/messages`,'POST',{body:text,requestKey:key});if(alive&&view===generation&&f.isConnected){messageDrafts.delete(id);messageKeys.delete(signature);await room(id);}}
    catch(err){if(alive&&view===generation&&f.isConnected)status.textContent=error(err)+'；保留原文重试不会重复发送。';}
    finally{pending=false;if(f.isConnected)controls.forEach(c=>c.disabled=false);}
   };
  }catch(e){if(alive&&token===generation){slot.innerHTML=`<p role="alert">${esc(error(e))}</p><button data-retry>重新打开</button>`;slot.querySelector<HTMLButtonElement>('button')!.onclick=()=>void room(id);}}
 }
 void home();return {destroy(){alive=false;generation++;},records};
}
