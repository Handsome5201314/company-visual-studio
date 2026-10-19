import '../recruitment.css';

type Options={apply:()=>Promise<void>;login:()=>Promise<void>;applications:()=>Promise<void>;pause:(value:boolean)=>void};

/** Public information column. Job applications are confirmed at the in-world reception. */
export function createRecruitmentPage(options:Options){
 const root=document.createElement('section');root.className='careers-page';root.hidden=true;root.setAttribute('aria-labelledby','careers-title');
 root.innerHTML=`<div class="careers-heading"><div><h2 id="careers-title" tabindex="-1">北京童医魔盒科技服务有限公司<br><strong>诚招英才</strong></h2><p>医疗内容创作者招募 · 线上合作</p></div><button data-close>返回公司</button></div>
 <div class="careers-layout"><div class="careers-copy">
 <section><h3>把医疗经历，写成值得阅读的作品。</h3><p>招募医疗故事与行业内容写手。欢迎有医学背景，或擅长采访、叙事与核查公开资料的创作者。首批采用定向邀请，先登记合作意向，由老板审核后联系。</p></section>
 <section><h3>正在招募的创作方向</h3><dl class="careers-directions"><dt>医生故事</dt><dd>有完整叙事的医疗职业与成长故事，写清真实经历与虚构创作的边界。</dd><dt>医疗八卦与短篇分享</dt><dd>行业见闻、职场趣事、职业讨论、短故事。涉及具体人物、争议或秘闻，须说明来源，不以未经核实的传言作为事实。</dd><dt>AI 与医疗</dt><dd>AI 工具实践、医疗行业的技术应用与公开研究解读，区分经验、观点和已核实事实。</dd></dl><p>内容按板块展示；长篇故事与短篇分享是计酬类型，由老板在约稿时确认，不能仅凭所属板块判定。</p></section>
 <section><h3>怎样合作</h3><ol><li>以角色进入公司，到一楼接待台提交写作经历、方向和作品链接。</li><li>老板审核并联系；确认合作及付费名额后，发放一次性邀请码。</li><li>受邀注册写手账号，在公司内填写标题、正文并上传配图。</li><li>AI 提供初审意见；老板在公司内终审，批准后才正式公开。原稿与建议改稿分别保存；飞书机器人审批尚未接入。</li></ol><p>线上内容创作合作，提交申请不代表录用或建立劳动关系。合作方式、约稿范围与计酬类型由双方确认。</p></section>
 <section><h3>投稿要求</h3><ul><li>原创或取得授权，公开报道与研究解读应提供可核查的来源。</li><li>不得提交患者身份、病历、未获授权的照片或可识别的隐私资料。</li><li>个人经历、虚构故事与事实报道应明确区分；AI 初审不能代替人工核实。</li></ul></section>
 </div><aside class="careers-terms" aria-label="稿酬与申请"><h3>试运营稿酬方案</h3><p class="careers-availability">正在招募合作写手。已提供有效阅读、稿酬台账与人工付款确认。付费约稿须由老板逐篇确认长短篇类型与名额，确认后预留最高稿酬；旧稿不追溯计酬。</p><dl><dt>长篇故事</dt><dd>终审通过并正式发布后，基础稿酬5元；每新增500次有效阅读加1元，单篇合计最高20元。</dd><dt>短篇分享</dt><dd>每新增500次有效阅读奖励1元，单篇最高5元，无基础稿酬。</dd><dt>统计周期</dt><dd>发布后30天。正文在前台可见并累计停留至少10秒是有效阅读的时间条件；同一登录账号或匿名浏览器对同篇去重，作者和老板自读不计；匿名识别按浏览器近似去重，不等于真人实名核验。</dd><dt>预算与付款</dt><dd>稿酬预算500元／月，与技术费用分开。付费名额确认时预留最高奖励；预算不足暂停新增名额。发布后基础稿酬计入应付，流量奖励达标后计入应付，由老板人工付款并确认。</dd></dl><p>已获得的奖励按约定支付。跨月仍计入原预算月；撤稿不自动扣回已经产生的应付，异常由老板处理。申请不产生稿酬。</p><div class="careers-actions"><button class="primary" data-apply>进入公司，到前台申请</button><button data-applications>我的合作申请</button><button data-login>已有邀请码／账号</button></div><p data-error class="error" role="alert"></p></aside></div>`;
 document.querySelector('#app')!.append(root);
 let trigger:HTMLElement|null=null;
 function setOpen(open:boolean){root.hidden=!open;for(const id of ['world','entry','mission','camera-controls','interaction','guide','touch']){const el=document.getElementById(id);if(el)el.inert=open;}options.pause(open);if(open)root.querySelector<HTMLElement>('#careers-title')!.focus();else trigger?.focus();}
 function open(push=true){trigger=document.activeElement as HTMLElement;if(push&&location.pathname!=='/careers')history.pushState({careers:true},'','/careers');setOpen(true);}
 function close(){if(root.hidden)return;setOpen(false);if(location.pathname==='/careers')history.replaceState(null,'','/');}
 root.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;
 for(const [selector,action] of [['[data-apply]',options.apply],['[data-applications]',options.applications],['[data-login]',options.login]] as const){
  const button=root.querySelector<HTMLButtonElement>(selector)!;
  button.onclick=async()=>{button.disabled=true;root.querySelector('[data-error]')!.textContent='';try{await action();close();}catch(e){root.querySelector('[data-error]')!.textContent=(e as Error).message;}finally{button.disabled=false;}};
 }
 window.addEventListener('popstate',()=>{if(location.pathname==='/careers')open(false);else if(!root.hidden)setOpen(false);});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
 return {open,close,isOpen:()=>!root.hidden};
}
