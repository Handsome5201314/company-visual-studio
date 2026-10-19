type Api=<T>(path:string,method?:string,data?:unknown)=>Promise<T>;
type Application={id:string;name:string;contact:string;brief:string;status:string;reviewNote:string|null;version:number;createdAt:string;onboarding:null|{status:string;note:string;version:number}};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const labels:Record<string,string>={submitted:'待老板审核',reviewing:'审核中', 'needs-info':'需要补充资料',declined:'暂不合作'};

export async function openApplications({api,show,owner,invite}:{api:Api;show:(title:string,html:string)=>HTMLElement;owner:boolean;invite:()=>void}){
 const root=show(owner?'招聘 · 合作申请':'我的合作申请','<p role="status">正在读取合作申请…</p>');
 const loading=root.firstChild;
 try{
  const {items}=await api<{items:Application[]}>('/recruitment/applications');
  if(!root.isConnected||root.firstChild!==loading)return;
  root.innerHTML=`<div class="application-note">${owner?'审核申请 → 实际面试并记录结论 → 确认合作范围 → 生成指定申请的入驻邀请。注册后回写入驻状态，不自动产生稿酬。<br><button data-invite>其他指定写手邀请</button>':'申请仅你和老板可见。申请跟随当前浏览器，请保留 Cookie；老板通过留下的联系方式联系。'}</div><div data-items></div><p data-error class="error" role="alert"></p>`;
  root.querySelector<HTMLButtonElement>('[data-invite]')?.addEventListener('click',invite);
  if(!items.length){root.querySelector('[data-items]')!.innerHTML='<p class="empty">还没有合作申请。请从“招聘信息”了解岗位并到一楼前台登记。</p>';return;}
  for(const item of items){
   const row=document.createElement('article');row.className='application-row';
   row.innerHTML=`<div class="request-heading"><h3>医疗内容写手 · ${esc(item.name)}</h3><span class="status">${esc(labels[item.status])}</span></div><p class="request-brief">${esc(item.brief)}</p><dl><dt>联系方式</dt><dd>${esc(item.contact)}</dd><dt>申请时间</dt><dd>${new Date(item.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</dd></dl>${item.reviewNote?`<p class="review-note">老板回复：${esc(item.reviewNote)}</p>`:''}`;
   if(owner){
    const form=document.createElement('form');form.className='review-form';form.innerHTML='<label>审核状态<select name="status"><option value="reviewing">审核中</option><option value="needs-info">需要补充资料</option><option value="declined">暂不合作</option></select></label><label>给申请人的回复<textarea name="note" rows="3" maxlength="2000"></textarea></label><p class="error" role="alert"></p><button type="submit">保存审核回复</button>';
    (form.elements.namedItem('status') as HTMLSelectElement).value=item.status==='submitted'?'reviewing':item.status;
    (form.elements.namedItem('note') as HTMLTextAreaElement).value=item.reviewNote||'';
    form.onsubmit=async e=>{e.preventDefault();const fields=[...form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|HTMLButtonElement>('input,textarea,select,button')];const input=Object.fromEntries(new FormData(form));fields.forEach(f=>f.disabled=true);try{const saved=await api<Application>('/recruitment/applications/'+item.id+'/review','POST',{...input,version:item.version});Object.assign(item,saved);row.querySelector('.status')!.textContent=labels[item.status];form.querySelector('[role="alert"]')!.textContent='已保存。申请人可在自己的合作申请中查看回复。';}catch(e){form.querySelector('[role="alert"]')!.textContent=(e as Error).message;}finally{fields.forEach(f=>f.disabled=false);}};
    row.append(form);
   }
   root.querySelector('[data-items]')!.append(row);
   if(item.onboarding){const info=document.createElement('p');info.className='review-note';info.textContent='合作进展：'+({interviewed:'面试已记录 · 等待合作邀请',invited:'已发入驻邀请',joined:'已受邀注册入驻',declined:'本次暂不继续'}[item.onboarding.status]||item.onboarding.status)+'。面试说明：'+item.onboarding.note;row.append(info);}
   if(owner&&item.onboarding?.status!=='joined'){
    const section=document.createElement('section');section.className='application-onboarding';
    section.innerHTML=`${!item.onboarding||['interviewed','declined'].includes(item.onboarding.status)?'<form data-interview class="review-form"><label>实际面试结论<select name="outcome"><option value="continue">继续合作</option><option value="decline">暂不继续</option></select></label><label>面试记录（申请人可见）<textarea name="note" required maxlength="2000" rows="3"></textarea></label><button>保存面试结论</button></form>':''}${item.onboarding&&['interviewed','invited'].includes(item.onboarding.status)?`<form data-offer><p>${item.onboarding.status==='invited'?'重新生成会使之前未使用的邀请码失效。':''}</p><label><input name="confirmed" type="checkbox" required> 我已与申请人沟通合作范围；邀请入驻不自动确认稿酬</label><button>生成${item.onboarding.status==='invited'?'替换':'合作'}邀请</button></form><div data-offer-link></div>`:''}<p data-onboard-error class="error" role="alert"></p>`;
    const report=(e:unknown)=>{section.querySelector('[data-onboard-error]')!.textContent=(e as Error).message;};
    const interview=section.querySelector<HTMLFormElement>('[data-interview]');if(interview)interview.onsubmit=async e=>{e.preventDefault();const b=interview.querySelector('button')!;b.disabled=true;try{await api('/recruitment/applications/'+item.id+'/interview','POST',{...Object.fromEntries(new FormData(interview)),applicationVersion:item.version,version:item.onboarding?.version||0});await openApplications({api,show,owner,invite});}catch(e){report(e);b.disabled=false;}};
    const offer=section.querySelector<HTMLFormElement>('[data-offer]');if(offer)offer.onsubmit=async e=>{e.preventDefault();const b=offer.querySelector('button')!;b.disabled=true;try{const result=await api<{code:string}>('/recruitment/applications/'+item.id+'/invite','POST',{version:item.onboarding!.version,confirmed:true});const cfg=await api<{shareOrigin:string|null}>('/public/config'),url=new URL('/',cfg.shareOrigin||location.origin);url.searchParams.set('invite',result.code);section.querySelector('[data-offer-link]')!.innerHTML=`<label>一次性入驻链接（仅本次显示，请自行发给申请人）<input readonly value="${esc(url.href)}"></label><p>对方受邀注册后，此申请会更新为已入驻。不要把邀请链接公开发布。</p>`;}catch(e){report(e);b.disabled=false;}};
    row.append(section);
   }
  }
 }catch(e){if(root.isConnected&&root.firstChild===loading){root.innerHTML='<p class="error" role="alert"></p><button data-retry>重新读取申请</button>';root.querySelector('[role="alert"]')!.textContent=(e as Error).message;root.querySelector<HTMLButtonElement>('[data-retry]')!.onclick=()=>void openApplications({api,show,owner,invite});}}
}
