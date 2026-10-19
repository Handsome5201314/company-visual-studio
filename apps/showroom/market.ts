import {
 buildMarketDetailUrl,
 buildMarketDownloadUrl,
 buildMarketFileUrl,
 filterMarketItems,
 sortMarketItems,
 validateMarketDetail,
 validateMarketIndex
} from '../../src/market-index.js';
import staticIndex from './market-index.json';

type Category={id:string;label:string};
type ManifestFile={path:string;bytes:number;sha256:string;license:string;source:string};
type Manifest={
 schemaVersion:number;id:string;name:string;author:string;version:string;description:string;styles:string[];
 compatibleContract:string;license:string;source:{repository:string;commit:string};themePath:string;scenePath:string;
 previewPath:string;files:ManifestFile[];
};
export type MarketEntry={
 id:string;themeId:string;version:string;manifest:Manifest;packageHash:string;totalBytes:number;state:'LISTED';revision:number;
 createdAt:string;updatedAt:string;title:string;author:string;description:string;styles:string[];license:string;
 compatibleContract:string;previewPath:string;images:string[];source:{repository:string;commit:string};
};
type MarketScene={schemaVersion:number;compatibleContract:string;objects:unknown[];lights:unknown[]};
export type MarketDetail={entry:MarketEntry;theme:unknown;scene:MarketScene;assetBase:string};
type MarketCatalog={schemaVersion:number;items:MarketEntry[];categories:Category[]};

export type MarketPreviewRequest={entry:MarketEntry;detail:MarketDetail;host:HTMLElement;onProgress:(text:string)=>void};
export type MarketPreviewHandle={dispose:()=>void};
export type MarketTryOnResult={ok:boolean;status:number;message:string;draftId?:string};
export type MarketOptions={
 openButton:HTMLElement;
 preview:(request:MarketPreviewRequest)=>Promise<MarketPreviewHandle>;
 loadCatalog?:(signal?:AbortSignal)=>Promise<unknown>;
 loadDetails?:(id:string,signal?:AbortSignal)=>Promise<unknown>;
 tryOn?:(entry:MarketEntry)=>Promise<MarketTryOnResult>;
};

class MarketHttpError extends Error{
 constructor(public readonly status:number,message:string){super(message);this.name='MarketHttpError';}
}

const emptyCatalog=():MarketCatalog=>({schemaVersion:1,items:[],categories:[]});

function errorText(error:unknown){
 if(error instanceof MarketHttpError)return `HTTP ${error.status}${error.message?`：${error.message}`:''}`;
 if(error instanceof Error)return error.message;
 return String(error);
}

function messageFromPayload(payload:unknown,text:string){
 if(payload&&typeof payload==='object'){
  for(const key of ['error','message']){
   const value=(payload as Record<string,unknown>)[key];
   if(typeof value==='string'&&value.trim())return value.trim().slice(0,400);
  }
 }
 return text.trim().slice(0,400);
}

async function fetchJSON(path:string,signal?:AbortSignal){
 const response=await fetch(path,{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store',signal});
 if(!response.ok)throw new MarketHttpError(response.status,messageFromPayload(undefined,await response.text().catch(()=>'')));
 const text=await response.text();
 if(!text.trim())throw new Error('服务器返回空响应');
 try{return JSON.parse(text) as unknown;}catch{throw new Error('服务器返回不是有效JSON');}
}

const defaultLoadCatalog=(signal?:AbortSignal)=>fetchJSON('/api/market/themes',signal);
const defaultLoadDetails=(id:string,signal?:AbortSignal)=>fetchJSON(buildMarketDetailUrl(id),signal);

function idempotencyKey(){
 const cryptoObject=globalThis.crypto;
 if(cryptoObject&&typeof cryptoObject.randomUUID==='function')return cryptoObject.randomUUID();
 return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function defaultTryOn(entry:MarketEntry):Promise<MarketTryOnResult>{
 const response=await fetch('/api/decoration/drafts/from-market',{
  method:'POST',credentials:'same-origin',
  headers:{Accept:'application/json','Content-Type':'application/json'},
  body:JSON.stringify({submissionId:entry.id,idempotencyKey:idempotencyKey()})
 });
 const text=await response.text().catch(()=> '');
 let payload:unknown;
 try{payload=text?JSON.parse(text):undefined;}catch{payload=undefined;}
 if(!response.ok)throw new MarketHttpError(response.status,messageFromPayload(payload,text));
 const contentType=response.headers.get('content-type')??'';
 if(text.trim()&&!contentType.includes('application/json'))throw new Error(`试装接口返回非JSON响应（HTTP ${response.status}）；未修改正式装修`);
 const errorPayload=payload as {error?:unknown}|undefined;
 if(typeof errorPayload?.error==='string')throw new MarketHttpError(response.status,errorPayload.error);
 const data=payload as {message?:unknown;draftId?:unknown}|undefined;
 return {
  ok:true,status:response.status,
  message:typeof data?.message==='string'?data.message:'服务器已接受试装请求；本展厅不会应用正式装修，请在公司草稿或审批流程中查看。',
  draftId:typeof data?.draftId==='string'?data.draftId:undefined
 };
}

function formatBytes(bytes:number){
 if(bytes<1024)return `${bytes} B`;
 const units=['KiB','MiB','GiB'];let value=bytes/1024,index=0;
 while(value>=1024&&index<units.length-1){value/=1024;index++;}
 return `${value.toFixed(value>=10?0:1)} ${units[index]}`;
}

function formatDate(value:string){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return value;
 try{return new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(date);}catch{return value;}
}

function placeholder(text:string){
 const element=document.createElement('p');
 element.className='market-placeholder';
 element.textContent=text;
 return element;
}

export function createMarket(options:MarketOptions){
 if(!options?.preview)throw new Error('装修市场需要宿主提供安全预览适配器，不能执行主题JS');
 if(!(options.openButton instanceof HTMLElement))throw new Error('装修市场需要页头入口按钮');

 let staticCatalog=emptyCatalog();
 let staticError='';
 try{staticCatalog=validateMarketIndex(staticIndex) as MarketCatalog;}
 catch(error){staticError=`静态市场目录无效：${errorText(error)}`;}

 const dialog=document.createElement('dialog');
 dialog.className='market-dialog';
 dialog.id='market-dialog';
 dialog.setAttribute('aria-labelledby','market-title');
 dialog.innerHTML=`
  <header class="market-top">
   <div class="market-heading"><p class="market-kicker">童医魔盒 · 公开装修目录</p><h2 id="market-title">装修市场</h2><p id="market-source" class="market-source"></p></div>
   <div class="market-top-actions" role="group" aria-label="市场数据源">
    <button type="button" id="market-mode-static" aria-pressed="true">独立静态目录</button>
    <button type="button" id="market-mode-api" aria-pressed="false">连接同源公司市场</button>
    <button type="button" id="market-close" class="market-close">返回展厅</button>
   </div>
  </header>
  <div id="market-content" class="market-content">
   <div id="market-alert" class="market-alert" role="alert" hidden></div>
   <section id="market-catalog" class="market-catalog" aria-label="公开装修目录">
    <div class="market-toolbar">
     <label class="market-search">搜索作品<input id="market-search" type="search" autocomplete="off" placeholder="标题、作者、主题 ID 或标签"></label>
     <label>风格<select id="market-category"><option value="">全部风格</option></select></label>
     <label>作者<select id="market-author"><option value="">全部作者</option></select></label>
     <button type="button" id="market-clear">清除筛选</button>
    </div>
    <div class="market-summary"><p id="market-count" class="market-count" role="status" aria-live="polite"></p><p class="market-note">按最近更新排序。精选、热门与社区榜单暂无真实运营数据，当前不展示，也不虚构。</p></div>
    <div id="market-loading" class="market-loading" role="status" hidden><span class="market-spinner" aria-hidden="true"></span><span id="market-loading-text">正在读取市场目录…</span></div>
    <div id="market-list" class="market-grid" aria-busy="false"></div>
    <div id="market-empty" class="market-empty" role="status" aria-live="polite" hidden></div>
   </section>
   <section id="market-detail" class="market-detail" hidden aria-labelledby="market-detail-title">
    <div class="market-detail-head"><button type="button" id="market-back">← 返回目录</button><p id="market-detail-status" class="market-source" role="status" aria-live="polite"></p></div>
    <div id="market-detail-loading" class="market-loading" role="status" hidden><span class="market-spinner" aria-hidden="true"></span><span id="market-detail-loading-text">正在读取详情…</span></div>
    <div id="market-detail-error" class="market-alert" role="alert" hidden></div>
    <div id="market-detail-content" hidden>
     <div class="market-detail-grid">
      <div class="market-detail-visual">
       <h3 id="market-detail-title" tabindex="-1"></h3>
       <p id="market-detail-byline" class="market-byline"></p>
       <div id="market-detail-tags" class="market-tags"></div>
       <div id="market-gallery" class="market-gallery"></div>
       <section id="market-preview" class="market-preview" hidden>
        <div class="market-section-head"><h4>基础主题预览</h4><button type="button" id="market-preview-load">加载预览</button></div>
        <div id="market-preview-host" class="market-preview-host"></div>
        <p class="market-note">基础主题预览；可编辑物件待集成。当前只加载主题家具与灯光，不应用 scene.objects/lights，也不修改碰撞、门禁或员工路径。</p>
        <p id="market-preview-status" class="market-status" role="status" aria-live="polite"></p>
       </section>
      </div>
      <div class="market-detail-info">
       <p id="market-detail-description" class="market-description"></p>
       <div id="market-ui-preview" class="market-ui-preview" hidden><p class="market-ui-title">界面配色（来自 theme.json）</p><div id="market-ui-swatches" class="market-swatches"></div></div>
       <dl class="market-facts">
        <div><dt>作者</dt><dd id="market-detail-author"></dd></div>
        <div><dt>版本 / 修订</dt><dd><span id="market-detail-version"></span> / <span id="market-detail-revision"></span></dd></div>
        <div><dt>许可</dt><dd id="market-detail-license"></dd></div>
        <div><dt>布局契约</dt><dd id="market-detail-contract"></dd></div>
        <div><dt>资源大小</dt><dd id="market-detail-size"></dd></div>
        <div><dt>包哈希</dt><dd><code id="market-detail-hash"></code></dd></div>
        <div><dt>来源提交</dt><dd><code id="market-detail-commit"></code></dd></div>
        <div><dt>更新时间</dt><dd id="market-detail-updated"></dd></div>
        <div><dt>上架时间</dt><dd id="market-detail-created"></dd></div>
        <div><dt>市场 ID</dt><dd><code id="market-detail-id"></code></dd></div>
        <div><dt>主题 ID</dt><dd><code id="market-detail-theme-id"></code></dd></div>
        <div><dt>包内文件</dt><dd id="market-detail-files"></dd></div>
       </dl>
       <div class="market-detail-actions"><a id="market-detail-download" class="market-download" download hidden>下载主题包</a><button type="button" id="market-detail-tryon" class="primary" hidden>在公司试装</button></div>
       <p id="market-tryon-status" class="market-status" role="status" aria-live="polite"></p>
       <p id="market-detail-mode-note" class="market-note"></p>
       <p id="market-scene-note" class="market-note"></p>
       <p class="market-note"><a id="market-source-link" target="_blank" rel="noreferrer noopener">查看 GitHub 来源</a></p>
      </div>
     </div>
    </div>
   </section>
  </div>`;
 document.body.append(dialog);

 const q=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>(`#${id}`)!;
 const catalogView=q<HTMLElement>('market-catalog');
 const detailView=q<HTMLElement>('market-detail');
 const detailContent=q<HTMLElement>('market-detail-content');
 const detailLoading=q<HTMLElement>('market-detail-loading');
 const detailLoadingText=q<HTMLElement>('market-detail-loading-text');
 const detailError=q<HTMLElement>('market-detail-error');
 const detailTitle=q<HTMLElement>('market-detail-title');
 const detailStatus=q<HTMLElement>('market-detail-status');
 const marketAlert=q<HTMLElement>('market-alert');
 const marketSource=q<HTMLElement>('market-source');
 const marketCount=q<HTMLElement>('market-count');
 const marketLoading=q<HTMLElement>('market-loading');
 const marketLoadingText=q<HTMLElement>('market-loading-text');
 const marketList=q<HTMLElement>('market-list');
 const marketEmpty=q<HTMLElement>('market-empty');
 const searchInput=q<HTMLInputElement>('market-search');
 const categorySelect=q<HTMLSelectElement>('market-category');
 const authorSelect=q<HTMLSelectElement>('market-author');
 const clearButton=q<HTMLButtonElement>('market-clear');
 const staticButton=q<HTMLButtonElement>('market-mode-static');
 const apiButton=q<HTMLButtonElement>('market-mode-api');
 const closeButton=q<HTMLButtonElement>('market-close');
 const backButton=q<HTMLButtonElement>('market-back');
 const previewSection=q<HTMLElement>('market-preview');
 const previewHost=q<HTMLElement>('market-preview-host');
 const previewButton=q<HTMLButtonElement>('market-preview-load');
 const previewStatus=q<HTMLElement>('market-preview-status');
 const downloadLink=q<HTMLAnchorElement>('market-detail-download');
 const tryOnButton=q<HTMLButtonElement>('market-detail-tryon');
 const tryOnStatus=q<HTMLElement>('market-tryon-status');
 const modeNote=q<HTMLElement>('market-detail-mode-note');
 const sceneNote=q<HTMLElement>('market-scene-note');
 const sourceLink=q<HTMLAnchorElement>('market-source-link');
 const gallery=q<HTMLElement>('market-gallery');
 const uiPreview=q<HTMLElement>('market-ui-preview');
 const uiSwatches=q<HTMLElement>('market-ui-swatches');

 let disposed=false;
 let catalogAbort:AbortController|undefined;
 let detailAbort:AbortController|undefined;
 let lastTrigger:HTMLElement|null=null;
 let previewToken=0;
 let tryOnToken=0;
 let filterSignature='';
 const state={
  mode:'static' as 'static'|'api',
  catalog:staticCatalog,
  categories:staticCatalog.categories,
  query:'',
  category:'',
  author:'',
  loading:false,
  catalogRequest:0,
  detailRequest:0,
  detail:null as MarketDetail|null,
  detailEntry:null as MarketEntry|null,
  previewHandle:null as MarketPreviewHandle|null
 };

 const setText=(id:string,value:string)=>{const element=q(id);element.textContent=value;};
 const setAlert=(message:string)=>{marketAlert.hidden=!message;marketAlert.textContent=message;};

 function modeLabel(){
  return state.mode==='api'
   ?'同源公司市场 · 已审核上架条目；图片与下载只使用固定 /api/market 路径'
   :'独立展厅静态目录 · 与公司市场尚未同步；不含详情字节、下载与试装';
 }

 function applyModeLabels(){
  marketSource.textContent=modeLabel();
  staticButton.setAttribute('aria-pressed',String(state.mode==='static'));
  apiButton.setAttribute('aria-pressed',String(state.mode==='api'));
  apiButton.textContent=state.mode==='api'?'刷新同源市场':'连接同源公司市场';
  staticButton.disabled=state.loading;
  apiButton.disabled=state.loading;
 }

 function setCatalogLoading(loading:boolean,text='正在读取市场目录…'){
  state.loading=loading;
  dialog.setAttribute('aria-busy',String(loading));
  marketLoading.hidden=!loading;
  marketLoadingText.textContent=text;
  marketList.hidden=loading;
  marketEmpty.hidden=loading?true:marketEmpty.hidden;
  staticButton.disabled=loading;
  apiButton.disabled=loading;
 }

 function syncFilters(){
  const authors=[...new Set(state.catalog.items.map(item=>item.author))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  const signature=`${state.categories.map(category=>`${category.id}\u0000${category.label}`).join('\u0001')}\u0002${authors.join('\u0001')}`;
  if(signature!==filterSignature){
   filterSignature=signature;
   categorySelect.replaceChildren(new Option('全部风格',''));
   for(const category of state.categories)categorySelect.append(new Option(category.label,category.id));
   authorSelect.replaceChildren(new Option('全部作者',''));
   for(const author of authors)authorSelect.append(new Option(author,author));
  }
  if(!state.categories.some(category=>category.id===state.category))state.category='';
  categorySelect.value=state.category;
  if(!authors.includes(state.author))state.author='';
  authorSelect.value=state.author;
 }

 function clearFilters(){
  state.query='';state.category='';state.author='';
  searchInput.value='';categorySelect.value='';authorSelect.value='';
  renderCatalog();
 }

 function renderCards(items:MarketEntry[]){
  marketList.replaceChildren();
  for(const entry of items)marketList.append(renderCard(entry));
  marketList.hidden=false;
 }

 function renderCard(entry:MarketEntry){
  const card=document.createElement('article');
  card.className='market-card';
  const cover=document.createElement('div');
  cover.className='market-card-cover';
  const missing=placeholder(state.mode==='api'?'预览图加载失败':'独立静态目录 · 无预览字节');
  cover.append(missing);
  if(state.mode==='api'&&entry.previewPath){
   try{
    const image=document.createElement('img');
    image.loading='lazy';image.decoding='async';image.alt=`${entry.title} 预览图`;
    image.src=buildMarketFileUrl(entry.id,entry.previewPath);
    image.addEventListener('error',()=>{image.remove();missing.hidden=false;});
    missing.hidden=true;cover.append(image);
   }catch{missing.hidden=false;}
  }
  const body=document.createElement('div');
  body.className='market-card-body';
  const title=document.createElement('h3');title.textContent=entry.title;
  const byline=document.createElement('p');byline.className='market-card-byline';byline.textContent=`${entry.author} · v${entry.version}`;
  const description=document.createElement('p');description.className='market-card-description';description.textContent=entry.description;
  const tags=document.createElement('div');tags.className='market-tags';
  for(const style of entry.styles){const tag=document.createElement('span');tag.textContent=style;tags.append(tag);}
  const meta=document.createElement('p');meta.className='market-card-meta';meta.textContent=`${entry.license} · ${entry.compatibleContract} · ${formatBytes(entry.totalBytes)} · 更新 ${formatDate(entry.updatedAt)}`;
  const commit=document.createElement('p');commit.className='market-card-commit';commit.textContent=`提交 ${entry.source.commit.slice(0,8)}`;commit.title=entry.source.commit;
  const actions=document.createElement('div');actions.className='market-card-actions';
  const detailButton=document.createElement('button');detailButton.type='button';detailButton.textContent='查看详情';detailButton.onclick=()=>openDetail(entry,detailButton);actions.append(detailButton);
  if(state.mode==='api'){
   const download=document.createElement('a');download.className='market-card-download';download.textContent='下载';download.href=buildMarketDownloadUrl(entry.id);download.setAttribute('download','');actions.append(download);
  }
  body.append(title,byline,description,tags,meta,commit,actions);
  card.append(cover,body);
  return card;
 }

 function renderCatalog(){
  applyModeLabels();
  syncFilters();
  const category=state.categories.find(item=>item.id===state.category);
  const styles=category?[category.id,category.label]:[];
  const filtered=filterMarketItems(state.catalog.items,{query:state.query,styles,author:state.author});
  const sorted=sortMarketItems(filtered,'newest');
  renderCards(sorted);
  const total=state.catalog.items.length;
  marketCount.textContent=total===0?'0 件已上架作品':filtered.length===total?`共 ${total} 件已上架作品`:`显示 ${filtered.length} / ${total} 件已上架作品`;
  marketEmpty.hidden=false;
  if(total===0){
   marketEmpty.textContent=state.mode==='static'
    ?'独立展厅的静态目录为空。当前没有已审核上架的公开作品；未审核、下架和公司私有方案不会出现在这里。连接同源公司市场可查看实时目录。'
    :'同源公司市场当前没有已审核上架的公开作品。';
  }else if(filtered.length===0){
   marketEmpty.textContent='没有符合搜索或筛选条件的作品。清除筛选后重试。';
  }else{
   marketEmpty.hidden=true;
  }
 }

 function disposePreview(){
  previewToken++;
  try{state.previewHandle?.dispose();}catch{}
  state.previewHandle=null;
  previewButton.disabled=false;
  previewButton.textContent='加载预览';
  previewStatus.textContent='';
 }

 function clearPreviewHost(text='尚未加载预览。'){
  previewHost.replaceChildren(placeholder(text));
 }

 function showCatalogView(){
  detailAbort?.abort();state.detailRequest++;tryOnToken++;
  disposePreview();
  state.detail=null;state.detailEntry=null;
  detailView.hidden=true;catalogView.hidden=false;
  detailContent.hidden=true;detailLoading.hidden=true;detailError.hidden=true;
  q<HTMLElement>('market-content').scrollTop=0;
 }

 function backToCatalog(){
  const trigger=lastTrigger;
  showCatalogView();
  if(trigger?.isConnected)trigger.focus();else closeButton.focus();
 }

 function applyDetailMeta(entry:MarketEntry){
  detailTitle.textContent=entry.title;
  setText('market-detail-byline',`${entry.author} · v${entry.version}`);
  setText('market-detail-description',entry.description);
  setText('market-detail-author',entry.author);
  setText('market-detail-version',entry.version);
  setText('market-detail-revision',String(entry.revision));
  setText('market-detail-license',entry.license);
  setText('market-detail-contract',entry.compatibleContract);
  setText('market-detail-size',`${formatBytes(entry.totalBytes)}（${entry.totalBytes} 字节）`);
  setText('market-detail-hash',entry.packageHash);
  setText('market-detail-commit',entry.source.commit);
  setText('market-detail-updated',formatDate(entry.updatedAt));
  setText('market-detail-created',formatDate(entry.createdAt));
  setText('market-detail-id',entry.id);
  setText('market-detail-theme-id',entry.themeId);
  setText('market-detail-files',`${entry.manifest.files.length} 个`);
  const tags=q<HTMLElement>('market-detail-tags');tags.replaceChildren();
  for(const style of entry.styles){const tag=document.createElement('span');tag.textContent=style;tags.append(tag);}
  sourceLink.href=entry.source.repository;
  sourceLink.textContent=`查看 GitHub 来源：${entry.source.repository}`;
 }

 function renderGallery(entry:MarketEntry,withBytes:boolean){
  gallery.replaceChildren();
  if(!withBytes){gallery.append(placeholder('独立静态目录不含图片字节；连接同源公司市场后加载真实预览与包内图片。'));return;}
  if(entry.images.length===0){gallery.append(placeholder('该作品包没有图片文件；不显示虚构封面。'));return;}
  for(const [index,path] of entry.images.entries()){
   const figure=document.createElement('figure');figure.className='market-shot';
   const image=document.createElement('img');image.loading='lazy';image.decoding='async';image.alt=`${entry.title} 包内图片 ${index+1}`;
   try{image.src=buildMarketFileUrl(entry.id,path);}catch{continue;}
   image.addEventListener('error',()=>{figure.replaceChildren(placeholder(`图片加载失败：${path}`));});
   const caption=document.createElement('figcaption');caption.textContent=path;
   figure.append(image,caption);gallery.append(figure);
  }
 }

 function renderStaticDetail(entry:MarketEntry){
  applyDetailMeta(entry);
  detailContent.hidden=false;detailLoading.hidden=true;detailError.hidden=true;
  detailStatus.textContent='独立静态目录 · 仅元数据';
  renderGallery(entry,false);
  uiPreview.hidden=true;uiSwatches.replaceChildren();
  previewSection.hidden=true;disposePreview();clearPreviewHost();
  downloadLink.hidden=true;downloadLink.removeAttribute('href');
  tryOnButton.hidden=true;tryOnButton.disabled=false;tryOnButton.textContent='在公司试装';tryOnStatus.textContent='';
  modeNote.textContent='独立展厅没有公司身份、岗位与装修权限，不能发起试装。连接同源公司市场后，由正式公司的授权人员操作。';
  sceneNote.textContent='静态目录未加载 theme/scene 字节；未渲染 scene.objects/lights，也未修改碰撞、门禁或员工路径。';
  detailTitle.focus();
 }

 function renderApiDetail(detail:MarketDetail){
  const entry=detail.entry;
  applyDetailMeta(entry);
  detailContent.hidden=false;detailLoading.hidden=true;detailError.hidden=true;
  detailStatus.textContent='同源公司市场 · 已审核上架';
  renderGallery(entry,true);
  const ui=(detail.theme as {ui?:Record<string,string>}).ui;
  uiSwatches.replaceChildren();
  if(ui){
   for(const key of ['paper','ink','muted','accent','line','error','horizon']){
    const color=ui[key];if(typeof color!=='string')continue;
    const swatch=document.createElement('span');swatch.className='market-swatch';
    const chip=document.createElement('i');chip.setAttribute('aria-hidden','true');chip.style.background=color;
    const label=document.createElement('small');label.textContent=key;
    swatch.append(chip,label);uiSwatches.append(swatch);
   }
  }
  uiPreview.hidden=uiSwatches.childElementCount===0;
  previewSection.hidden=false;disposePreview();clearPreviewHost();
  previewButton.disabled=false;previewButton.textContent='加载预览';
  previewStatus.textContent='尚未加载。预览只渲染基础主题；可编辑物件待集成。';
  downloadLink.href=buildMarketDownloadUrl(entry.id);downloadLink.hidden=false;
  tryOnButton.hidden=false;tryOnButton.disabled=false;tryOnButton.textContent='在公司试装';tryOnStatus.textContent='';
  modeNote.textContent='同源公司市场：详情、图片与下载来自固定 /api/market 路径；试装只请求公司私有草稿，不会直接修改正式装修，也没有公开审批按钮。';
  sceneNote.textContent=`详情 scene 已通过 ${entry.compatibleContract} 校验：${detail.scene.objects.length} 个可编辑物件、${detail.scene.lights.length} 盏装饰灯。当前 UI 只展示基础主题预览；可编辑物件待集成，未应用 scene.objects/lights。`;
  detailTitle.focus();
 }

 function showDetailError(error:unknown,entry:MarketEntry){
  detailLoading.hidden=true;detailContent.hidden=true;detailError.hidden=false;detailError.replaceChildren();
  const message=document.createElement('p');message.textContent=`详情加载失败：${errorText(error)}`;
  const retry=document.createElement('button');retry.type='button';retry.textContent='重试详情';retry.onclick=()=>void loadDetail(entry);
  detailError.append(message,retry);
  detailStatus.textContent='详情加载失败';retry.focus();
 }

 async function loadDetail(entry:MarketEntry){
  const request=++state.detailRequest;
  detailAbort?.abort();
  const controller=new AbortController();detailAbort=controller;
  detailLoading.hidden=false;detailLoadingText.textContent='正在读取同源市场详情…';detailContent.hidden=true;detailError.hidden=true;detailStatus.textContent='正在读取同源市场详情…';backButton.focus();
  try{
   const raw=await (options.loadDetails??defaultLoadDetails)(entry.id,controller.signal);
   if(request!==state.detailRequest||controller.signal.aborted||disposed)return;
   const detail=validateMarketDetail(raw,entry) as MarketDetail;
   if(request!==state.detailRequest||controller.signal.aborted||state.detailEntry?.id!==entry.id)return;
   state.detail=detail;
   renderApiDetail(detail);
  }catch(error){
   if(request!==state.detailRequest||controller.signal.aborted||disposed)return;
   showDetailError(error,entry);
  }
 }

 async function loadApiCatalog(){
  if(!detailView.hidden)showCatalogView();
  const request=++state.catalogRequest;
  catalogAbort?.abort();
  const controller=new AbortController();catalogAbort=controller;
  state.loading=true;applyModeLabels();setAlert('');setCatalogLoading(true,'正在连接同源公司市场…');marketCount.textContent='正在读取同源市场目录…';
  let loaded=false;
  try{
   const raw=await (options.loadCatalog??defaultLoadCatalog)(controller.signal);
   if(request!==state.catalogRequest||controller.signal.aborted||disposed)return;
   const catalog=validateMarketIndex(raw) as MarketCatalog;
   state.mode='api';
   state.catalog={...catalog,categories:catalog.categories.length?catalog.categories:staticCatalog.categories};
   state.categories=state.catalog.categories;
   loaded=true;
  }catch(error){
   if(request!==state.catalogRequest||controller.signal.aborted||disposed)return;
   state.mode='static';state.catalog=staticCatalog;state.categories=staticCatalog.categories;
   state.loading=false;setCatalogLoading(false);applyModeLabels();renderCatalog();
   setAlert(`连接同源公司市场失败：${errorText(error)}。独立展厅仍显示静态目录。`);
  }finally{
   if(request!==state.catalogRequest||disposed)return;
   state.loading=false;setCatalogLoading(false);applyModeLabels();
   if(loaded)renderCatalog();
  }
 }

 function switchStatic(){
  state.catalogRequest++;catalogAbort?.abort();
  state.loading=false;state.mode='static';state.catalog=staticCatalog;state.categories=staticCatalog.categories;state.author='';
  showCatalogView();
  setCatalogLoading(false);applyModeLabels();renderCatalog();setAlert(staticError);
 }

 function openDetail(entry:MarketEntry,trigger:HTMLElement){
  if(state.loading)return;
  lastTrigger=trigger;state.detailEntry=entry;state.detail=null;tryOnToken++;
  catalogView.hidden=true;detailView.hidden=false;detailContent.hidden=true;detailLoading.hidden=true;detailError.hidden=true;
  q<HTMLElement>('market-content').scrollTop=0;
  detailTitle.textContent=entry.title;detailStatus.textContent='正在准备详情…';backButton.focus();
  if(state.mode==='static')renderStaticDetail(entry);else void loadDetail(entry);
 }

 async function loadPreview(){
  if(!state.detail||state.mode!=='api')return;
  const detail=state.detail;
  const token=++previewToken;
  previewButton.disabled=true;previewButton.textContent='正在加载预览…';previewStatus.textContent='正在加载基础主题预览…';
  try{
   const handle=await options.preview({entry:detail.entry,detail,host:previewHost,onProgress:text=>{if(token===previewToken)previewStatus.textContent=text;}});
   if(token!==previewToken||state.detail!==detail||disposed){handle.dispose();return;}
   try{state.previewHandle?.dispose();}catch{}
   state.previewHandle=handle;
   previewStatus.textContent='基础主题预览已加载；可编辑物件待集成。';
  }catch(error){
   if(token===previewToken)previewStatus.textContent=`预览加载失败：${errorText(error)}。已保留原有预览（如有）。`;
  }finally{
   if(token===previewToken){previewButton.disabled=false;previewButton.textContent='加载预览';}
  }
 }

 async function requestTryOn(){
  if(!state.detail||state.mode!=='api')return;
  const detail=state.detail;
  const token=++tryOnToken;
  tryOnButton.disabled=true;tryOnButton.textContent='正在请求试装…';tryOnStatus.textContent='正在请求公司私有试装草稿；不会直接修改正式装修。';
  try{
   const result=await (options.tryOn??defaultTryOn)(detail.entry);
   if(token!==tryOnToken||state.detail!==detail||disposed)return;
   tryOnStatus.textContent=result.ok
    ?`${result.message}（展厅不会应用正式装修。）`
    :`试装未完成（HTTP ${result.status}）：${result.message||'服务器未说明原因'}。未修改正式公司装修。`;
  }catch(error){
   if(token!==tryOnToken||disposed)return;
   const prefix=error instanceof MarketHttpError?`试装接口失败（HTTP ${error.status}）`:'试装请求失败';
   tryOnStatus.textContent=`${prefix}：${error instanceof MarketHttpError?error.message:errorText(error)}。未修改正式公司装修。`;
  }finally{
   if(token===tryOnToken){tryOnButton.disabled=false;tryOnButton.textContent='在公司试装';}
  }
 }

 function open(){
  if(dialog.open)return;
  if(state.loading){state.catalogRequest++;catalogAbort?.abort();state.loading=false;setCatalogLoading(false);}
  showCatalogView();
  renderCatalog();
  setAlert(state.mode==='static'?staticError:'');
  dialog.showModal();
  closeButton.focus();
 }

 function close(){
  if(dialog.open)dialog.close();
 }

 function destroy(){
  disposed=true;
  catalogAbort?.abort();detailAbort?.abort();disposePreview();
  if(dialog.open)dialog.close();
  dialog.remove();
 }

 searchInput.addEventListener('input',()=>{state.query=searchInput.value;renderCatalog();});
 categorySelect.addEventListener('change',()=>{state.category=categorySelect.value;renderCatalog();});
 authorSelect.addEventListener('change',()=>{state.author=authorSelect.value;renderCatalog();});
 clearButton.addEventListener('click',clearFilters);
 staticButton.addEventListener('click',switchStatic);
 apiButton.addEventListener('click',()=>void loadApiCatalog());
 closeButton.addEventListener('click',close);
 backButton.addEventListener('click',backToCatalog);
 previewButton.addEventListener('click',()=>void loadPreview());
 tryOnButton.addEventListener('click',()=>void requestTryOn());
 dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
 dialog.addEventListener('cancel',event=>{if(!detailView.hidden){event.preventDefault();backToCatalog();}});
 dialog.addEventListener('close',()=>{
  catalogAbort?.abort();detailAbort?.abort();tryOnToken++;disposePreview();
  state.loading=false;setCatalogLoading(false);
  state.detail=null;state.detailEntry=null;detailView.hidden=true;catalogView.hidden=false;
  if(!disposed)options.openButton.focus();
 });
 applyModeLabels();
 return {open,close,destroy};
}
