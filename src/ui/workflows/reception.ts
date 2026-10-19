type Turn={clientMessageId:string;user:string;assistant:string;model:string;inputTokens:number|null;outputTokens:number|null};
export type ReceptionChat={turns:Turn[];configured:boolean;model:string|null;maxTurns:number};
type Api=<T>(path:string,method?:string,data?:unknown,signal?:AbortSignal)=>Promise<T>;
type SavedRequest={id:string;status:string;service:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Reception is reached through the world. Only the customer’s own words are
 * copied to the editable confirmation form; AI suggestions cannot become facts. */
export function renderReception({container,nonce,chat,api,onSaved,application=false}:{container:HTMLElement;nonce:string;chat:ReceptionChat;api:Api;onSaved:(record:SavedRequest)=>void;application?:boolean}){
 let disposed=false,controller:AbortController|undefined,lastAttempt:{id:string;content:string}|undefined;
 const q=<T extends HTMLElement=HTMLElement>(s:string)=>container.querySelector<T>(s)!;
 const modelLabel=chat.configured?'本机 AI 接待 · '+chat.model:'AI 接待尚未配置';
 container.innerHTML=`<section id="consultation"><p class="intro">${escape(modelLabel)}。可咨询 AI 工具辅导、网页应用，或登记医疗内容写手合作意向。报价、交期、录用和付费约稿均由老板确认。</p>
  <div id="chat-log" class="chat-log" role="log" aria-label="与 AI 接待员的私密咨询" aria-live="polite"></div>
  <form id="chat-form"><label for="chat-message">和接待员说说你的想法</label><textarea id="chat-message" rows="3" maxlength="1200" required placeholder="例如：我想做一个课程预约网页，方便学生选择时间。" ${chat.configured?'':'disabled'}></textarea>
  <p id="chat-error" class="error" role="alert"></p><p id="chat-status" class="chat-meta" role="status"></p>
  <div class="chat-actions"><button id="send-chat" class="primary" type="submit" ${chat.configured?'':'disabled'}>发送咨询</button><button id="cancel-chat" type="button" hidden>取消等待</button><button id="reset-chat" type="button">开始新的咨询</button><button id="chat-trash" type="button">咨询回收站</button></div></form><p class="chat-meta">开始新咨询后，旧咨询移入私有回收站，保留30天。</p><div id="chat-trash-items" role="status"></div>
  <div class="chat-next"><p>需求想清楚后，检查确认单。联系方式仅在确认单填写。</p><button id="prepare-intake" type="button">${chat.turns.length?'整理需求，查看确认单':'自行填写需求确认单'}</button></div></section>
  <section id="confirmation-form" hidden><p class="intro" id="intake-intro">下方只整理你说过的需求，没有加入 AI 的建议。请补充、修改后确认。咨询对话单独保存在本机，不会自动进入需求单。</p>
  <form id="intake"><label>想合作的事情<select name="service"><option value="ai-coaching">AI 工具辅导</option><option value="web-app">网页应用制作</option><option value="writer-application">医疗内容写手合作申请</option></select></label>
  <label>怎么称呼你<input name="name" autocomplete="name" maxlength="100" required placeholder="你的称呼"></label>
  <label><span id="intake-brief-label">你的需求</span><textarea name="brief" maxlength="5000" rows="5" required placeholder="想解决什么问题？现在做到哪一步？期望做成什么样？"></textarea></label>
  <label>联系方式<input name="contact" autocomplete="off" maxlength="200" required placeholder="邮箱，或你愿意提供的联系方式"></label>
  <label class="consent"><input name="confirmed" type="checkbox" required><span id="intake-consent">我确认保存以上内容，供我和老板查看。本次提交不代表已报价或成交。</span></label>
  <p id="submit-error" class="error" role="alert"></p><div class="chat-actions"><button class="primary" type="submit">确认需求，交给老板</button><button id="back-chat" type="button">返回咨询</button></div></form></section>`;
 function showTurns(){
  const log=q('#chat-log');log.replaceChildren();
  if(!chat.turns.length){const p=document.createElement('p');p.className='chat-empty';p.textContent=chat.configured?'你好，我是北京童医魔盒科技服务有限公司的 AI 接待员。想咨询服务，还是申请内容创作合作？':'暂时无法进行 AI 对话。你仍可在接待台自行填写服务需求或写手合作申请。';log.append(p);}
  for(const turn of chat.turns)for(const [role,text] of [['你',turn.user],['AI 接待员',turn.assistant]]){
   const article=document.createElement('article');article.className=role==='你'?'chat-turn customer':'chat-turn';
   const label=document.createElement('b'),p=document.createElement('p');label.textContent=role;p.textContent=text;article.append(label,p);log.append(article);
  }
  log.scrollTop=log.scrollHeight;
  q('#chat-status').textContent=`本次 ${chat.turns.length} / ${chat.maxTurns} 轮 · 对话按当前浏览器身份保存于本机`;
  q('#prepare-intake').textContent=chat.turns.length?'整理需求，查看确认单':'自行填写需求确认单';
  q<HTMLButtonElement>('#send-chat').disabled=!chat.configured||chat.turns.length>=chat.maxTurns;
 }
 showTurns();
 q<HTMLFormElement>('#chat-form').onsubmit=async event=>{
  event.preventDefault();if(controller||!chat.configured)return;
  const input=q<HTMLTextAreaElement>('#chat-message'),content=input.value.trim();if(!content)return;
  if(!lastAttempt||lastAttempt.content!==content)lastAttempt={id:crypto.randomUUID(),content};
  controller=new AbortController();const active=controller;
  q('#chat-error').textContent='';q('#chat-status').textContent='接待员正在思考，首次加载可能需要约一分钟。你可以取消等待。';
  q<HTMLButtonElement>('#send-chat').disabled=true;q<HTMLButtonElement>('#reset-chat').disabled=true;q<HTMLButtonElement>('#prepare-intake').disabled=true;input.disabled=true;q('#cancel-chat').hidden=false;
  try{
   chat=await api<ReceptionChat>('/reception/chat','POST',{receptionNonce:nonce,clientMessageId:lastAttempt.id,content},active.signal);
   if(disposed)return;input.value='';lastAttempt=undefined;showTurns();
  }catch(error){if(disposed)return;q('#chat-error').textContent=active.signal.aborted?'已取消等待。输入内容已保留，可重试发送。':(error as Error).message;q('#chat-status').textContent='未获得完整回答。可重试咨询，或自行填写需求确认单。';}
  finally{if(!disposed){input.disabled=false;q<HTMLButtonElement>('#send-chat').disabled=chat.turns.length>=chat.maxTurns;q<HTMLButtonElement>('#reset-chat').disabled=false;q<HTMLButtonElement>('#prepare-intake').disabled=false;q('#cancel-chat').hidden=true;controller=undefined;input.focus();}}
 };
 q('#cancel-chat').onclick=()=>controller?.abort();
 q('#reset-chat').onclick=async()=>{
  const button=q<HTMLButtonElement>('#reset-chat');if(button.disabled)return;button.disabled=true;q('#chat-error').textContent='';
  q<HTMLButtonElement>('#send-chat').disabled=true;q<HTMLButtonElement>('#prepare-intake').disabled=true;
  try{chat=await api<ReceptionChat>('/reception/reset','POST',{receptionNonce:nonce});if(disposed)return;lastAttempt=undefined;draftTurnCount=0;showTurns();q<HTMLTextAreaElement>('#chat-message').value='';}
  catch(error){if(!disposed)q('#chat-error').textContent=(error as Error).message;}
  finally{if(!disposed){button.disabled=false;q<HTMLButtonElement>('#send-chat').disabled=!chat.configured||chat.turns.length>=chat.maxTurns;q<HTMLButtonElement>('#prepare-intake').disabled=false;}}
 };
 q('#chat-trash').onclick=async()=>{
  const button=q<HTMLButtonElement>('#chat-trash');button.disabled=true;
  try{const result=await api<{items:{id:string;deletedAt:string;expiresAt:string;restorable:boolean}[]}>('/reception/trash');if(disposed)return;const box=q('#chat-trash-items');box.replaceChildren();if(!result.items.length)box.textContent='咨询回收站为空。';for(const item of result.items){const row=document.createElement('p'),b=document.createElement('button');row.textContent='旧咨询 · 到期 '+new Date(item.expiresAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+' ';b.textContent=item.restorable?'恢复咨询':'已到期';b.disabled=!item.restorable;row.append(b);box.append(row);b.onclick=async()=>{b.disabled=true;try{chat=await api<ReceptionChat>('/reception/trash/'+item.id+'/restore','POST',{receptionNonce:nonce});if(disposed)return;lastAttempt=undefined;draftTurnCount=0;showTurns();box.replaceChildren();q('#chat-status').textContent='旧咨询已恢复。';}catch(e){if(!disposed)q('#chat-error').textContent=(e as Error).message;b.disabled=false;}};}}catch(e){if(!disposed)q('#chat-error').textContent=(e as Error).message;}finally{if(!disposed)button.disabled=false;}
 };
 let draftTurnCount=0;
 q('#prepare-intake').onclick=()=>{
  const brief=q<HTMLTextAreaElement>('[name="brief"]');
  const added=chat.turns.slice(draftTurnCount).map(t=>t.user).join('\n\n');
  if(added){brief.value=[brief.value,added].filter(Boolean).join('\n\n');q<HTMLInputElement>('[name="confirmed"]').checked=false;}
  draftTurnCount=chat.turns.length;
  brief.setCustomValidity(brief.value.length>5000?'请将需求精简到5000字以内，再确认保存':'');
  q('#consultation').hidden=true;q('#confirmation-form').hidden=false;q<HTMLInputElement>('[name="name"]').focus();
 };
 q<HTMLTextAreaElement>('[name="brief"]').oninput=event=>{const el=event.target as HTMLTextAreaElement;el.setCustomValidity(el.value.length>5000?'请将需求精简到5000字以内，再确认保存':'');};
 q('#back-chat').onclick=()=>{q('#consultation').hidden=false;q('#confirmation-form').hidden=true;q<HTMLTextAreaElement>('#chat-message').focus();};
 q<HTMLSelectElement>('[name="service"]').onchange=()=>{
  const application=q<HTMLSelectElement>('[name="service"]').value==='writer-application';
  q('#intake-brief-label').textContent=application?'写作经历、合作方向与作品链接':'你的需求';
  q<HTMLTextAreaElement>('[name="brief"]').placeholder=application?'想写哪个方向？有哪些相关经历？可以附公开作品链接，请勿填写患者资料。':'想解决什么问题？现在做到哪一步？期望做成什么样？';
  q('#intake-consent').textContent=application?'我同意将以上申请资料保存，供我和老板查看、联系。提交不代表录用、入职或已获得付费约稿名额。':'我确认保存以上内容，供我和老板查看。本次提交不代表已报价或成交。';
  q('#intake-intro').textContent=application?'请填写你的写作经历、合作方向和公开作品链接。下方如有咨询内容，仅整理你自己的话；AI 建议不会自动写入申请。资料仅供你和老板查看、联系。':'下方只整理你说过的需求，没有加入 AI 的建议。请补充、修改后确认。咨询对话单独保存在本机，不会自动进入需求单。';
  q<HTMLButtonElement>('#intake [type="submit"]').textContent=application?'提交合作申请':'确认需求，交给老板';
  q<HTMLInputElement>('[name="confirmed"]').checked=false;
 };
 const clientRequestId=crypto.randomUUID();
 q<HTMLFormElement>('#intake').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget as HTMLFormElement,button=form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  if(button.disabled)return;button.disabled=true;const application=q<HTMLSelectElement>('[name="service"]').value==='writer-application';button.textContent=application?'正在提交合作申请…':'正在保存需求…';q('#submit-error').textContent='';
  const data=Object.fromEntries(new FormData(form));
  const fields=form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|HTMLButtonElement>('input,textarea,select,button');fields.forEach(el=>el.disabled=true);
  try{const record=await api<SavedRequest>(application?'/recruitment/applications':'/requests','POST',{...data,confirmed:data.confirmed==='on',clientRequestId,receptionNonce:nonce});if(!disposed)onSaved({...record,service:application?'writer-application':record.service});}
  catch(error){if(!disposed){q('#submit-error').textContent=(error as Error).message;fields.forEach(el=>el.disabled=false);button.textContent=application?'重试提交合作申请':'重试保存需求';}}
 };
 if(application){const select=q<HTMLSelectElement>('[name="service"]');select.value='writer-application';select.dispatchEvent(new Event('change'));q<HTMLButtonElement>('#prepare-intake').click();}
 return ()=>{disposed=true;controller?.abort();};
}
