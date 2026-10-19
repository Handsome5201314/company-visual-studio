import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {OfficeVisuals} from '../../src/office';
import {THEMES,applyUITheme,applyCharacterSkin} from '../../src/theme.js';
import {inspectGLB} from '../../src/glb.js';
import {createContentRoom} from '../../src/ui/workflows/content';
import {createEmployeeDesk} from '../../src/ui/workflows/employee';
import {previewAPI} from './fixtures';
import {createMarket,type MarketPreviewHandle,type MarketPreviewRequest} from './market';
import contract from '../../src/layout-contract.json';
import '../../src/ui/style.css';
import './showroom.css';
import './market.css';

document.querySelector('#app')!.innerHTML=`
 <header class="studio-header"><div><h1>公司视觉工作室</h1><p>童医魔盒 · 场景、界面与角色外观协作</p></div><div class="studio-header-actions"><a class="market-open" href="./apps/editor/index.html">装修创作台</a><button id="open-market" type="button" class="market-open">装修市场<span>公开目录</span></button><span>独立展厅 · 全部工作状态均为演示</span></div></header>
 <main class="studio-layout"><section class="studio-stage" aria-label="三维总部预览"><div id="canvas"></div><div class="stage-top"><span id="scene-name">暖阳木质总部</span><span id="metrics">正在加载…</span></div><nav class="views" aria-label="展厅镜头"><button data-view="all" aria-pressed="true">全景</button><button data-view="desk" aria-pressed="false">工作区</button><button data-view="upstairs" aria-pressed="false">二楼</button><button data-view="model" aria-pressed="false">模型台</button></nav><p id="progress" role="status" aria-live="polite">正在布置展厅…</p><p class="stage-guide">拖动环绕 · 滚轮缩放 · 右键平移</p></section>
 <aside class="studio-tools" aria-label="外观与模型工具"><section><h2>组合你的公司外观</h2><p class="tool-copy">只改变视觉，不连接正式账号、稿件、智能体或数据库。</p><label>空间装修<select id="environment">${THEMES.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select></label><p id="theme-description" class="tool-copy"></p><label>界面皮肤<select id="ui-theme"><option value="default">暖纸与森林绿</option><option value="cyber">矿物白与深海蓝</option></select></label><label>角色配色<select id="character"><option value="sage">鼠尾草绿</option><option value="cobalt">钴蓝</option></select></label><label class="check"><input id="anchors" type="checkbox">显示交互锚点</label><label class="check"><input id="walking" type="checkbox">播放演示步态</label><button id="reset">复位镜头</button></section>
 <section><h2>检查自己的模型</h2><p class="tool-copy">导入仅在当前浏览器处理，不上传。接受内嵌纹理的 GLB，最大 10 MB。</p><label>选择 GLB 文件<input id="model-file" type="file" accept=".glb,model/gltf-binary"></label><p id="model-info" class="tool-copy" role="status">还未导入模型。模型台显示通用角色，不包含老板肖像。</p><button id="clear-model" disabled>移除导入模型</button></section>
 <section><h2>界面组件试用</h2><p class="tool-copy">以下是独立演示，不会发布或提交到公司。</p><label>稿件标题<input id="sample-title" value="我的工作室装修提案" maxlength="80"></label><label>正文<textarea id="sample-body" rows="3">记录材质、模型和灯光的修改思路。</textarea></label><div class="sample-actions"><button id="save-sample" class="primary">保存演示稿</button><button id="preview-panel">查看工作面板</button></div><p id="sample-status" class="tool-copy" role="status">未保存 · 仅保存在本次展厅会话</p></section></aside></main>
 <footer class="studio-footer"><span>布局契约 hq-fixed-layout-v1 · 米 / +Y · 修改布局须单独迁移碰撞与门禁</span><a href="./docs/CONTRIBUTING.html" id="help-link">贡献方式</a></footer>
 <dialog id="sample-panel" aria-labelledby="sample-panel-title"><div class="panel-head"><h2 id="sample-panel-title">工作面板 · 演示</h2><button id="close-sample">关闭</button></div><p class="intro">通用写手角色 · 本人控制 · 待编辑。正式权限始终由主系统校验。</p><div id="sample-output"></div></dialog>`;
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
// The relative docs link is replaced with an in-page explanation, so static hosting needs no docs renderer.
$<HTMLAnchorElement>('help-link').href='#contribute';
$('help-link').onclick=e=>{e.preventDefault();showPanel('修改 themes/ 的主题 JSON、src/ui/ 样式或 public/furniture/ 模型，运行 npm test、npm run validate、npm run build 后提交 Pull Request。详见仓库 CONTRIBUTING.md。');};
const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.domElement.setAttribute('aria-label','可环绕与缩放的总部展厅');$('canvas').append(renderer.domElement);
const camera=new T.PerspectiveCamera(50,1,.08,180),controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2,0);controls.minDistance=1;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.49;controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let office:OfficeVisuals,avatar:T.Group,imported:T.Group|undefined,mixer:T.AnimationMixer|undefined;
const modelPad=new T.Group();scene.add(modelPad);modelPad.position.set(-5,0,4.8);
const markerLayer=new T.Group();scene.add(markerLayer);markerLayer.visible=false;
for(const anchor of contract.anchors){const mesh=new T.Mesh(new T.CylinderGeometry(.32,.32,.04,24),new T.MeshBasicMaterial({color:'#de733e'}));mesh.position.set(anchor.position[0],anchor.position[1]+.06,anchor.position[2]);mesh.name=anchor.id;markerLayer.add(mesh);}
const cameras={all:{at:[19,14,23],look:[0,2,0]},desk:{at:[8,5,9],look:[4.4,1,.6]},upstairs:{at:[-5,8,2],look:[4.4,4.4,-5]},close:{at:[-1.3,2.8,5.5],look:[-5,1.0,1]},model:{at:[-5,1.8,8.5],look:[-5,1,4.8]}};
const closeView=document.createElement('button');closeView.dataset.view='close';closeView.textContent='前台近景';closeView.setAttribute('aria-pressed','false');document.querySelector('.views')!.append(closeView);
function view(name:keyof typeof cameras){const v=cameras[name];camera.position.fromArray(v.at);controls.target.fromArray(v.look);controls.update();if(office){office.officeWalls.forEach(o=>o.visible=name!=='upstairs');office.officeDoor.visible=name!=='upstairs';}document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));}
view('all');document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view as keyof typeof cameras));$('reset').onclick=()=>view('all');
const resize=new ResizeObserver(()=>{const bounds=$('canvas').getBoundingClientRect();renderer.setSize(bounds.width,bounds.height,false);camera.aspect=bounds.width/Math.max(bounds.height,1);camera.updateProjectionMatrix();});resize.observe($('canvas'));
function progress(text:string,error=false){$('progress').textContent=text;$('progress').classList.toggle('error',error);}
async function environment(id:string){
 const theme=THEMES.find(t=>t.id===id);if(!theme)throw new Error('主题不存在');
 const select=$<HTMLSelectElement>('environment');select.disabled=true;let candidate:OfficeVisuals|undefined;
 try{candidate=new OfficeVisuals(new T.Scene(),import.meta.env.BASE_URL,[],theme);await candidate.load(text=>progress(text));
  office?.dispose();office=candidate;office.attachTo(scene);renderer.toneMappingExposure=theme.environment.exposure;
  // Model-pad character resources are separate from the environment lifecycle.
  if(!avatar){avatar=office.makeAvatar('visitor');modelPad.add(avatar);avatar.visible=!imported;$<HTMLInputElement>('model-file').disabled=false;$('model-info').textContent='还未导入模型。模型台显示通用角色，不包含老板肖像。';}applyCharacterSkin(avatar,$<HTMLSelectElement>('character').value);
  $('scene-name').textContent=theme.name;$('theme-description').textContent=theme.description;progress('展厅已就绪 · 离线演示');
 }catch(e){candidate?.dispose();select.value=office?$('scene-name').textContent===THEMES[0].name?'default':'cyber':'default';progress('装修加载失败：'+(e as Error).message+'。可重新选择重试。',true);if(!avatar)$('model-info').textContent='总部尚未就绪；请在上方重新选择装修后再导入模型。';
 }finally{select.disabled=false;}
}
async function previewMarketTheme({detail,host,onProgress}:MarketPreviewRequest):Promise<MarketPreviewHandle>{
  const previewScene=new T.Scene();
  let candidate:OfficeVisuals|undefined,renderer:T.WebGLRenderer|undefined,controls:OrbitControls|undefined,resize:ResizeObserver|undefined;
  try{
   candidate=new OfficeVisuals(previewScene,import.meta.env.BASE_URL,[],detail.theme,detail.assetBase);
   await candidate.load(text=>onProgress(text));
   candidate.setDecoration(detail.scene);
   renderer=new T.WebGLRenderer({antialias:true});
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
   renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
   const theme=detail.theme as {environment?:{exposure?:number}};
   renderer.toneMappingExposure=theme.environment?.exposure??1.08;
   renderer.domElement.setAttribute('aria-label',`${detail.entry.title} 完整装修预览`);
   const camera=new T.PerspectiveCamera(50,1,.08,180);camera.position.set(19,14,23);
   controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2,0);controls.minDistance=1;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.49;controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;
   const resizeView=()=>{const bounds=host.getBoundingClientRect();const width=Math.max(bounds.width,1),height=Math.max(bounds.height,1);renderer!.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
   resize=new ResizeObserver(resizeView);resize.observe(host);resizeView();
   let disposed=false;
   const lost=(event:Event)=>{event.preventDefault();renderer?.setAnimationLoop(null);onProgress('预览渲染中断；请关闭详情后重试。');};
   renderer.domElement.addEventListener('webglcontextlost',lost);
   renderer.setAnimationLoop(()=>{if(disposed)return;controls?.update();renderer!.render(previewScene,camera);});
   host.replaceChildren(renderer.domElement);
   return {setView(view){const at=view==='floor1'?[8,5,9]:view==='floor2'?[-5,8,2]:[19,14,23];const look=view==='floor1'?[4.4,1,.6]:view==='floor2'?[4.4,4.4,-5]:[0,2,0];camera.position.fromArray(at);controls!.target.fromArray(look);controls!.update();},dispose(){if(disposed)return;disposed=true;renderer?.setAnimationLoop(null);resize?.disconnect();controls?.dispose();renderer?.domElement.removeEventListener('webglcontextlost',lost);renderer?.dispose();candidate?.dispose();renderer?.domElement.remove();}};
  }catch(error){
   resize?.disconnect();controls?.dispose();renderer?.dispose();candidate?.dispose();throw error;
  }
 }
$<HTMLSelectElement>('environment').onchange=e=>void environment((e.target as HTMLSelectElement).value);
$<HTMLSelectElement>('ui-theme').onchange=e=>applyUITheme(document.documentElement,THEMES.find(t=>t.id===(e.target as HTMLSelectElement).value)!);
$<HTMLSelectElement>('character').onchange=e=>{if(avatar)applyCharacterSkin(avatar,(e.target as HTMLSelectElement).value);};
$<HTMLInputElement>('anchors').onchange=e=>markerLayer.visible=(e.target as HTMLInputElement).checked;
const panel=$<HTMLDialogElement>('sample-panel');function showPanel(text:string){workflowCleanup?.();workflowCleanup=undefined;$('sample-panel-title').textContent='工作面板 · 演示';$('sample-output').textContent=text;if(!panel.open)panel.showModal();}
let workflowCleanup:(()=>void)|undefined;
function openWorkflow(title:string,html:string){workflowCleanup?.();workflowCleanup=undefined;$('sample-panel-title').textContent=title+' · 展厅演示';$('sample-output').innerHTML=html;if(!panel.open)panel.showModal();return $('sample-output');}
panel.addEventListener('close',()=>{workflowCleanup?.();workflowCleanup=undefined;});
const market=createMarket({openButton:$('open-market'),preview:previewMarketTheme});
$('open-market').onclick=()=>{if(panel.open)panel.close();market.open();};
const catalog=document.createElement('div');catalog.innerHTML='<label>主游戏的真实组件<select id="workflow-select"><option value="login">员工登录</option><option value="editor">图文编辑器</option><option value="employee">员工控制面板</option></select></label><button id="open-workflow">预览所选界面</button>';$('preview-panel').parentElement!.after(catalog);
$('open-workflow').onclick=async()=>{
 const choice=$<HTMLSelectElement>('workflow-select').value;
 const content=createContentRoom({api:previewAPI(choice==='login'?'anonymous':'author'),open:openWorkflow,cleanup:fn=>{workflowCleanup=fn;},enterRoom:async()=>{},accountChanged:()=>{}});
 if(choice==='login')await content.openLogin();else if(choice==='editor'){await content.refreshIdentity();await content.openEditor('demo-article');}else{
  const desk=createEmployeeDesk({api:previewAPI('author'),show:(title,html)=>{const root=openWorkflow(title,html);let alive=true;workflowCleanup=()=>{alive=false;};return {root,alive:()=>alive,dispose:fn=>{const previous=workflowCleanup;workflowCleanup=()=>{previous?.();fn();};}};},back:()=>panel.close(),login:()=>{void content.openLogin();},walk:async()=>{throw new Error('展厅不执行真实员工移动');},edit:()=>{void content.openEditor('demo-article');},owner:()=>false});await desk.home();
 }
};
let savedSample:{title:string;body:string}|undefined;
$('close-sample').onclick=()=>panel.close();$('preview-panel').onclick=()=>showPanel(savedSample?savedSample.title+'\n\n'+savedSample.body:'尚未保存演示稿。先填写标题和正文，再保存到本次会话。');$('save-sample').onclick=()=>{const title=$<HTMLInputElement>('sample-title').value.trim(),body=$<HTMLTextAreaElement>('sample-body').value.trim();if(!title||!body){$('sample-status').textContent='请填写标题与正文后再保存。';return;}savedSample={title,body};$('sample-status').textContent='演示稿已保存在本次会话 · 未提交至公司';};
function disposeImported(){if(!imported)return;mixer?.stopAllAction();mixer?.uncacheRoot(imported);mixer=undefined;imported.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of [o.material].flat()){for(const v of Object.values(m))if(v instanceof T.Texture)v.dispose();m.dispose();}}});imported.removeFromParent();imported=undefined;if(avatar)avatar.visible=true;}
$('clear-model').onclick=()=>{disposeImported();$('model-info').textContent='已移除导入模型。';$<HTMLButtonElement>('clear-model').disabled=true;$<HTMLInputElement>('model-file').value='';};
$<HTMLInputElement>('model-file').onchange=async e=>{
 const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;const input=e.target as HTMLInputElement;input.disabled=true;
 if(!avatar){input.value='';$('model-info').textContent='总部尚未就绪；请等待加载完成或重新选择装修后再导入模型。';return;}
 const draco=new DRACOLoader();draco.setDecoderPath(import.meta.env.BASE_URL+'draco/');
 try{if(file.size>10*1024*1024)throw new Error('文件超过10MB');const buffer=await file.arrayBuffer(),info=inspectGLB(buffer);const loader=new GLTFLoader();loader.setDRACOLoader(draco);const gltf=await loader.parseAsync(buffer,'');
  const size=new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3());if(!Number.isFinite(size.y)||size.y<=0)throw new Error('模型没有有效可见尺寸');
  disposeImported();imported=gltf.scene;const bounds=new T.Box3().setFromObject(imported),center=bounds.getCenter(new T.Vector3()),scale=1.85/size.y;imported.scale.setScalar(scale);imported.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);modelPad.add(imported);avatar.visible=false;
  if(gltf.animations.length){mixer=new T.AnimationMixer(imported);mixer.clipAction(gltf.animations.find(c=>c.name.toLowerCase()==='idle')||gltf.animations[0]).play();}
  $('model-info').textContent=`${file.name} · ${info.meshes} 个网格 · ${info.skins} 套蒙皮 · 动作：${info.clips.join('、')||'无（不可冒充骨骼角色）'} · 原尺寸 ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} 米`;$<HTMLButtonElement>('clear-model').disabled=false;view('model');
 }catch(e){$('model-info').textContent='导入失败：'+(e as Error).message;}finally{draco.dispose();input.disabled=false;}
};
const clock=new T.Clock();let frames=0,lastMetric=performance.now();
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);controls.update();if(mixer&&!document.hidden)mixer.update(dt);if(avatar){const walking=$<HTMLInputElement>('walking').checked&&!matchMedia('(prefers-reduced-motion: reduce)').matches;const phase=performance.now()/210;(avatar.userData.limbs as T.Group[]).forEach((limb,i)=>limb.rotation.x=walking?Math.sin(phase)*.42*(i%2?-1:1):0);}renderer.render(scene,camera);frames++;const now=performance.now();if(now-lastMetric>1000){$('metrics').textContent=`${Math.round(frames*1000/(now-lastMetric))} FPS · ${renderer.info.render.calls} 次绘制 · ${renderer.info.render.triangles.toLocaleString()} 三角形`;frames=0;lastMetric=now;}});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);progress('WebGL连接中断，请刷新恢复展厅。',true);});
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);resize.disconnect();controls.dispose();disposeImported();market.destroy();office?.dispose();renderer.dispose();},{once:true});
$<HTMLInputElement>('model-file').disabled=true;
void environment('default');
// Read-only diagnostics for repeatable preview smoke tests; contains no company data.
Object.assign(window,{visualPreview:{get environment(){return $('environment') instanceof HTMLSelectElement?($('environment') as HTMLSelectElement).value:'';},get meshCount(){return renderer.info.render.calls;},get avatar(){return avatar;},get office(){return office;},get scene(){return scene;},get market(){return market;}}});
