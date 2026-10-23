import './intake.css';

// 2D consulting desk: product cards, booking form, personal records and the
// owner queue. All prices/statuses come from the server; nothing is hardcoded
// beyond labels and the allowed client-side transition hints the server
// re-validates.

type Api = <T = any>(path: string, method?: string, data?: unknown) => Promise<T>;
type Product = {id: string; code: string; name: string; description: string; durationMinutes: number; priceCents: number};
type Consultation = {
 id: string;
 product: {id: string; code: string; name: string; durationMinutes: number; priceCents: number};
 topic: string;
 requesterName: string;
 contact: string;
 preferredAt: string;
 status: string;
 ownerNote: string;
 version: number;
 confirmedAt: string | null;
 startedAt: string | null;
 completedAt: string | null;
 cancelledAt: string | null;
 archivedAt: string | null;
 createdAt: string;
 updatedAt: string;
};
type OutboxItem = {id: string; consultationId: string; eventType: string; channel: string; status: string; attempts: number; lastError: string | null; nextAttemptAt: string | null; sentAt: string | null; createdAt: string; updatedAt: string};
type OutboxSummary = {items: OutboxItem[]; counts: Record<string, number>; total: number};
type Stats = {products: number; total: number; byStatus: Record<string, number>; upcoming: number; outbox: {total: number; byStatus: Record<string, number>}; source: string; dataMode: string; updatedAt: string};
type ListResponse = {owner: boolean; source: string; dataMode: string; updatedAt: string; items: Consultation[]; stats: Stats | null; outbox?: OutboxSummary};
type ProductsResponse = {items: Product[]; source: string; dataMode: string; updatedAt: string};

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
const date = (v: string) => new Date(v).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai', hour12: false});
const money = (cents: number) => cents === 0 ? '免费' : `¥${(cents / 100).toFixed(2)}`;
const statusNames: Record<string, string> = {requested: '待确认', confirmed: '已确认', in_progress: '咨询进行中', completed: '已完成', cancelled: '已取消', archived: '已归档'};
const actionNames: Record<string, string> = {confirmed: '确认预约', in_progress: '开始咨询', completed: '标记完成', cancelled: '取消咨询', archived: '归档'};
const nextStatuses: Record<string, string[]> = {
 requested: ['confirmed', 'cancelled'],
 confirmed: ['in_progress', 'cancelled'],
 in_progress: ['completed'],
 completed: ['archived'],
 cancelled: ['archived'],
 archived: [],
};
const channelNames: Record<string, string> = {feishu: '飞书', octop: 'OCTOP'};
const outboxNames: Record<string, string> = {not_configured: '未配置（未发送）', pending: '待投递', sent: '已发送', failed: '失败', dead: '死信'};
const eventNames: Record<string, string> = {
 'consultation.requested': '新的咨询预约',
 'consultation.confirmed': '预约已确认',
 'consultation.in_progress': '咨询已开始',
 'consultation.completed': '咨询已完成',
 'consultation.cancelled': '咨询已取消',
 'consultation.archived': '咨询已归档',
};

// datetime-local is Beijing wall time; the server stores a timezone-qualified ISO instant.
function beijingTime(value: unknown) {
 const text = String(value ?? '');
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text) || Number(text.slice(0, 4)) < 1) throw new Error('请填写有效的北京时间，包括日期、小时和分钟');
 const local = text.length === 16 ? text + ':00' : text, instant = new Date(local + '+08:00');
 if (!Number.isFinite(instant.getTime()) || new Date(instant.getTime() + 8 * 3600000).toISOString().slice(0, 19) !== local) throw new Error('预约日期或时间无效，请重新填写');
 return instant.toISOString();
}

export function mountConsulting(container: HTMLElement, {api}: {api: Api}) {
 let alive = true, generation = 0, products: Product[] = [];
 const submissionKeys = new Map<string, string>();
 const render = (html: string) => { container.innerHTML = '<section class="intake consulting">' + html + '</section>'; };
 const errorText = (e: unknown) => e instanceof Error ? e.message : '操作未完成，请重试';
 const statsHtml = (stats: Stats) => `<div class="intake-note"><h4>真实记录数</h4><p>总记录 ${stats.total} · 待确认 ${stats.byStatus.requested ?? 0} · 已确认 ${stats.byStatus.confirmed ?? 0} · 进行中 ${stats.byStatus.in_progress ?? 0} · 已完成 ${stats.byStatus.completed ?? 0} · 已取消 ${stats.byStatus.cancelled ?? 0} · 已归档 ${stats.byStatus.archived ?? 0}</p><p>未来已确认 ${stats.upcoming} 条 · 通知未配置 ${stats.outbox.byStatus.not_configured ?? 0} 条 · 已发送 ${stats.outbox.byStatus.sent ?? 0} 条。这里只有真实记录数，不包含营收、成交或估算。</p></div>`;

 async function home() {
  const token = ++generation;
  render('<p role="status">正在读取咨询商品与记录…</p>');
  try {
   await api('/session', 'POST', {});
   const [catalog, list] = await Promise.all([api<ProductsResponse>('/consulting/products'), api<ListResponse>('/consulting')]);
   if (!alive || generation !== token) return;
   products = catalog.items;
   const cards = products.length
    ? `<div class="intake-record-head"><h3>咨询商品</h3><span class="intake-footnote">价格来自公司数据库</span></div>${products.map(p => `<article class="intake-record"><p class="intake-eyebrow">${p.durationMinutes} 分钟</p><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><p><strong>${esc(money(p.priceCents))}</strong></p><button data-product="${esc(p.id)}">预约这个咨询</button></article>`).join('')}`
    : '<p>当前没有上架的咨询商品。</p>';
   render(`<p class="intake-eyebrow">童医魔盒 · 真人咨询</p><h2>选一次真人咨询，由负责人确认时间。</h2><p>商品、时长与价格来自公司数据库。提交后会进入负责人队列；负责人确认前不代表订单成立、报价生效或完成付款。</p><div class="intake-tabs"><button data-book>预约咨询</button><button data-records>${list.owner ? '我的记录 / 老板队列' : '我的咨询'}</button></div><div data-consulting-body>${cards}</div><p class="intake-footnote">匿名记录跟随此浏览器的公司会话保存；清除 Cookie 后无法凭匿名身份找回。请勿提交病历、患者信息、账号密码或密钥。</p>`);
   const body = container.querySelector<HTMLElement>('[data-consulting-body]')!;
   container.querySelector<HTMLButtonElement>('[data-book]')!.onclick = () => bookForm();
   container.querySelector<HTMLButtonElement>('[data-records]')!.onclick = () => void records();
   for (const button of body.querySelectorAll<HTMLButtonElement>('[data-product]')) button.onclick = () => bookForm(button.dataset.product);
  } catch (e) {
   if (!alive || generation !== token) return;
   render(`<p class="intake-error" role="alert">${esc(errorText(e))}</p><button data-retry>重新连接</button>`);
   container.querySelector<HTMLButtonElement>('[data-retry]')!.onclick = () => void home();
  }
 }

 function bookForm(productId?: string) {
  generation++;
  const slot = container.querySelector<HTMLElement>('[data-consulting-body]')!;
  if (!products.length) { slot.innerHTML = '<p>当前没有上架的咨询商品，暂时无法预约。</p>'; return; }
  slot.innerHTML = `<form class="intake-form"><div class="intake-record-head"><h3>预约真人咨询</h3><button type="button" data-home>返回商品</button></div><label>咨询商品<select name="productId" required>${products.map(p => `<option value="${esc(p.id)}"${p.id === productId ? ' selected' : ''}>${esc(p.name)} · ${p.durationMinutes} 分钟 · ${esc(money(p.priceCents))}</option>`).join('')}</select></label><div class="intake-grid"><label>你的称呼<input name="name" autocomplete="name" required maxlength="80"></label><label>联系方式<input name="contact" required maxlength="200" placeholder="邮箱、手机或方便联系的方式"></label></div><label>想咨询的问题<textarea name="topic" required rows="4" maxlength="1000" placeholder="请描述你的问题、期望目标和方便的时间；不要填写病历或患者隐私。"></textarea></label><label>期望时间（北京时间）<input name="preferredAt" type="datetime-local" required></label><label class="intake-consent"><input type="checkbox" name="confirmed" required>我同意公司保存本次联系信息，并由负责人联系我确认服务。提交不代表订单成立或完成付款。</label><p data-status role="status" aria-live="polite"></p><button class="intake-primary" type="submit">提交咨询预约</button></form>`;
  slot.querySelector<HTMLButtonElement>('[data-home]')!.onclick = () => void home();
  const form = slot.querySelector<HTMLFormElement>('form')!, status = form.querySelector<HTMLElement>('[data-status]')!;
  let pending = false;
  form.onsubmit = async event => {
   event.preventDefault();
   if (pending) return;
   const token = generation;
   const input = Object.fromEntries(new FormData(form));
   let preferredAt: string;
   try { preferredAt = beijingTime(input.preferredAt); } catch (e) { status.textContent = errorText(e); status.className = 'intake-error'; return; }
   const product = products.find(p => p.id === String(input.productId));
   if (!product) { status.textContent = '请选择咨询商品'; status.className = 'intake-error'; return; }
   const signature = JSON.stringify({productId: product.id, name: input.name, contact: input.contact, topic: input.topic, preferredAt});
   const key = submissionKeys.get(signature) || crypto.randomUUID();
   submissionKeys.set(signature, key);
   const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement>('input,button,textarea,select'));
   pending = true; controls.forEach(control => control.disabled = true); status.textContent = '正在保存，请稍候…'; status.className = '';
   try {
    const saved = await api<Consultation & {replayed?: boolean}>('/consulting/bookings', 'POST', {productId: product.id, name: String(input.name), contact: String(input.contact), topic: String(input.topic), preferredAt, confirmed: input.confirmed === 'on', requestKey: key});
    if (!alive || generation !== token || !form.isConnected) return;
    submissionKeys.delete(signature);
    slot.innerHTML = `<div class="intake-saved"><h3>咨询预约已登记</h3><p>${esc(saved.product.name)} · ${saved.product.durationMinutes} 分钟 · ${esc(money(saved.product.priceCents))}</p><p>登记号 ${esc(saved.id)} · ${esc(statusNames[saved.status] || saved.status)}。请等待负责人确认时间和方式；确认前不代表订单成立或已付款。</p><button data-open-records>查看我的咨询</button></div>`;
    slot.querySelector<HTMLButtonElement>('[data-open-records]')!.onclick = () => void records();
   } catch (e) {
    if (alive && generation === token && form.isConnected) { status.textContent = errorText(e) + '；保留原内容重试不会重复提交。'; status.className = 'intake-error'; }
   } finally {
    pending = false;
    if (form.isConnected) controls.forEach(control => control.disabled = false);
   }
  };
 }

 async function records() {
  const token = ++generation;
  const slot = container.querySelector<HTMLElement>('[data-consulting-body]')!;
  slot.innerHTML = '<p role="status">正在读取咨询记录…</p>';
  try {
   const data = await api<ListResponse>('/consulting');
   if (!alive || generation !== token) return;
   slot.innerHTML = `<div class="intake-record-head"><h3>${data.owner ? '老板咨询队列' : '我的咨询'}</h3><span><button data-home>预约咨询</button> <button data-refresh>刷新状态</button></span></div><p class="intake-footnote">公司真实记录 · ${esc(date(data.updatedAt))} · 来源 ${esc(data.source)} · 数据模式 ${esc(data.dataMode)}</p>${data.owner && data.stats ? statsHtml(data.stats) : ''}<div data-record-list></div>${data.owner && data.outbox ? `<div class="intake-record-head"><h4>通知 outbox</h4><span class="intake-footnote">未配置的通道不会标记为已发送</span></div><div data-outbox-list></div>` : ''}`;
   slot.querySelector<HTMLButtonElement>('[data-home]')!.onclick = () => void home();
   slot.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick = () => void records();
   const list = slot.querySelector<HTMLElement>('[data-record-list]')!;
   if (!data.items.length) list.innerHTML = '<p>还没有咨询记录。可以先预约一次真人咨询。</p>';
   for (const item of data.items) list.append(recordCard(item, data.owner));
   if (data.owner && data.outbox) {
    const outboxList = slot.querySelector<HTMLElement>('[data-outbox-list]')!;
    if (!data.outbox.items.length) outboxList.innerHTML = '<p>通知队列为空。</p>';
    for (const item of data.outbox.items) outboxList.append(outboxCard(item));
   }
  } catch (e) {
   if (!alive || token !== generation) return;
   slot.innerHTML = `<p class="intake-error" role="alert">${esc(errorText(e))}</p><button data-retry>重新读取</button>`;
   slot.querySelector<HTMLButtonElement>('[data-retry]')!.onclick = () => void records();
  }
 }

 function recordCard(item: Consultation, isOwner: boolean) {
  const article = document.createElement('article');
  article.className = 'intake-record';
  article.innerHTML = `<p class="intake-eyebrow">${esc(item.product.name)} · ${item.product.durationMinutes} 分钟 · ${esc(money(item.product.priceCents))} · ${esc(statusNames[item.status] || item.status)}</p><h4>${esc(item.topic)}</h4><p>期望时间 ${esc(date(item.preferredAt))}（北京时间）</p><p>称呼 ${esc(item.requesterName)} · 联系方式 ${esc(item.contact)}</p>${item.ownerNote ? `<p class="intake-note">负责人备注：${esc(item.ownerNote)}</p>` : ''}<small>登记号 ${esc(item.id)} · 版本 ${item.version}</small>`;
  if (!isOwner) return article;
  const transitions = nextStatuses[item.status] || [];
  if (transitions.length) {
   const form = document.createElement('form');
   form.innerHTML = `<label>更新状态<select name="status">${transitions.map(value => `<option value="${value}">${esc(actionNames[value] || value)}</option>`).join('')}</select></label><label>给客户的备注（可留空）<textarea name="note" rows="2" maxlength="2000" placeholder="填写后会显示在客户记录中"></textarea></label><p role="alert"></p><button>保存状态</button>`;
   form.onsubmit = async event => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(form)), alert = form.querySelector<HTMLElement>('[role=alert]')!;
    const payload: Record<string, unknown> = {status: String(input.status), version: item.version};
    if (typeof input.note === 'string' && input.note.trim()) payload.note = input.note.trim();
    const button = form.querySelector<HTMLButtonElement>('button')!;
    button.disabled = true; alert.textContent = '正在保存…';
    try { await api(`/consulting/${item.id}/status`, 'POST', payload); if (alive) await records(); }
    catch (e) { if (alive) { alert.textContent = errorText(e) + '；请刷新后按最新版本重试。'; button.disabled = false; } }
   };
   article.append(form);
  }
  const noteForm = document.createElement('form');
  noteForm.innerHTML = `<label>负责人备注<textarea name="note" rows="2" maxlength="2000" required>${esc(item.ownerNote)}</textarea></label><p role="alert"></p><button>保存备注</button>`;
  noteForm.onsubmit = async event => {
   event.preventDefault();
   const input = Object.fromEntries(new FormData(noteForm)), alert = noteForm.querySelector<HTMLElement>('[role=alert]')!, button = noteForm.querySelector<HTMLButtonElement>('button')!;
   button.disabled = true; alert.textContent = '正在保存…';
   try { await api(`/consulting/${item.id}/notes`, 'POST', {note: String(input.note), version: item.version}); if (alive) await records(); }
   catch (e) { if (alive) { alert.textContent = errorText(e) + '；请刷新后按最新版本重试。'; button.disabled = false; } }
  };
  article.append(noteForm);
  return article;
 }

 function outboxCard(item: OutboxItem) {
  const article = document.createElement('article');
  article.className = 'intake-record';
  article.innerHTML = `<p class="intake-eyebrow">${esc(channelNames[item.channel] || item.channel)} · ${esc(outboxNames[item.status] || item.status)}</p><h4>${esc(eventNames[item.eventType] || item.eventType)}</h4><p>尝试 ${item.attempts} 次${item.nextAttemptAt ? ` · 下次建议重试 ${esc(date(item.nextAttemptAt))}` : ''}</p>${item.lastError ? `<p class="intake-note">${esc(item.lastError)}</p>` : ''}<small>通知号 ${esc(item.id)}</small>${item.status === 'sent' ? '' : '<button data-retry-outbox>重试（不会发送外部消息）</button>'}${item.status === 'sent' ? '' : '<p role="status"></p>'}`;
  const button = article.querySelector<HTMLButtonElement>('[data-retry-outbox]');
  if (button) button.onclick = async () => {
   const status = article.querySelector<HTMLElement>('[role=status]')!;
   button.disabled = true; status.textContent = '正在重试…'; status.className = '';
   try {
    const result = await api<{status: string; sent: boolean; reason?: string; lastError?: string}>(`/consulting/outbox/${item.id}/retry`, 'POST', {});
    if (!alive) return;
    if (result.sent) { status.textContent = '通知已发送。'; status.className = ''; }
    else { status.textContent = `未发送：${outboxNames[result.status] || result.status}${result.lastError ? ' · ' + result.lastError : ''}`; status.className = 'intake-error'; }
    button.disabled = false;
   } catch (e) {
    if (alive) { status.textContent = errorText(e); status.className = 'intake-error'; button.disabled = false; }
   }
  };
  return article;
 }

 void home();
 return {destroy() { alive = false; generation++; }, records};
}
