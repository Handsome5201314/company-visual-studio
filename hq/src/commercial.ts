type Api=<T=any>(path:string,method?:string,data?:unknown)=>Promise<T>;
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money=(v:number|null)=>v===null?'未接入':new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(v/100);
const labels:Record<string,string>={submitted:'待评估',quoted:'报价阶段','awaiting-payment':'待人工核验收款',active:'项目执行中',delivered:'待客户验收',accepted:'已验收',cancelled:'已取消',assigned:'待接任务',working:'进行中',review:'待QA',approved:'QA通过','changes-requested':'待修改',failed:'失败待恢复'};
type Options={api:Api;open:(title:string,html:string)=>HTMLElement;cleanup:(fn:()=>void)=>void;login:(after:()=>void)=>void;reception:()=>Promise<string>};
export function createCommercialDesk(o:Options){
 let generation=0;const pending=new Map<string,string>();
 async function identity(){return (await o.api('/auth/me')).account;}
 function show(title:string,html:string){generation++;const root=o.open(title,html);o.cleanup(()=>{generation++;});return root;}
 function form(root:HTMLElement,id:string,run:(f:FormData)=>Promise<void>){const f=root.querySelector<HTMLFormElement>('#'+id);if(!f)return;f.onsubmit=async e=>{e.preventDefault();const buttons=[...f.querySelectorAll<HTMLButtonElement>('button')];buttons.forEach(b=>b.disabled=true);const status=f.querySelector<HTMLElement>('[role=status]')!;status.textContent='正在保存…';try{await run(new FormData(f));}catch(e){status.textContent=(e as Error).message;buttons.forEach(b=>b.disabled=false);}};}
 const end='<button class="primary">确认保存</button><p role="status" aria-live="polite"></p></form>';
 async function action(type:string,args:object){const signature=JSON.stringify({type,args:{...args,receptionNonce:undefined}});const key=pending.get(signature)||crypto.randomUUID();pending.set(signature,key);const result=await o.api('/commercial/actions','POST',{type,args,idempotencyKey:key});pending.delete(signature);return result;}
 async function home(){
  const root=show('商业项目与交付','<p role="status">正在读取项目…</p>');const gen=generation;
  try{
   const a=await identity();if(gen!==generation)return;if(!a){root.innerHTML='<p>请使用现有公司账号登录，查看本人项目或经授权任务。首批客户账号采用受邀开通。</p><button id="commercial-login" class="primary">登录公司账号</button>';root.querySelector<HTMLButtonElement>('#commercial-login')!.onclick=()=>o.login(()=>void home());return;}
   const {items}=await o.api('/commercial');const d=await o.api('/commercial/dashboard');if(gen!==generation)return;
   root.innerHTML=`<p class="intro">商业海报委托 · ${esc(a.displayName)}<br>收款方式：人工凭证核验。正式报价和交付由老板确认。</p><div class="desk-actions"><button id="new-brief" class="primary">到前台提交海报需求</button><button id="refresh-projects">刷新</button></div><p>可见项目 ${d.visibleProjects} · 待QA ${d.pendingQa}${d.view==='ceo'?` · 已核验收入 ${money(d.verifiedRevenueCents)} · 应收 ${money(d.receivableCents)}`:''} · AI成本未接入</p>${items.length?items.map((p:any)=>`<article class="record"><h3>${esc(p.title)}</h3><p>${esc(labels[p.state]||p.state)} · v${p.version}</p><button data-project="${p.id}">打开项目</button></article>`).join(''):'<p>尚无可见项目。提交需求后才会在这里出现。</p>'}`;
   root.querySelector<HTMLButtonElement>('#new-brief')!.onclick=()=>void create();root.querySelector<HTMLButtonElement>('#refresh-projects')!.onclick=()=>void home();root.querySelectorAll<HTMLButtonElement>('[data-project]').forEach(b=>b.onclick=()=>void detail(b.dataset.project!));
  }catch(e){if(gen!==generation)return;root.innerHTML=`<p role="alert">${esc((e as Error).message)}</p><button id="retry-commerce">重试</button>`;root.querySelector<HTMLButtonElement>('button')!.onclick=()=>void home();}
 }
 async function create(){
  const root=show('提交商业海报需求',`<p>请确认资料可以交给公司项目成员；不要上传患者资料。</p><form id="brief"><label>需求标题<input name="title" maxlength="120" required></label><label>需求描述<textarea name="brief" maxlength="5000" required></textarea></label><label>交付物<input name="deliverable" value="商业海报与文案" maxlength="120" required></label><label>期望时间<input name="due" type="datetime-local" required></label><label>预算下限（元）<input name="min" type="number" min="0" step="0.01" required></label><label>预算上限（元）<input name="max" type="number" min="0" step="0.01" required></label><label>联系方式（选填）<input name="contact" maxlength="200"></label><label><input name="confirmed" type="checkbox" required>确认保存以上需求，并前往接待台登记</label>${end}`);
  const gen=generation;form(root,'brief',async f=>{const nonce=await o.reception();const r=await action('request.create',{title:f.get('title'),brief:f.get('brief'),deliverable:f.get('deliverable'),dueAt:new Date(String(f.get('due'))).toISOString(),budgetMinCents:Math.round(Number(f.get('min'))*100),budgetMaxCents:Math.round(Number(f.get('max'))*100),contact:f.get('contact'),confirmed:true,receptionNonce:nonce});if(gen===generation)await detail(r.projectId);});
 }
 
 async function detail(id:string){
  const root=show('项目工作台','<p role="status">正在读取项目与版本…</p>');const gen=generation;
  try{
   const p=await o.api('/commercial/projects/'+id);const a=await identity();if(gen!==generation)return;
   const change=async(type:string,extra:object={})=>{await action(type,{projectId:p.id,version:p.version,...extra});if(gen===generation)await detail(p.id);};
   root.innerHTML=`<button id="back-commerce">← 项目列表</button><button id="refresh-commerce">刷新项目状态</button><h3>${esc(p.title)}</h3><p>${esc(labels[p.state]||p.state)} · v${p.version}</p><p style="white-space:pre-wrap">${esc(p.brief)}</p><p>交付：${esc(p.deliverable)} · 期望：${esc(new Date(p.dueAt).toLocaleString())}</p>${p.finance?`<p>报价 ${money(p.finance.quoteCents)} · 合同 ${money(p.finance.contractCents)} · 应收 ${money(p.finance.receivableCents)}<br>已核验收款 ${money(p.finance.verifiedPaidCents)} · 退款 ${money(p.finance.refundCents)} · 已核验收入 ${money(p.finance.verifiedRevenueCents)}</p>`:''}<div id="commerce-work"></div><p id="commerce-error" role="alert"></p>`;
   root.querySelector<HTMLButtonElement>('#back-commerce')!.onclick=()=>void home();root.querySelector<HTMLButtonElement>('#refresh-commerce')!.onclick=()=>void detail(id);const work=root.querySelector<HTMLElement>('#commerce-work')!;
   function button(label:string,run:()=>Promise<void>){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await run();}catch(e){if(gen!==generation)return;root.querySelector('#commerce-error')!.textContent=(e as Error).message;b.disabled=false;}};work.append(b);}
   if(p.isOwner&&['submitted','quoted'].includes(p.state)){
    work.insertAdjacentHTML('beforeend',`<h3>报价草稿</h3><form id="quote"><label>报价（元）<input name="amount" type="number" min="0.01" step="0.01" required></label><label>范围与交付内容<textarea name="scope" required></textarea></label><label>交期<input name="due" type="datetime-local" required></label><label>验收口径<textarea name="acceptance" required></textarea></label><label>含修改次数<input name="revisions" type="number" value="1" min="0" max="20" required></label>${end}`);
    form(root,'quote',async f=>change('quote.draft',{amountCents:Math.round(Number(f.get('amount'))*100),scope:f.get('scope'),dueAt:new Date(String(f.get('due'))).toISOString(),acceptance:f.get('acceptance'),revisions:Number(f.get('revisions'))}));
   }
   if(p.quote){work.insertAdjacentHTML('beforeend',`<h3>当前报价 · ${esc(p.quoteApproved?'老板已确认':'待老板确认')}</h3><p>${money(p.quote.amountCents)} · ${esc(p.quote.scope)}<br>验收：${esc(p.quote.acceptance)} · 修改${p.quote.revisions}次<br>交期 ${esc(new Date(p.quote.dueAt).toLocaleString())}</p>`);
    if(p.isOwner&&p.state==='quoted'&&!p.quoteApproved)button('确认此版正式报价',()=>change('quote.approve',{quoteId:p.quote.id,confirmed:true}));
    if(p.isClient&&p.quoteApproved&&p.state==='quoted')button('接受此版报价与交期',()=>change('quote.accept',{quoteId:p.quote.id,confirmed:true}));
   }
   if(p.isOwner&&p.finance?.contractCents){
    work.insertAdjacentHTML('beforeend',`<h3>人工对账</h3><form id="ledger"><label>记录类型<select name="kind"><option value="receipt.verify">核验到账</option><option value="refund.verify">核验已执行退款</option><option value="cost.record">登记实际成本</option></select></label><label>金额（元）<input name="amount" type="number" min="0.01" step="0.01" required></label><label>凭证或流水引用<input name="evidence" maxlength="200" required></label><label>实际发生时间<input name="at" type="datetime-local" required></label><label><input type="checkbox" required>已人工核验，记录不会发起扣款、退款或开票</label>${end}`);
    form(root,'ledger',async f=>change(String(f.get('kind')),{amountCents:Math.round(Number(f.get('amount'))*100),evidence:f.get('evidence'),occurredAt:new Date(String(f.get('at'))).toISOString(),confirmed:true}));
    const staff=await o.api('/commercial/assignees');if(gen!==generation)return;
    const options=staff.items.map((e:any)=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
    work.insertAdjacentHTML('beforeend',`<h3>创建执行任务</h3><form id="new-task"><label>任务标题<input name="title" maxlength="120" required></label><label>负责人<select name="assignee">${options}</select></label><label>独立QA<select name="qa">${options}</select></label>${end}`);
    form(root,'new-task',async f=>change('task.create',{title:f.get('title'),assigneeId:f.get('assignee'),qaId:f.get('qa')}));
   }
   for(const t of p.tasks){
    work.insertAdjacentHTML('beforeend',`<article class="record"><h3>${esc(t.title)}</h3><p>${esc(labels[t.state]||t.state)} · v${t.version}</p><p>${esc(t.progress_note||'')}</p></article>`);
    if(t.assignee_id===a.id){
     if(['assigned','changes-requested','failed'].includes(t.state))button('接受任务：'+t.title,()=>change('task.accept',{taskId:t.id}));
     if(t.state==='working'){
      work.insertAdjacentHTML('beforeend',`<form id="submit-${t.id}"><label>提交文案<textarea name="text" maxlength="12000" required></textarea></label>${end}`);form(root,'submit-'+t.id,async f=>change('task.submit',{taskId:t.id,text:f.get('text')}));
      work.insertAdjacentHTML('beforeend',`<form id="image-${t.id}"><label>提交海报图片<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required></label>${end}`);form(root,'image-'+t.id,async f=>{const file=f.get('file') as File;const r=await fetch(`/api/commercial/projects/${p.id}/images?taskId=${t.id}`,{method:'POST',headers:{'Content-Type':file.type},body:file});const data=await r.json();if(!r.ok)throw Error(data.error);await change('task.submit',{taskId:t.id,artifactId:data.id});});
      button('授权本人智能体：'+t.title,async()=>{const g=await o.api('/commercial/grants','POST',{taskId:t.id,hours:1,confirmed:true});if(gen!==generation)return;const box=show('任务专用授权','<p>令牌仅显示一次，有效1小时。本人继续操作任务会撤销该任务现有代理授权。</p><label>任务令牌<input id="grant-token" readonly></label><button id="revoke-grant">撤销本次授权</button><p role="status"></p>');box.querySelector<HTMLInputElement>('input')!.value=g.token;box.querySelector<HTMLButtonElement>('button')!.onclick=async()=>{try{await o.api(`/commercial/grants/${g.id}/revoke`,'POST',{});box.querySelector('input')!.value='';box.querySelector('[role=status]')!.textContent='授权已撤销';}catch(e){box.querySelector('[role=status]')!.textContent=(e as Error).message;}};});
     }
    }
    if(t.state==='review'&&(p.isOwner||t.qa_id===a.id)&&t.assignee_id!==a.id){work.insertAdjacentHTML('beforeend',`<form id="qa-${t.id}"><label>审核结果<select name="decision"><option value="approved">通过</option><option value="changes-requested">要求修改</option></select></label><label>审核意见<textarea name="note" required></textarea></label>${end}`);form(root,'qa-'+t.id,async f=>change('task.qa',{taskId:t.id,artifactId:t.latest_artifact,decision:f.get('decision'),note:f.get('note')}));}
   }
   if(p.artifacts.length)work.insertAdjacentHTML('beforeend',`<h3>成果与参考资料</h3>${p.artifacts.map((a:any)=>`<p><a href="/api/commercial/artifacts/${a.id}" download>下载 ${esc(a.mime)} · v${a.version}</a><br><small class="artifact-checksum">SHA-256 ${esc(a.sha256)}</small></p>`).join('')}`);
   if(p.isClient&&['submitted','quoted'].includes(p.state)){work.insertAdjacentHTML('beforeend',`<form id="reference-image"><label>上传参考图（最大4MB）<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required></label>${end}`);form(root,'reference-image',async f=>{const file=f.get('file') as File;const r=await fetch(`/api/commercial/projects/${p.id}/images`,{method:'POST',headers:{'Content-Type':file.type},body:file});const data=await r.json();if(!r.ok)throw Error(data.error);if(gen===generation)await detail(p.id);});}
   if(p.isOwner&&p.state==='active'&&p.tasks.length&&p.tasks.every((t:any)=>t.state==='approved'))button('确认以上版本并交付给此项目客户',()=>change('delivery.release',{artifactIds:p.tasks.map((t:any)=>t.approved_artifact),recipientAccountId:p.clientId,confirmed:true}));
   const delivery=p.deliveries.at(-1);if(p.isClient&&p.state==='delivered'&&delivery){work.insertAdjacentHTML('beforeend',`<form id="accept"><label>验收结果<select name="type"><option value="delivery.accept">确认验收</option><option value="delivery.revise">申请修改</option></select></label><label>验收或修改意见<textarea name="note" required></textarea></label><label><input type="checkbox" required>我已核对此次交付版本</label>${end}`);form(root,'accept',async f=>change(String(f.get('type')),{deliveryId:delivery.id,note:f.get('note'),confirmed:true}));}
   if(p.isClient&&p.state==='accepted')button('允许公开计入匿名案例数量',()=>change('case.consent',{allowed:true}));
  }catch(e){if(gen!==generation)return;root.innerHTML=`<p role="alert">${esc((e as Error).message)}</p><button id="back-failed">返回项目列表</button>`;root.querySelector<HTMLButtonElement>('button')!.onclick=()=>void home();}
 }
 return {home,create};
}
