import './case-studies.css';

type Api = <T = any>(path: string, method?: string, data?: unknown) => Promise<T>;
export type CaseRequestSeed = { caseId: string; title: string; serviceType: string };
type RequestHandler = (seed: CaseRequestSeed) => void | Promise<void>;
type SourceKind = 'analytics' | 'third-party-estimate' | 'manual-statement';
type Metric = { label: string; value: number; unit: string; sourceKind: SourceKind; sourceLabel: string; periodStart: string; periodEnd: string };
type CaseState = 'DRAFT' | 'EVIDENCE_PENDING' | 'APPROVED_FOR_PUBLICATION' | 'PUBLISHED' | 'ARCHIVED';
type CaseRecord = {
  id: string; title: string; serviceType: string; summary: string; responsibility: string; deliverables: string;
  completedAt: string; demoUrl?: string; repositoryUrl?: string; metrics: Metric[]; imageUrl?: string | null;
  version: number; publishedAt?: string | null; updatedAt?: string; source?: string; dataMode: 'REAL' | 'DEMO';
};
type Evidence = { id: string; kind: string; reference: string; note: string; scope: string; verifiedAt: string | null; verifiedBy: string | null };
type InternalCase = CaseRecord & { state: CaseState; sourceProjectId?: string; evidence: Evidence[]; image: { sha256: string; bytes: number; mime: string } | null };
type Options = {
  api: Api; open: (title: string, html: string) => HTMLElement; cleanup: (fn: () => void) => void;
  login: (after: () => void) => void; onRequest?: RequestHandler;
};
export type CaseStudiesDesk = ReturnType<typeof createCaseStudiesDesk>;

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const states: Record<CaseState, string> = { DRAFT: '草稿', EVIDENCE_PENDING: '待核验与审核', APPROVED_FOR_PUBLICATION: '已批准，待发布', PUBLISHED: '已公开', ARCHIVED: '已撤下' };
const sourceLabels: Record<SourceKind, string> = { analytics: '实际观测', 'third-party-estimate': '第三方估算', 'manual-statement': '人工陈述' };
const evidenceLabels: Record<string, string> = { delivery: '交付成果', 'client-consent': '展示同意', contract: '合同', receipt: '收款凭证', metric: '指标依据', other: '其他资料' };
const errorText = (error: unknown) => error instanceof Error ? error.message : '请求未完成，请重试。';
const dateText = (value?: string | null) => {
  if (!value) return '未记录';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replaceAll('-', '/');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '日期不可用' : date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
const dateInput = (value?: string) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const periodText = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateText(value) : new Date(value).toLocaleString('zh-CN', { timeZoneName: 'short' });
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
function externalLink(url: string | undefined, title: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return '';
    return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(title)} <span aria-hidden="true">↗</span><span class="case-sr">（新窗口）</span></a>`;
  } catch { return ''; }
}
function badge(item: CaseRecord) { return `<span class="case-badge${item.dataMode === 'DEMO' ? ' case-badge-demo' : ''}">${item.dataMode === 'DEMO' ? '演示 · 不可公开' : '真实交付'}</span>`; }
function metricsMarkup(metrics: Metric[]) {
  if (!metrics.length) return '<p class="case-muted">此案例未公布量化指标。</p>';
  return `<div class="case-metrics">${metrics.map(m => `<div class="case-metric"><h4>${esc(m.label)}</h4><p class="case-metric-value">${esc(new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(m.value))}<span>${esc(m.unit)}</span></p><p><strong>${esc(sourceLabels[m.sourceKind] || '来源待核对')}</strong> · ${esc(m.sourceLabel)}</p><p class="case-muted">${esc(periodText(m.periodStart))} — ${esc(periodText(m.periodEnd))}</p></div>`).join('')}</div><p class="case-caption">观测数据、第三方估算与人工陈述按来源分别标注；不同来源的数字不等同。</p>`;
}
function publicContent(item: CaseRecord, includeImage = true) {
  // Only these public fields are rendered; private evidence and project references never enter the public view.
  return `<div class="case-facts-head"><p class="case-eyebrow">${esc(item.serviceType)} ${badge(item)}</p><h3 class="case-title">${esc(item.title)}</h3><p class="case-summary">${esc(item.summary)}</p></div>${includeImage && item.imageUrl ? `<figure class="case-image"><img src="/api/public/cases/${encodeURIComponent(item.id)}/image" alt="${esc(item.title)}的获准展示成果" loading="lazy"><figcaption>获准展示的交付成果</figcaption></figure>` : ''}<dl class="case-facts"><div><dt>我们的职责</dt><dd>${esc(item.responsibility)}</dd></div><div><dt>交付内容</dt><dd>${esc(item.deliverables)}</dd></div><div><dt>完成日期</dt><dd>${esc(dateText(item.completedAt))}</dd></div></dl><section class="case-section"><h3>结果与依据</h3>${metricsMarkup(item.metrics)}</section><div class="case-links">${externalLink(item.demoUrl, '查看演示')}${externalLink(item.repositoryUrl, '查看代码仓库')}</div><p class="case-caption">案例版本 ${esc(item.version)}${item.publishedAt ? ` · 发布于 ${esc(dateText(item.publishedAt))}` : ''}${item.updatedAt ? ` · 更新于 ${esc(dateText(item.updatedAt))}` : ''}</p>`;
}

export function createCaseStudiesDesk(o: Options) {
  let generation = 0;
  let destroyed = false;
  let uploadController: AbortController | null = null;
  const previewUrls = new Set<string>();
  const pending = new Map<string, string>();
  function invalidate() { generation++; uploadController?.abort(); uploadController = null; previewUrls.forEach(url => URL.revokeObjectURL(url)); previewUrls.clear(); }
  function show(title: string, html: string) {
    invalidate();
    const host = o.open(title, `<div class="case-studies">${html}</div>`);
    o.cleanup(invalidate);
    return host.querySelector<HTMLElement>('.case-studies') || host;
  }
  const current = (gen: number) => !destroyed && gen === generation;
  const loading = '<p class="case-loading" role="status" aria-live="polite">正在读取案例…</p>';
  async function identity() { return (await o.api('/auth/me')).account as { id: string; role: string; displayName?: string } | null; }
  async function action(type: string, args: object) {
    const signature = JSON.stringify({ type, args });
    const key = pending.get(signature) || crypto.randomUUID();
    pending.set(signature, key);
    const result = await o.api<{ operationId: string; caseId: string; version: number; state: CaseState }>('/cases/actions', 'POST', { type, args, idempotencyKey: key });
    if (!result?.operationId || !result.caseId || !Number.isSafeInteger(result.version)) throw new Error('服务未返回可确认的操作结果，请重试同一操作。');
    pending.delete(signature);
    return result;
  }
  function fail(root: HTMLElement, error: unknown, retry: () => void) {
    root.innerHTML = `<div class="case-feedback case-error" role="alert"><h3>暂时无法读取</h3><p>${esc(errorText(error))}</p></div><div class="case-actions"><button type="button" data-retry>重试</button><button type="button" data-home>返回案例列表</button></div>`;
    root.querySelector<HTMLButtonElement>('[data-retry]')!.onclick = retry;
    root.querySelector<HTMLButtonElement>('[data-home]')!.onclick = () => void home();
  }
  function images(root: HTMLElement) {
    root.querySelectorAll<HTMLImageElement>('.case-image img, .case-thumbnail img').forEach(img => {
      img.onerror = () => { const message = document.createElement('p'); message.className = 'case-image-failed'; message.textContent = '成果图片暂时无法加载，可刷新重试。'; img.replaceWith(message); };
    });
  }
  function requestButton(root: HTMLElement, item: CaseRecord) {
    const button = root.querySelector<HTMLButtonElement>('[data-request]');
    if (!button || !o.onRequest) return;
    const gen = generation;
    button.onclick = async () => {
      button.disabled = true;
      const status = root.querySelector<HTMLElement>('[data-request-status]')!;
      status.textContent = '正在打开需求入口…';
      try { await o.onRequest!({ caseId: item.id, title: item.title, serviceType: item.serviceType }); if (current(gen)) status.textContent = ''; }
      catch (error) { if (current(gen)) status.textContent = errorText(error); }
      finally { if (current(gen)) button.disabled = false; }
    };
  }
  function bindForm(root: HTMLElement, name: string, run: (data: FormData, form: HTMLFormElement) => Promise<void>) {
    const form = root.querySelector<HTMLFormElement>(`form[data-form="${name}"]`);
    if (!form) return;
    const gen = generation;
    form.onsubmit = async event => {
      event.preventDefault();
      if (form.getAttribute('aria-busy') === 'true') return;
      const data = new FormData(form);
      const controls = [...root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('button,input,select,textarea')];
      const prior = controls.map(control => control.disabled);
      controls.forEach(control => control.disabled = true);
      form.setAttribute('aria-busy', 'true');
      const status = form.querySelector<HTMLElement>('[role="status"]')!;
      status.textContent = '正在保存，请稍候…';
      try { await run(data, form); }
      catch (error) {
        if (current(gen)) { status.textContent = `${errorText(error)} 未确认的操作可直接重试。`; status.classList.add('case-error-text'); }
      } finally {
        if (current(gen)) { form.removeAttribute('aria-busy'); controls.forEach((control, index) => control.disabled = prior[index]); }
      }
    };
  }
  const formEnd = (label: string) => `<button class="case-primary" type="submit">${label}</button><p class="case-status" role="status" aria-live="polite"></p></form>`;
  async function ensureOwner(root: HTMLElement, gen: number, resume: () => void) {
    const account = await identity();
    if (!current(gen)) return false;
    if (!account) {
      root.innerHTML = '<div class="case-feedback"><h3>登录后管理案例</h3><p>案例编辑、证据核验与公开发布由公司负责人操作。</p><button class="case-primary" type="button" data-login>登录公司账号</button></div>';
      root.querySelector<HTMLButtonElement>('[data-login]')!.onclick = () => o.login(resume);
      return false;
    }
    if (account.role !== 'owner') {
      root.innerHTML = '<div class="case-feedback"><h3>此账号没有案例管理权限</h3><p>你仍可以查看获准公开的案例。</p><button type="button" data-home>查看公开案例</button></div>';
      root.querySelector<HTMLButtonElement>('[data-home]')!.onclick = () => void home();
      return false;
    }
    return true;
  }
  async function ownerEntry(root: HTMLElement, gen: number) {
    const slot = root.querySelector<HTMLElement>('[data-owner-entry]');
    if (!slot) return;
    try {
      const account = await identity();
      if (!current(gen)) return;
      if (account?.role === 'owner') {
        slot.innerHTML = '<button type="button" class="case-quiet" data-manage>管理案例</button>';
        slot.querySelector<HTMLButtonElement>('button')!.onclick = () => void manage();
      } else if (!account) {
        slot.innerHTML = '<button type="button" class="case-quiet" data-login>公司账号登录</button>';
        slot.querySelector<HTMLButtonElement>('button')!.onclick = () => o.login(() => void home());
      }
    } catch (error) {
      if (!current(gen)) return;
      slot.innerHTML = `<span class="case-muted">登录状态读取失败：${esc(errorText(error))}</span><button type="button" class="case-quiet">重试登录状态</button>`;
      slot.querySelector<HTMLButtonElement>('button')!.onclick = () => void ownerEntry(root, gen);
    }
  }
  async function home() {
    if (destroyed) return;
    const root = show('已交付案例', loading), gen = generation;
    try {
      const data = await o.api<{ items: CaseRecord[]; updatedAt?: string }>('/public/cases');
      if (!current(gen)) return;
      root.innerHTML = `<div class="case-intro"><p class="case-eyebrow">童医魔盒 · 交付档案</p><h3>看看我们完成了什么</h3><p>了解实际职责、交付成果与数据来源，再讨论你的项目。</p></div><div class="case-toolbar"><p class="case-caption">仅展示已核验并获准公开的案例${data.updatedAt ? ` · 更新于 ${esc(dateText(data.updatedAt))}` : ''}</p><button type="button" class="case-quiet" data-refresh>刷新</button></div>${data.items.length ? `<div class="case-list">${data.items.map(item => `<article class="case-list-item">${item.imageUrl ? `<div class="case-thumbnail"><img src="/api/public/cases/${encodeURIComponent(item.id)}/image" alt="${esc(item.title)}成果缩略图" loading="lazy"></div>` : ''}<div class="case-list-copy"><p class="case-eyebrow">${esc(item.serviceType)} · ${esc(dateText(item.completedAt))}</p><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><button type="button" data-case="${esc(item.id)}" aria-label="查看${esc(item.title)}的交付详情">查看交付详情 <span aria-hidden="true">→</span></button></div></article>`).join('')}</div>` : '<div class="case-empty"><span class="case-empty-mark" aria-hidden="true">档案</span><div><h3>案例正在核验</h3><p>完成交付核验与展示授权后，真实成果会出现在这里。</p><p>你可以先告诉我们想完成什么，我们会进一步沟通范围与可行性。</p><a class="case-text-link" href="/contact">咨询一个项目 →</a></div></div>'}<div class="case-account" data-owner-entry></div>`;
      root.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick = () => void home();
      root.querySelectorAll<HTMLButtonElement>('[data-case]').forEach(button => button.onclick = () => void detail(button.dataset.case!));
      images(root);
      void ownerEntry(root, gen);
    } catch (error) { if (current(gen)) fail(root, error, () => void home()); }
  }
  async function detail(id: string) {
    if (destroyed) return;
    const root = show('案例交付详情', loading), gen = generation;
    try {
      const item = await o.api<CaseRecord>(`/public/cases/${encodeURIComponent(id)}`);
      if (!current(gen)) return;
      root.innerHTML = `<div class="case-toolbar"><button type="button" data-back>← 全部案例</button><button type="button" class="case-quiet" data-refresh>刷新</button></div>${publicContent(item)}<div class="case-next"><div><h3>你也有类似需求？</h3><p>我们会以这个案例为参考，重新确认你的目标、范围与交期。</p></div>${o.onRequest ? '<button class="case-primary" type="button" data-request>我要类似项目</button><p class="case-status" data-request-status role="status" aria-live="polite"></p>' : '<a class="case-text-link" href="/contact">咨询一个项目 →</a>'}</div>`;
      root.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => void home();
      root.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick = () => void detail(id);
      images(root); requestButton(root, item);
    } catch (error) { if (current(gen)) fail(root, error, () => void detail(id)); }
  }
  async function manage() {
    if (destroyed) return;
    const root = show('案例管理', loading), gen = generation;
    try {
      if (!await ensureOwner(root, gen, () => void manage())) return;
      const { items } = await o.api<{ items: InternalCase[] }>('/cases');
      if (!current(gen)) return;
      root.innerHTML = `<p class="case-eyebrow">公司负责人工作台</p><p class="case-intro-note">公开案例须具备已核验的交付成果与展示同意。演示内容保留在内部。</p><div class="case-actions"><button type="button" class="case-primary" data-new>新建案例草稿</button><button type="button" data-public>查看公开页</button><button type="button" data-refresh>刷新</button></div>${items.length ? `<div class="case-list">${items.map(item => `<article class="case-manage-row"><div><h3>${esc(item.title)}</h3><p>${badge(item)} <span>${esc(states[item.state] || item.state)} · v${esc(item.version)}</span></p><p class="case-caption">${esc(item.serviceType)} · ${esc(dateText(item.completedAt))}</p></div><button type="button" data-review="${esc(item.id)}" aria-label="管理${esc(item.title)}">打开工作台</button></article>`).join('')}</div>` : '<div class="case-empty"><div><h3>尚无案例草稿</h3><p>从一项已完成的真实交付开始，填写职责、成果及授权依据。</p></div></div>'}`;
      root.querySelector<HTMLButtonElement>('[data-new]')!.onclick = () => void edit();
      root.querySelector<HTMLButtonElement>('[data-public]')!.onclick = () => void home();
      root.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick = () => void manage();
      root.querySelectorAll<HTMLButtonElement>('[data-review]').forEach(button => button.onclick = () => void review(button.dataset.review!));
    } catch (error) { if (current(gen)) fail(root, error, () => void manage()); }
  }
  function metricForm(metric?: Metric) {
    return `<fieldset class="case-metric-form" data-period-start="${esc(metric?.periodStart)}" data-period-end="${esc(metric?.periodEnd)}"><legend>结果指标</legend><div class="case-form-grid"><label>指标名称<input name="metric-label" maxlength="120" value="${esc(metric?.label)}" required></label><label>数值<input name="metric-value" type="number" step="any" value="${esc(metric?.value)}" required></label><label>单位<input name="metric-unit" maxlength="40" value="${esc(metric?.unit)}" required></label><label>来源类型<select name="metric-kind">${Object.entries(sourceLabels).map(([key, label]) => `<option value="${key}"${metric?.sourceKind === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label><label class="case-full">来源说明<input name="metric-source" maxlength="200" value="${esc(metric?.sourceLabel)}" required></label><label>测量开始<input name="metric-start" type="date" max="${today()}" value="${esc(dateInput(metric?.periodStart))}" required></label><label>测量结束<input name="metric-end" type="date" max="${today()}" value="${esc(dateInput(metric?.periodEnd))}" required></label></div><button type="button" class="case-quiet" data-remove-metric>移除此指标</button></fieldset>`;
  }
  async function edit(id?: string) {
    if (destroyed) return;
    const root = show(id ? '编辑案例' : '新建案例草稿', loading), gen = generation;
    try {
      if (!await ensureOwner(root, gen, () => void edit(id))) return;
      const item = id ? await o.api<InternalCase>(`/cases/${encodeURIComponent(id)}`) : undefined;
      if (!current(gen)) return;
      root.innerHTML = `<button type="button" data-back>← ${item ? '案例工作台' : '管理列表'}</button><p class="case-notice">${item ? '保存内容会撤下已公开的版本，并清除既有证据核验与批准状态。修改后须重新核验和批准。' : '先保存内部草稿；上传成果和补充授权依据后，再申请公开审核。'}</p><form data-form="case" class="case-form"><div class="case-form-grid"><label class="case-full">案例标题<input name="title" maxlength="120" value="${esc(item?.title)}" required></label><label>服务类型<input name="serviceType" maxlength="80" value="${esc(item?.serviceType)}" required></label><label>资料类型<select name="dataMode"><option value="REAL"${item?.dataMode !== 'DEMO' ? ' selected' : ''}>真实交付</option><option value="DEMO"${item?.dataMode === 'DEMO' ? ' selected' : ''}>演示（不可公开）</option></select></label><label class="case-full">项目概述<textarea name="summary" maxlength="2000" rows="4" required>${esc(item?.summary)}</textarea></label><label class="case-full">我们的实际职责<textarea name="responsibility" maxlength="2000" rows="3" required>${esc(item?.responsibility)}</textarea></label><label class="case-full">已交付内容<textarea name="deliverables" maxlength="2000" rows="3" required>${esc(item?.deliverables)}</textarea></label><label>完成日期<input name="completedAt" type="date" max="${today()}" value="${esc(dateInput(item?.completedAt))}" required></label><label>内部项目编号（选填）<input name="sourceProjectId" maxlength="100" value="${esc(item?.sourceProjectId)}"></label><label>公开演示链接（选填）<input name="demoUrl" type="url" maxlength="2000" value="${esc(item?.demoUrl)}" placeholder="https://"></label><label>公开代码仓库（选填）<input name="repositoryUrl" type="url" maxlength="2000" value="${esc(item?.repositoryUrl)}" placeholder="https://"></label></div><div class="case-section"><h3>量化结果（选填）</h3><p class="case-caption">只填写已有依据的结果；没有量化数据时保留为空。来源与测量区间会一同公开。</p><div data-metrics>${(item?.metrics || []).map(metric => metricForm(metric)).join('')}</div><button type="button" data-add-metric>添加一个指标</button></div><label class="case-checkbox"><input type="checkbox" name="confirmed" required>我已核对以上公开内容${item ? '，了解保存后须重新审核' : '，当前仅保存草稿'}</label>${formEnd('保存案例草稿')}`;
      root.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => item ? void review(item.id) : void manage();
      const metricList = root.querySelector<HTMLElement>('[data-metrics]')!;
      const addButton = root.querySelector<HTMLButtonElement>('[data-add-metric]')!;
      const bindRemoval = () => {
        addButton.disabled = metricList.children.length >= 20;
        metricList.querySelectorAll<HTMLButtonElement>('[data-remove-metric]').forEach(button => button.onclick = () => { button.closest('fieldset')!.remove(); addButton.disabled = false; addButton.focus(); });
      };
      addButton.onclick = () => { if (metricList.children.length >= 20) return; metricList.insertAdjacentHTML('beforeend', metricForm()); bindRemoval(); metricList.lastElementChild?.querySelector<HTMLInputElement>('input')?.focus(); };
      bindRemoval();
      bindForm(root, 'case', async (form, element) => {
        const value = (name: string) => String(form.get(name) || '').trim();
        const metrics = [...element.querySelectorAll<HTMLFieldSetElement>('.case-metric-form')].map(field => {
          const get = (name: string) => field.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="metric-${name}"]`)!.value.trim();
          const metric = { label: get('label'), value: Number(get('value')), unit: get('unit'), sourceKind: get('kind'), sourceLabel: get('source'), periodStart: get('start') === dateInput(field.dataset.periodStart) ? field.dataset.periodStart! : get('start'), periodEnd: get('end') === dateInput(field.dataset.periodEnd) ? field.dataset.periodEnd! : get('end') };
          if (!Number.isFinite(metric.value) || Date.parse(metric.periodEnd) < Date.parse(metric.periodStart)) throw new Error('请检查指标数值与起止日期。');
          return metric;
        });
        const result = await action(item ? 'case.update' : 'case.create', { ...(item ? { caseId: item.id, version: item.version } : {}), title: value('title'), serviceType: value('serviceType'), summary: value('summary'), responsibility: value('responsibility'), deliverables: value('deliverables'), completedAt: item && value('completedAt') === dateInput(item.completedAt) ? item.completedAt : value('completedAt'), dataMode: value('dataMode'), demoUrl: value('demoUrl'), repositoryUrl: value('repositoryUrl'), sourceProjectId: value('sourceProjectId'), metrics });
        if (current(gen)) await review(result.caseId, `草稿已保存 · 操作 ${result.operationId}`);
      });
    } catch (error) { if (current(gen)) fail(root, error, () => void edit(id)); }
  }
  async function review(id: string, notice = '') {
    if (destroyed) return;
    const root = show('案例核验与发布', loading), gen = generation;
    try {
      if (!await ensureOwner(root, gen, () => void review(id))) return;
      const item = await o.api<InternalCase>(`/cases/${encodeURIComponent(id)}`);
      if (!current(gen)) return;
      const verifiedDelivery = item.evidence.some(e => e.kind === 'delivery' && e.verifiedAt && e.scope);
      const verifiedConsent = item.evidence.some(e => e.kind === 'client-consent' && e.verifiedAt && e.scope);
      const canApprove = item.state === 'EVIDENCE_PENDING' && verifiedDelivery && verifiedConsent && item.dataMode === 'REAL';
      const canPublish = item.state === 'APPROVED_FOR_PUBLICATION' && item.dataMode === 'REAL';
      root.innerHTML = `<div class="case-toolbar"><button type="button" data-back>← 管理列表</button><button type="button" data-refresh>刷新版本</button></div>${notice ? `<p class="case-feedback case-success" role="status">${esc(notice)}</p>` : ''}<p class="case-eyebrow">${esc(states[item.state])} · 当前版本 ${esc(item.version)} ${badge(item)}</p><h3 class="case-title">${esc(item.title)}</h3><p class="case-notice">编辑内容或替换图片会撤下已公开版本，清除证据核验与批准状态；新增证据也会撤下并取消批准。每一步均需重新确认。</p><div class="case-actions"><button type="button" data-edit>编辑案例内容</button>${item.state === 'PUBLISHED' ? '<button type="button" data-public>查看公开版本</button>' : ''}</div><details class="case-preview"><summary>查看公开字段预览</summary>${publicContent(item, false)}</details><section class="case-section"><h3>成果截图</h3>${item.image ? `<figure class="case-image" data-stored-case-image><img src="/api/cases/${encodeURIComponent(item.id)}/image?version=${encodeURIComponent(String(item.version))}" alt="${esc(item.title)}当前已保存的成果截图" decoding="async"><figcaption>已保存的截图 · 内部审核预览 · 案例版本 ${esc(item.version)}</figcaption></figure>` : ''}<p class="case-caption">${item.image ? `已有截图 · ${esc(Math.round(item.image.bytes / 1024))} KB · ${esc(item.image.mime)}` : '尚未上传截图。'} 上传将替换原图。请先去除客户个人信息与未获准展示的内容。</p><form data-form="image" class="case-form"><label>上传图片（PNG / JPEG / WebP，最大 4 MB）<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required></label><label class="case-checkbox"><input type="checkbox" required>我已核对图片可展示内容，了解替换后须重新核验</label>${formEnd('上传成果截图')}</section><section class="case-section"><h3>私有核验资料</h3><p class="case-caption">以下资料仅用于内部核验，不在公开案例页面显示。核验须由你实际查看原始资料后确认。</p>${item.evidence.length ? `<div class="case-evidence-list">${item.evidence.map(e => `<article class="case-evidence"><div class="case-evidence-title"><h4>${esc(evidenceLabels[e.kind] || e.kind)}</h4><span class="case-badge${e.verifiedAt ? '' : ' case-badge-pending'}">${e.verifiedAt ? '已人工核验' : '待核验'}</span></div><dl><div><dt>资料引用</dt><dd>${esc(e.reference)}</dd></div>${e.scope ? `<div><dt>授权范围</dt><dd>${esc(e.scope)}</dd></div>` : ''}${e.note ? `<div><dt>说明</dt><dd>${esc(e.note)}</dd></div>` : ''}</dl>${e.verifiedAt ? `<p class="case-caption">核验日期 ${esc(dateText(e.verifiedAt))}</p>` : `<button type="button" data-verify="${esc(e.id)}">确认已核验此资料</button>`}</article>`).join('')}</div>` : '<p class="case-empty-inline">尚无核验资料，请添加交付成果和客户展示同意。</p>'}<details class="case-evidence-add"><summary>添加一项核验资料</summary><form data-form="evidence" class="case-form"><label>资料类型<select name="kind">${Object.entries(evidenceLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label><label>原始资料引用<input name="reference" maxlength="500" required><span class="case-caption">填写可由负责人核查的文件或记录编号；不要填写凭证密钥。</span></label><label>允许展示的范围<textarea name="scope" maxlength="1000" rows="3" required></textarea><span class="case-caption">“交付成果”和“展示同意”都须明确范围，如可公开的标题、截图及数据。</span></label><label>核验说明（选填）<textarea name="note" maxlength="2000" rows="3"></textarea></label>${formEnd('保存核验资料')}</details></section><section class="case-section"><h3>审核与公开</h3><ul class="case-checklist"><li>${verifiedDelivery ? '已具备' : '待补充'}：经人工核验的交付成果</li><li>${verifiedConsent ? '已具备' : '待补充'}：经人工核验、包含范围的展示同意</li><li>${item.dataMode === 'REAL' ? '资料类型为真实交付' : '演示资料不能公开发布'}</li></ul><div class="case-actions"><button type="button" data-operation="case.submit"${item.state === 'DRAFT' ? '' : ' disabled'}>提交审核</button><button type="button" data-operation="case.approve"${canApprove ? '' : ' disabled'}>批准当前版本</button><button type="button" class="case-primary" data-operation="case.publish"${canPublish ? '' : ' disabled'}>公开发布此版本</button><button type="button" data-operation="case.archive"${item.state === 'ARCHIVED' ? ' disabled' : ''}>撤下 / 归档</button></div><p class="case-caption">按“提交审核 → 批准当前版本 → 公开发布”顺序操作。修改与核验期间不会自动发布。归档案例须先编辑保存为草稿。</p><p class="case-status" data-action-status role="status" aria-live="polite"></p></section>`;
      root.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => void manage();
      root.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick = () => void review(id);
      root.querySelector<HTMLButtonElement>('[data-edit]')!.onclick = () => void edit(id);
      images(root);
      const publicButton = root.querySelector<HTMLButtonElement>('[data-public]'); if (publicButton) publicButton.onclick = () => void detail(id);
      const update = async (type: string, extra: object = {}) => {
        const result = await action(type, { caseId: item.id, version: item.version, ...extra });
        if (current(gen)) await review(item.id, `操作已记录 · ${result.operationId}`);
      };
      const operation = async (type: string, extra: object, message: string) => {
        if (!window.confirm(message)) return;
        const controls = [...root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('button,input,select,textarea')], prior = controls.map(c => c.disabled);
        controls.forEach(c => c.disabled = true);
        const status = root.querySelector<HTMLElement>('[data-action-status]')!; status.textContent = '正在记录操作…';
        try { await update(type, { ...extra, confirmed: true }); }
        catch (error) { if (current(gen)) { status.textContent = `${errorText(error)} 可重试；若版本已更新，请先刷新。`; status.classList.add('case-error-text'); } }
        finally { if (current(gen)) controls.forEach((c, i) => c.disabled = prior[i]); }
      };
      root.querySelectorAll<HTMLButtonElement>('[data-verify]').forEach(button => button.onclick = () => void operation('evidence.verify', { evidenceId: button.dataset.verify }, '请确认：你已实际查看这份原始资料，内容真实且与当前案例及声明的展示范围相符。确认记录人工核验结果？'));
      const prompts: Record<string, string> = { 'case.submit': '将此版本提交审核？此操作不会公开发布。', 'case.approve': '批准当前版本及其展示范围？请确认你已逐项核对交付、客户同意与结果依据。批准后仍需单独点击公开发布。', 'case.publish': '将当前案例的标题、职责、交付内容、截图、公开链接与指标公开给所有访客？请再次核对展示同意范围。', 'case.archive': '撤下并归档此案例？公开访客将无法继续访问，内部记录会保留。' };
      root.querySelectorAll<HTMLButtonElement>('[data-operation]').forEach(button => button.onclick = () => void operation(button.dataset.operation!, {}, prompts[button.dataset.operation!]));
      const kind = root.querySelector<HTMLSelectElement>('[name="kind"]')!, scope = root.querySelector<HTMLTextAreaElement>('[name="scope"]')!;
      kind.onchange = () => { scope.required = ['delivery', 'client-consent'].includes(kind.value); };
      const imageInput = root.querySelector<HTMLInputElement>('[name="image"]')!;
      const imagePreview = document.createElement('figure'); imagePreview.className = 'case-image'; imagePreview.hidden = true;
      imageInput.parentElement!.after(imagePreview);
      imageInput.onchange = () => {
        previewUrls.forEach(url => URL.revokeObjectURL(url)); previewUrls.clear(); imagePreview.replaceChildren(); imagePreview.hidden = true;
        const file = imageInput.files?.[0];
        if (!file || file.size > 4 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
        const url = URL.createObjectURL(file); previewUrls.add(url);
        const img = document.createElement('img'); img.src = url; img.alt = '准备上传的成果截图';
        const caption = document.createElement('figcaption'); caption.textContent = '待上传预览 · 请核对内容与展示范围，点击上传后才会保存。';
        img.onerror = () => { img.remove(); caption.textContent = '所选图片无法预览，请检查文件或重新选择。'; };
        imagePreview.append(img, caption); imagePreview.hidden = false;
      };
      bindForm(root, 'evidence', async form => update('evidence.add', { kind: form.get('kind'), reference: String(form.get('reference') || '').trim(), note: String(form.get('note') || '').trim(), scope: String(form.get('scope') || '').trim() }));
      bindForm(root, 'image', async form => {
        const file = form.get('image') as File;
        if (!file?.size || file.size > 4 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择不超过 4 MB 的 PNG、JPEG 或 WebP 图片。');
        uploadController = new AbortController();
        const response = await fetch(`/api/cases/${encodeURIComponent(item.id)}/image?version=${item.version}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file, credentials: 'same-origin', signal: uploadController.signal });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || `图片上传失败（${response.status}），请重试。`);
        if (result?.id !== item.id || !Number.isSafeInteger(result?.version)) throw new Error('未收到可确认的图片版本，请刷新案例核对上传状态。');
        if (current(gen)) await review(item.id, '成果截图已保存；请重新核验资料并审核。');
      });
    } catch (error) { if (current(gen)) fail(root, error, () => void review(id)); }
  }
  function destroy() { destroyed = true; invalidate(); pending.clear(); }
  return { home, detail, manage, destroy };
}

type PageOptions = { onRequest?: RequestHandler; api?: Api; login?: Options['login']; initialCaseId?: string };
/** A standalone 2D case page. This module never imports or starts the 3D world. */
export function mountCaseStudiesPage(container: HTMLElement, options: PageOptions = {}): CaseStudiesDesk {
  let cleanup: (() => void) | undefined;
  let disposed = false;
  let views = 0;
  container.innerHTML = '<div class="case-page"><div class="case-page-top"><a href="/" class="case-brand">童医魔盒<span>数字公司</span></a><a href="/contact">咨询项目</a></div><div class="case-page-heading"><p>合作，从看见真实成果开始</p><h1 tabindex="-1" data-case-page-title>已交付案例</h1></div><div data-case-page-content></div><div class="case-page-foot">北京童医魔盒科技服务有限公司 · <a href="/">进入数字总部</a></div></div>';
  const body = container.querySelector<HTMLElement>('[data-case-page-content]')!;
  const title = container.querySelector<HTMLElement>('[data-case-page-title]')!;
  const api: Api = options.api || (async <T>(path: string, method = 'GET', data?: unknown): Promise<T> => {
    const response = await fetch('/api' + path, { method, credentials: 'same-origin', headers: data === undefined ? undefined : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || `请求失败（${response.status}），请重试。`);
    if (!result) throw new Error('服务返回了无法识别的数据，请刷新重试。');
    return result as T;
  });
  const open = (label: string, html: string) => {
    cleanup?.(); cleanup = undefined;
    title.textContent = label; body.innerHTML = html;
    if (views++ > 0) title.focus({ preventScroll: false });
    return body;
  };
  const login: Options['login'] = options.login || (after => {
    const loginRoot = open('登录公司账号', '<div class="case-studies"><p class="case-intro-note">使用已有公司账号登录。案例管理权限由公司账户角色决定。</p><form class="case-form" data-login-form><label>账号<input name="username" autocomplete="username" required maxlength="120"></label><label>密码<input name="password" type="password" autocomplete="current-password" required></label><button class="case-primary" type="submit">登录</button><p role="status" aria-live="polite"></p></form><button type="button" data-return>返回公开案例</button></div>');
    let active = true; cleanup = () => { active = false; };
    const form = loginRoot.querySelector<HTMLFormElement>('form')!, status = form.querySelector<HTMLElement>('[role="status"]')!;
    loginRoot.querySelector<HTMLButtonElement>('[data-return]')!.onclick = () => void desk.home();
    form.onsubmit = async event => {
      event.preventDefault(); if (form.getAttribute('aria-busy') === 'true') return;
      const data = new FormData(form), button = form.querySelector<HTMLButtonElement>('button')!;
      form.setAttribute('aria-busy', 'true'); button.disabled = true; status.textContent = '正在登录…';
      try { await api('/auth/login', 'POST', { username: data.get('username'), password: data.get('password') }); form.reset(); if (!disposed && active) after(); }
      catch (error) { if (!disposed && active) status.textContent = errorText(error); }
      finally { if (!disposed && active) { button.disabled = false; form.removeAttribute('aria-busy'); } }
    };
  });
  const desk = createCaseStudiesDesk({ api, open, cleanup: fn => { cleanup = fn; }, login, onRequest: options.onRequest });
  void (options.initialCaseId ? desk.detail(options.initialCaseId) : desk.home());
  return { ...desk, destroy: () => { disposed = true; cleanup?.(); desk.destroy(); container.replaceChildren(); } };
}
