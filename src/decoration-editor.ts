import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OfficeVisuals} from './office';
import {validateTheme,THEMES,MODEL_IDS} from './theme.js';
import {validateDecorationSafety,DECORATION_ZONES,SURFACE_IDS,FIXTURE_SLOTS} from './decoration-safety.js';
import {buildThemePackage,createZip,effectiveModelPaths,sha256Hex} from './theme-package-export.js';
import catalog from '../asset-catalog.json' with {type:'json'};
import mitLicenseText from '../LICENSE.md?raw';
import './decoration-editor.css';

type DecorationObject={id:string;model:string;position:number[];rotationY:number;scale:number[]};
type DecorationLight={id:string;position:number[];color:string;intensity:number;distance:number};
type DecorationSurface={id:string;color:string;roughness:number;metalness:number};
type DecorationFixture={id:string;model:string};
type DecorationScene={schemaVersion:number;compatibleContract:string;objects:DecorationObject[];lights:DecorationLight[];surfaces?:DecorationSurface[];fixtures?:DecorationFixture[]};
export type Design={theme:ReturnType<typeof validateTheme>;scene:DecorationScene};
type Options={assetBase?:string|null;packageAssetBase?:string|null;runtimeAssetBase?:string;readOnly?:boolean;comparison?:Design;comparisonAssetBase?:string|null;save?:(design:Design)=>Promise<void>;submit?:()=>Promise<void>};
type CatalogEntry={path:string;bytes:number;sha256:string;license:string;source:string};
const assetCatalog=catalog as CatalogEntry[];
const PUBLIC_REPOSITORY='https://github.com/Handsome5201314/company-visual-studio';
const BASELINE_COMMIT=import.meta.env.VITE_VISUAL_SOURCE_COMMIT||'';
const defaultPackageAssetBase=new URL('../../',document.baseURI).href;
const SURFACE_LABELS:Record<string,string>={floor:'一楼地板',mezzanine:'夹层地板','back-wall':'背墙','acoustic':'木饰吸音墙','reception-front':'接待台立面',worktops:'工作台面','office-wall':'办公室墙面',railings:'楼梯栏杆'};
const SURFACE_DEFAULTS:Record<string,{base:string;roughness:number;metalness:number}>={floor:{base:'#c7a47d',roughness:.8,metalness:0},mezzanine:{base:'#796246',roughness:.8,metalness:0},'back-wall':{base:'#e6dcc6',roughness:.8,metalness:0},acoustic:{base:'#6c805a',roughness:.8,metalness:0},'reception-front':{base:'#aa7954',roughness:.8,metalness:0},worktops:{base:'#d7ba91',roughness:.8,metalness:0},'office-wall':{base:'#788364',roughness:.8,metalness:0},railings:{base:'#3f4c3d',roughness:.8,metalness:0}};
const empty=()=>({schemaVersion:1,compatibleContract:'hq-fixed-layout-v1',objects:[],lights:[]});
const copy=<V>(v:V):V=>structuredClone(v);
export function createDecorationEditor(host:HTMLElement,initial:Partial<Design>={},options:Options={}){
 let design:Design={theme:validateTheme(initial.theme||THEMES[0]),scene:validateDecorationSafety(initial.scene||empty())},original=options.comparison?{theme:validateTheme(options.comparison.theme),scene:validateDecorationSafety(options.comparison.scene)}:copy(design);
 let office:OfficeVisuals|undefined,alive=true,busy=false,selected='',compare=false,generation=0,submitted=false,contextLost=false;
 const past:Design[]=[],future:Design[]=[];
 host.classList.add('decoration-editor');host.innerHTML=`<div class="de-stage"><div data-canvas></div><p data-load role="status">正在布置编辑场景…</p><div class="de-scene-error" hidden data-scene-error role="alert"><p data-scene-error-text></p><button type="button" data-retry>重新加载预览</button></div><p class="de-guide">拖动环绕 · 选中物件后可拖动摆放 · 绿色框为安全编辑范围</p></div><aside class="de-tools" aria-label="装修创作工具"><h3>装修工作台</h3><p>保留建筑、路线与角色。新陈设放入绿色区域；此处修改均为草稿。</p><label>空间风格<select data-theme></select></label><label>已添加物件<select data-selection><option value="">选择一个物件</option></select></label><label>家具模型<select data-model></select></label><label>添加到<select data-zone></select></label><button data-add>添加陈设</button><fieldset data-transform disabled><legend>选中物件</legend><div class="de-coordinates"><label>X<input data-x type="number" step="0.05"></label><label>Y<input data-y type="number" step="0.05"></label><label>Z<input data-z type="number" step="0.05"></label></div><label>朝向（度）<input data-angle type="number" step="15"></label><label>高度（米）<input data-size type="number" min="0.05" max="2" step="0.05"></label><button data-transform-apply>更新位置与尺寸</button><button data-replace>替换选中模型</button><button data-remove>删除选中陈设</button></fieldset><label>木饰／主体材质<input data-color type="color"></label><button data-material>应用材质</button><label>装饰灯颜色<input data-light-color type="color" value="#ffcc88"></label><label>装饰灯强度<input data-intensity type="range" min="0" max="3" step="0.1" value="1"></label><button data-light>设置接待区装饰灯</button><fieldset data-surface-fieldset><legend>建筑饰面</legend><p class="de-field-note">只调整固定饰面材质；不改变墙体、碰撞、门禁或导航。</p><label>饰面<select data-surface></select></label><label>颜色<input data-surface-color type="color"></label><div class="de-range-row"><label>粗糙度<input data-surface-roughness type="range" min="0.15" max="1" step="0.05"></label><output data-surface-roughness-value></output></div><div class="de-range-row"><label>金属度<input data-surface-metalness type="range" min="0" max="1" step="0.05"></label><output data-surface-metalness-value></output></div><div class="de-pair-actions"><button data-surface-apply>应用饰面</button><button data-surface-reset>恢复默认饰面</button></div></fieldset><fieldset data-fixture-fieldset><legend>固定家具替换</legend><p class="de-field-note">只能替换槽位准入模型；位置、碰撞、门禁和导航固定，不能移动槽位。</p><label>固定槽位<select data-fixture></select></label><label>准入模型<select data-fixture-model></select></label><div class="de-pair-actions"><button data-fixture-apply>应用替换</button><button data-fixture-reset>恢复默认家具</button></div></fieldset><div class="de-actions"><button data-undo disabled>撤销</button><button data-redo disabled>重做</button><button data-compare>查看修改前</button><button data-export>导出设计 JSON（草稿）</button><button data-screenshot>保存预览图</button><button data-export-package class="primary">下载完整主题包 (.zip)</button></div><details class="de-package"><summary>完整主题包元数据（GitHub 投稿用）</summary><p class="de-package-note">包 ID 需唯一。包含 theme.json、scene.json、13 种家具映射及其实际模型与对应许可（主题模型包含自制 MIT 和 Kenney CC0，以清单实际值）、README 与当前画面截图。代码按 MIT；技术包不等于市场上架或公司应用审批。来源 commit 是本次导出使用的源码基线 commit，不是包含本 manifest 的提交（后者会形成哈希自引用，无法实现）。默认填入本构建的源码 commit；本地修改应先提交源码，再构建和导出；Fork 时同时改来源仓库。下载 zip 解压到 themes/&lt;你的包 ID&gt;/ 后再提交 PR。</p><label>包 ID<input data-package-id maxlength="41" autocomplete="off"></label><label>名称<input data-package-name maxlength="200"></label><label>作者<input data-package-author maxlength="200"></label><label>版本<input data-package-version maxlength="40" autocomplete="off"></label><label>风格标签（逗号分隔）<input data-package-styles maxlength="200" autocomplete="off"></label><label>简介<textarea data-package-description rows="2" maxlength="2000"></textarea></label><label>来源仓库<input data-package-repository maxlength="200" autocomplete="off"></label><label>源码基线 commit（40 位小写十六进制）<input data-package-commit maxlength="40" autocomplete="off" spellcheck="false" placeholder="被导出源码所在的 Git commit；不要求包含本 manifest"></label><p class="de-package-status">包内不包含 Draco JS/WASM，也不执行任何主题脚本。请确认你有权公开所选素材。</p></details><label>导入兼容设计<input data-import type="file" accept=".json,application/json"></label><button data-save class="primary">${options.save?'保存公司草稿':'保存到本机文件'}</button>${options.submit?'<button data-submit>提交老板审批</button>':''}<p data-message role="status" aria-live="polite"></p></aside>`;
 const $=<E extends HTMLElement=HTMLElement>(s:string)=>host.querySelector<E>(s)!;
 const status=(s:string,error=false)=>{$('[data-message]').textContent=s;$('[data-message]').classList.toggle('error',error);$('[data-scene-error]').hidden=!error;if(error)$('[data-scene-error-text]').textContent=s;};
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,1,.08,180),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.domElement.setAttribute('aria-label','装修草稿三维预览，可环绕；也可用右侧表单精确摆放');$('[data-canvas]').append(renderer.domElement);
 camera.position.set(19,14,23);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2,0);controls.maxPolarAngle=Math.PI*.49;controls.minDistance=3;controls.maxDistance=55;
 const zones=new T.Group();for(const z of DECORATION_ZONES){const size=new T.Vector3(...z.max as [number,number,number]).sub(new T.Vector3(...z.min as [number,number,number])),box=new T.Box3Helper(new T.Box3(new T.Vector3(...z.min as [number,number,number]),new T.Vector3(...z.max as [number,number,number])),0x3c925b);box.userData.size=size;zones.add(box);}scene.add(zones);
 const observer=new ResizeObserver(()=>{const b=$('[data-canvas]').getBoundingClientRect();renderer.setSize(Math.max(1,b.width),Math.max(1,b.height),false);camera.aspect=b.width/Math.max(1,b.height);camera.updateProjectionMatrix();});observer.observe($('[data-canvas]'));
 renderer.setAnimationLoop(()=>{if(alive){controls.update();renderer.render(scene,camera);}});
 const themes=$<HTMLSelectElement>('[data-theme]'),models=$<HTMLSelectElement>('[data-model]'),zone=$<HTMLSelectElement>('[data-zone]');
 const surfaceSelect=$<HTMLSelectElement>('[data-surface]'),surfaceColor=$<HTMLInputElement>('[data-surface-color]'),surfaceRoughness=$<HTMLInputElement>('[data-surface-roughness]'),surfaceMetalness=$<HTMLInputElement>('[data-surface-metalness]'),surfaceRoughnessValue=$<HTMLOutputElement>('[data-surface-roughness-value]'),surfaceMetalnessValue=$<HTMLOutputElement>('[data-surface-metalness-value]'),surfaceFieldset=$<HTMLFieldSetElement>('[data-surface-fieldset]');
 const fixtureSelect=$<HTMLSelectElement>('[data-fixture]'),fixtureModel=$<HTMLSelectElement>('[data-fixture-model]'),fixtureFieldset=$<HTMLFieldSetElement>('[data-fixture-fieldset]');
 let selectedSurfaceId=SURFACE_IDS[0]??'floor',selectedFixtureId=FIXTURE_SLOTS[0]?.id??'';
 const packageId=$<HTMLInputElement>('[data-package-id]'),packageName=$<HTMLInputElement>('[data-package-name]'),packageAuthor=$<HTMLInputElement>('[data-package-author]'),packageVersion=$<HTMLInputElement>('[data-package-version]'),packageStyles=$<HTMLInputElement>('[data-package-styles]'),packageDescription=$<HTMLTextAreaElement>('[data-package-description]'),packageRepository=$<HTMLInputElement>('[data-package-repository]'),packageCommit=$<HTMLInputElement>('[data-package-commit]');
 const packageInputs=[packageId,packageName,packageAuthor,packageVersion,packageStyles,packageDescription,packageRepository,packageCommit];
 let packageMetadataCustomized=false;
 const query=new URLSearchParams(location.search);
 packageRepository.value=query.get('repository')||PUBLIC_REPOSITORY;packageCommit.value=query.get('commit')||BASELINE_COMMIT;
 for(const input of packageInputs)input.addEventListener('input',()=>{packageMetadataCustomized=true;});
 function fillPackageMeta(theme:ReturnType<typeof validateTheme>){
  packageId.value=theme.id;packageName.value=theme.name;packageAuthor.value=theme.author;packageVersion.value=theme.version;packageDescription.value=theme.description;packageStyles.value=theme.id==='default'?'warm-wood':theme.id==='cyber'?'cool-blue':theme.id;
 }
 fillPackageMeta(design.theme);
 const opt=(value:string,label:string)=>{const n=document.createElement('option');n.value=value;n.textContent=label;return n;};
 themes.replaceChildren(...THEMES.map(t=>opt(t.id,t.name)));models.replaceChildren(...MODEL_IDS.map(id=>opt(id,id)));models.value='plantsmall1';zone.replaceChildren(...DECORATION_ZONES.map(z=>opt(z.id,z.name)));
 surfaceSelect.replaceChildren(...SURFACE_IDS.map(id=>opt(id,SURFACE_LABELS[id]||id)));fixtureSelect.replaceChildren(...FIXTURE_SLOTS.map(slot=>opt(slot.id,slot.name)));
 function surfaceDefault(id:string){
  const definition=SURFACE_DEFAULTS[id]??{base:'#d7ba91',roughness:.8,metalness:0};
  return {color:design.theme.environment.palette[definition.base]||definition.base,roughness:definition.roughness,metalness:definition.metalness};
 }
 function syncAppearanceControls(){
  if(!SURFACE_IDS.includes(selectedSurfaceId))selectedSurfaceId=SURFACE_IDS[0]??'floor';
  surfaceSelect.value=selectedSurfaceId;
  const surface=design.scene.surfaces?.find(item=>item.id===selectedSurfaceId),defaults=surfaceDefault(selectedSurfaceId);
  surfaceColor.value=surface?.color??defaults.color;surfaceRoughness.value=String(surface?.roughness??defaults.roughness);surfaceMetalness.value=String(surface?.metalness??defaults.metalness);
  surfaceRoughnessValue.value=Number(surfaceRoughness.value).toFixed(2);surfaceMetalnessValue.value=Number(surfaceMetalness.value).toFixed(2);
  if(!FIXTURE_SLOTS.some(slot=>slot.id===selectedFixtureId))selectedFixtureId=FIXTURE_SLOTS[0]?.id??'';
  fixtureSelect.value=selectedFixtureId;
  const slot=FIXTURE_SLOTS.find(item=>item.id===selectedFixtureId);if(!slot)return;
  const override=design.scene.fixtures?.find(item=>item.id===slot.id),model=override?.model&&slot.models.includes(override.model)?override.model:slot.model;
  fixtureModel.replaceChildren(...slot.models.map(id=>opt(id,id)));fixtureModel.value=model;
 }
 function reflect(){
  const locked=busy||compare||submitted||Boolean(options.readOnly);
  host.setAttribute('aria-busy',String(busy));host.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement|HTMLTextAreaElement>('.de-tools input,.de-tools button,.de-tools select,.de-tools textarea').forEach(el=>el.disabled=locked);$<HTMLButtonElement>('[data-compare]').disabled=busy;
  surfaceFieldset.disabled=locked;fixtureFieldset.disabled=locked;
  themes.value=design.theme.id;$<HTMLInputElement>('[data-color]').value=design.theme.environment.palette['#d7ba91']||'#d7ba91';syncAppearanceControls();
  const list=$<HTMLSelectElement>('[data-selection]');list.replaceChildren(opt('','选择一个物件'),...design.scene.objects.map(o=>opt(o.id,`${o.id} · ${o.model}`)));list.value=selected;
  const o=design.scene.objects.find(o=>o.id===selected);$<HTMLFieldSetElement>('[data-transform]').disabled=!o||busy||compare||submitted;
  ['x','y','z'].forEach((a,i)=>$<HTMLInputElement>(`[data-${a}]`).value=o?String(o.position[i]):'');$<HTMLInputElement>('[data-angle]').value=o?String(Math.round(o.rotationY*180/Math.PI)):'';$<HTMLInputElement>('[data-size]').value=o?String(o.scale[1]):'';
  $<HTMLButtonElement>('[data-undo]').disabled=!past.length||busy||compare||submitted;$<HTMLButtonElement>('[data-redo]').disabled=!future.length||busy||compare||submitted;
 }
 async function render(){
  if(contextLost){status('三维连接已中断，请返回并重新打开此预览。',true);return;}const token=++generation;busy=true;$('[data-scene-error]').hidden=true;$('[data-load]').textContent='正在验证并加载草稿…';reflect();
  const d=compare?original:design,candidate=new OfficeVisuals(new T.Scene(),options.runtimeAssetBase||'/',[],d.theme,(compare&&options.comparison?options.comparisonAssetBase:options.assetBase)||undefined);
  try{await candidate.load(s=>{if(alive&&token===generation)$('[data-load]').textContent=s;});candidate.setDecoration(d.scene);if(!alive||token!==generation){candidate.dispose();return;}office?.dispose();office=candidate;candidate.attachTo(scene);renderer.toneMappingExposure=d.theme.environment.exposure;$('[data-load]').textContent=compare?'正在对比：修改前':'草稿预览 · 尚未正式应用';}
  catch(e){candidate.dispose();if(alive&&token===generation){$('[data-load]').textContent=office?'预览失败 · 保留上次画面':'预览加载失败';$('[data-retry]').hidden=false;status('预览失败：'+(e as Error).message+'。可重试，或返回重新打开。',true);}throw e;}
  finally{if(alive&&token===generation){busy=false;reflect();}}
 }
 function change(next:Design){if(busy||compare||submitted||options.readOnly){status('请等待加载，或先返回可编辑草稿。',true);return;}try{const valid={theme:validateTheme(next.theme),scene:validateDecorationSafety(next.scene)};office?.setDecoration(valid.scene);office?.setTheme(valid.theme);past.push(copy(design));if(past.length>50)past.shift();future.length=0;design=valid;reflect();status('修改已进入本地草稿；尚未提交。');}catch(e){status((e as Error).message,true);}}
 function mutate(fn:(d:Design)=>void){const next=copy(design);try{fn(next);change(next);}catch(e){status((e as Error).message,true);}}
 $('[data-add]').onclick=()=>mutate(d=>{const z=DECORATION_ZONES.find(z=>z.id===zone.value)!;const id='item-'+crypto.randomUUID().slice(0,8);d.scene.objects.push({id,model:models.value,position:[(z.min[0]+z.max[0])/2,z.min[1],(z.min[2]+z.max[2])/2],rotationY:0,scale:[.2,.2,.2]});selected=id;});
 $<HTMLSelectElement>('[data-selection]').onchange=e=>{selected=(e.target as HTMLSelectElement).value;reflect();};
 $('[data-transform-apply]').onclick=()=>mutate(d=>{const o=d.scene.objects.find(o=>o.id===selected)!;o.position=['x','y','z'].map(a=>Math.round(Number($<HTMLInputElement>(`[data-${a}]`).value)/.05)*.05);o.rotationY=Number($<HTMLInputElement>('[data-angle]').value)*Math.PI/180;const size=Number($<HTMLInputElement>('[data-size]').value);o.scale=[size,size,size];});
 $('[data-remove]').onclick=()=>mutate(d=>{d.scene.objects=d.scene.objects.filter(o=>o.id!==selected);selected='';});
 $('[data-replace]').onclick=()=>mutate(d=>{d.scene.objects.find(o=>o.id===selected)!.model=models.value;});
 $('[data-material]').onclick=()=>mutate(d=>{d.theme.environment.palette['#d7ba91']=$<HTMLInputElement>('[data-color]').value;});
 $('[data-light]').onclick=()=>mutate(d=>{const light={id:'reception-light',position:[-5,3,1],color:$<HTMLInputElement>('[data-light-color]').value,intensity:Number($<HTMLInputElement>('[data-intensity]').value),distance:5};const i=d.scene.lights.findIndex(l=>l.id===light.id);if(i>=0)d.scene.lights[i]=light;else d.scene.lights.push(light);});
 surfaceRoughness.addEventListener('input',()=>{surfaceRoughnessValue.value=Number(surfaceRoughness.value).toFixed(2);});
 surfaceMetalness.addEventListener('input',()=>{surfaceMetalnessValue.value=Number(surfaceMetalness.value).toFixed(2);});
 surfaceSelect.onchange=()=>{selectedSurfaceId=surfaceSelect.value;reflect();};
 fixtureSelect.onchange=()=>{selectedFixtureId=fixtureSelect.value;reflect();};
 $('[data-surface-apply]').onclick=()=>mutate(d=>{
  const surface={id:selectedSurfaceId,color:surfaceColor.value,roughness:Number(surfaceRoughness.value),metalness:Number(surfaceMetalness.value)};
  const surfaces=d.scene.surfaces?[...d.scene.surfaces]:[];const index=surfaces.findIndex(item=>item.id===surface.id);
  if(index>=0)surfaces[index]=surface;else surfaces.push(surface);d.scene.surfaces=surfaces;
 });
 $('[data-surface-reset]').onclick=()=>{
  if(!design.scene.surfaces?.some(item=>item.id===selectedSurfaceId)){status('该饰面已经是默认值。');return;}
  mutate(d=>{const surfaces=(d.scene.surfaces??[]).filter(item=>item.id!==selectedSurfaceId);if(surfaces.length)d.scene.surfaces=surfaces;else delete d.scene.surfaces;});
 };
 $('[data-fixture-apply]').onclick=()=>{
  const slot=FIXTURE_SLOTS.find(item=>item.id===selectedFixtureId);if(!slot)return;
  const model=fixtureModel.value;if(!slot.models.includes(model)){status('固定家具只能使用该槽位准入模型。',true);return;}
  mutate(d=>{const fixtures=d.scene.fixtures?[...d.scene.fixtures]:[];const index=fixtures.findIndex(item=>item.id===slot.id);const fixture={id:slot.id,model};if(index>=0)fixtures[index]=fixture;else fixtures.push(fixture);d.scene.fixtures=fixtures;});
 };
 $('[data-fixture-reset]').onclick=()=>{
  if(!design.scene.fixtures?.some(item=>item.id===selectedFixtureId)){status('该槽位已经是默认家具。');return;}
  mutate(d=>{const fixtures=(d.scene.fixtures??[]).filter(item=>item.id!==selectedFixtureId);if(fixtures.length)d.scene.fixtures=fixtures;else delete d.scene.fixtures;});
 };
 themes.onchange=()=>{if(busy||compare)return;const theme=THEMES.find(t=>t.id===themes.value)!;if(!packageMetadataCustomized)fillPackageMeta(theme);past.push(copy(design));future.length=0;design={theme:copy(theme),scene:copy(design.scene)};void render().catch(e=>status((e as Error).message,true));};
 function history(from:Design[],to:Design[]){if(busy||compare)return;const d=from.pop();if(!d)return;to.push(copy(design));design=d;selected='';void render().catch(e=>status((e as Error).message,true));}
 $('[data-undo]').onclick=()=>history(past,future);$('[data-redo]').onclick=()=>history(future,past);
 $('[data-compare]').onclick=()=>{if(busy)return;compare=!compare;$('[data-compare]').textContent=compare?'返回当前设计':'查看修改前';void render().catch(e=>status((e as Error).message,true));};
 function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const packageAssetBase=(options.packageAssetBase??defaultPackageAssetBase).replace(/\/$/,'')+'/';
 const packageMessage=(text:string,error=false)=>{$('[data-message]').textContent=text;$('[data-message]').classList.toggle('error',error);};
 async function readCatalogAsset(path:string):Promise<Uint8Array>{
  const entry=assetCatalog.find(item=>item.path===path);if(!entry)throw new Error(`asset-catalog缺少资源：${path}`);
  const response=await fetch(packageAssetBase+path,{credentials:'same-origin'});if(!response.ok)throw new Error(`读取现有资源失败：${path}（HTTP ${response.status}）`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length!==entry.bytes)throw new Error(`资源字节数与asset-catalog不符：${path}`);
  if(await sha256Hex(bytes)!==entry.sha256)throw new Error(`资源SHA256与asset-catalog不符：${path}`);
  return bytes;
 }
 async function capturePackagePreview():Promise<Uint8Array>{
  if(contextLost||!office)throw new Error('三维预览尚未就绪');
  const source=renderer.domElement;if(!source.width||!source.height)throw new Error('三维画布尺寸无效');
  const scale=Math.min(1,1280/source.width,800/source.height),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('无法创建预览图画布');
  const zonesVisible=zones.visible;zones.visible=false;
  try{renderer.render(scene,camera);context.drawImage(source,0,0,canvas.width,canvas.height);}finally{zones.visible=zonesVisible;renderer.render(scene,camera);}
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(image=>image?resolve(image):reject(new Error('预览图导出失败')),'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
 }
 function readPackageMetadata(){
  const id=packageId.value.trim(),name=packageName.value.trim(),author=packageAuthor.value.trim(),version=packageVersion.value.trim(),description=packageDescription.value.trim(),repository=packageRepository.value.trim();
  const required:Array<[HTMLInputElement|HTMLTextAreaElement,string,string]>=[ [packageId,id,'包 ID'],[packageName,name,'名称'],[packageAuthor,author,'作者'],[packageVersion,version,'版本'],[packageDescription,description,'简介'],[packageRepository,repository,'来源仓库'] ];
  for(const [input,value,label] of required)if(!value){packageMessage(`请先填写${label}。`,true);input.focus();return null;}
  const commit=packageCommit.value.trim().toLowerCase();if(!/^[a-f0-9]{40}$/.test(commit)){packageMessage('请填写 40 位源码基线 commit；不要求包含本 manifest。',true);packageCommit.focus();return null;}
  const styles=packageStyles.value.split(',').map(value=>value.trim()).filter(Boolean);if(!styles.length){packageMessage('请至少填写一个风格标签。',true);packageStyles.focus();return null;}
  return {id,name,author,version,description,styles,repository,commit};
 }
 async function exportCompletePackage(){
  if(busy||compare||submitted||options.readOnly)return;
  const metadata=readPackageMetadata();if(!metadata)return;
  busy=true;reflect();packageMessage('正在读取并校验现有家具、许可证与资源哈希…');
  try{
   const modelEntries:Array<{path:string;bytes:Uint8Array;license:string;source:string}>=[];
   const modelPaths=[...new Set(Object.values(effectiveModelPaths(design.theme)))];
   for(const path of modelPaths){
    const entry=assetCatalog.find(item=>item.path===path);if(!entry)throw new Error(`asset-catalog缺少家具：${path}`);
    modelEntries.push({path,bytes:await readCatalogAsset(path),license:entry.license,source:entry.source});
   }
   const licensePath='licenses/Kenney-CC0.txt',licenseEntry=assetCatalog.find(item=>item.path===licensePath);if(!licenseEntry)throw new Error('asset-catalog缺少家具许可证');
   const modelLicense=await readCatalogAsset(licensePath);
   packageMessage('正在截取当前设计的真实预览图…');const preview=await capturePackagePreview();
   packageMessage('正在计算 SHA256、校验协议并生成完整主题包…');
   const result=await buildThemePackage({theme:design.theme,scene:design.scene,preview,licenseText:mitLicenseText,modelLicense:{path:licensePath,bytes:modelLicense,license:licenseEntry.license,source:licenseEntry.source},models:modelEntries,metadata});
   const archive=createZip(result.archiveFiles);download(new Blob([archive],{type:'application/zip'}),`${result.manifest.id}-${result.manifest.version}.company-theme.zip`);
   packageMessage(`完整主题包已下载：${result.manifest.id}@${result.manifest.version} · ${result.archiveFiles.length} 个文件 · ${result.totalBytes} 字节 · ${result.digest}`);
  }catch(e){packageMessage('完整主题包生成失败：'+(e as Error).message,true);}finally{busy=false;if(alive)reflect();}
 }
 const exportDesign=()=>download(new Blob([JSON.stringify(design,null,2)],{type:'application/json'}),'company-design.json');
 $('[data-export]').onclick=exportDesign;$('[data-export-package]').onclick=()=>void exportCompletePackage();$('[data-screenshot]').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(b=>{if(b)download(b,'company-design-preview.png');else status('预览图导出失败，请重试',true);});};
 $<HTMLInputElement>('[data-import]').onchange=async e=>{
  const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;
  if(busy||compare||submitted||options.readOnly){input.value='';status('请等待当前操作结束，并返回可编辑草稿后导入。',true);return;}
  busy=true;reflect();status('正在读取并验证设计文件…');
  try{
   if(file.size>1024*1024)throw Error('设计文件不能超过1 MiB');const parsed=JSON.parse(await file.text());if(!alive)return;
   const valid={theme:validateTheme(parsed.theme),scene:validateDecorationSafety(parsed.scene)};
   if(options.assetBase&&JSON.stringify(valid.theme.models)!==JSON.stringify(original.theme.models))throw Error('此公司草稿不能导入未验证模型');
   past.push(copy(design));future.length=0;design=valid;selected='';await render();status('设计已导入本地草稿，尚未保存。');
  }catch(e){if(alive)status((e as Error).message,true);}finally{input.value='';busy=false;if(alive)reflect();}
 };
 $('[data-save]').onclick=async()=>{
  if(busy||compare||submitted)return;if(!options.save){exportDesign();return;}
  const snapshot=copy(design);busy=true;reflect();status('正在保存公司私有草稿…');
  try{await options.save(snapshot);if(alive){original=copy(snapshot);status('公司私有草稿已保存；仍需老板审批。');}}
  catch(e){if(alive)status((e as Error).message,true);}finally{busy=false;if(alive)reflect();}
 };
 if(options.submit)$('[data-submit]').onclick=async()=>{
  if(busy||compare||submitted)return;const snapshot=copy(design);busy=true;reflect();status('正在保存并提交老板审批…');
  try{if(options.save){await options.save(snapshot);original=copy(snapshot);}await options.submit!();if(alive){submitted=true;status('已提交老板审批，正式装修保持原版本。');}}
  catch(e){if(alive)status((e as Error).message,true);}finally{busy=false;if(alive)reflect();}
 };
 $('[data-retry]').onclick=()=>void render().catch(e=>status((e as Error).message,true));
 const ray=new T.Raycaster(),pointer=new T.Vector2();let drag:{id:string;start:T.Vector3;y:number;offset:T.Vector3}|undefined;
 function aim(e:PointerEvent){const b=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);}
 renderer.domElement.addEventListener('pointerdown',e=>{if(options.readOnly||busy||compare||e.button!==0||!office)return;aim(e);const hit=ray.intersectObject(office.decorations,true)[0];if(!hit)return;let o:T.Object3D|undefined=hit.object;while(o&&!o.userData.decorationId)o=o.parent||undefined;if(!o)return;selected=o.userData.decorationId;const point=new T.Vector3();if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-o.position.y),point))return;drag={id:selected,start:o.position.clone(),y:o.position.y,offset:point.sub(o.position)};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);reflect();e.stopImmediatePropagation();},{capture:true});
 renderer.domElement.addEventListener('pointermove',e=>{if(!drag||!office)return;aim(e);const p=new T.Vector3();if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-drag.y),p))return;p.sub(drag.offset);p.x=Math.round(p.x/.05)*.05;p.z=Math.round(p.z/.05)*.05;const o=office.decorations.children.find(o=>o.userData.decorationId===drag!.id);o?.position.set(p.x,drag.y,p.z);});
 const finish=()=>{if(!drag||!office)return;const o=office.decorations.children.find(o=>o.userData.decorationId===drag!.id),id=drag.id,pos=o?.position.toArray();controls.enabled=true;drag=undefined;if(pos)mutate(d=>{d.scene.objects.find(o=>o.id===id)!.position=pos;});office.setDecoration(design.scene);};
 renderer.domElement.addEventListener('pointerup',finish);renderer.domElement.addEventListener('pointercancel',finish);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;renderer.setAnimationLoop(null);$('[data-load]').textContent='三维连接已中断';$('[data-retry]').hidden=true;status('三维连接中断，请返回并重新打开预览。',true);});
 if(options.readOnly){host.classList.add('de-readonly');zones.visible=false;$('[data-transform]').setAttribute('disabled','');$('.de-guide').textContent='只读审核预览 · 拖动环绕，滚轮缩放';if(options.comparison){const b=$('[data-compare]');b.className='de-comparison';$('.de-stage').append(b);}}
 reflect();void render().catch(e=>status((e as Error).message,true));
 return {get design(){return copy(design);},dispose(){alive=false;generation++;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();office?.dispose();zones.traverse(o=>{if(o instanceof T.LineSegments){o.geometry.dispose();([o.material].flat()).forEach(m=>m.dispose());}});renderer.dispose();host.replaceChildren();}};
}
