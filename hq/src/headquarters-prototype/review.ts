import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {CharacterMotion} from '../character-motion.js';
import {gameShell} from '../../../src/ui/game-shell';
import projects from '../data/projects.json';
import {createHeadquarters} from './model-premium';
import {SPAWN,advance,WALK_ROUTE,FLOOR_NAMES,REVISION} from './plan.js';
import '../style.css';
import './review.css';

const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const brandData=document.getElementById('review-brand-data')?.textContent?.trim();
$('app').innerHTML=gameShell.replace('src="/projects/opc-icon.png"',`src="data:image/png;base64,${brandData||''}"`);document.body.classList.add('spatial-review');
$('connection').textContent='空间样板 · 不连接业务';
document.querySelector('.brand small')!.textContent='三层暖木总部 / 空间验证';
document.querySelector<HTMLAnchorElement>('.brand')!.href='http://127.0.0.1:5312/';
$('entry-title').textContent='新总部，先走一遍';
document.querySelector('.entry-copy>p:not(.entry-eyebrow)')!.innerHTML='中央前台、双侧动线、三层折返楼梯。<br>本轮验证空间与家具；正式公司数据保持原状。';
$('enter-visitor').textContent='进入空间样板';
for(const id of ['enter-employee','register-employee','enter-owner','employee-access'])$(id).remove();
document.querySelector('.entry-links')!.remove();document.querySelector('.entry-recruitment')!.remove();
document.querySelector('.entry-note')!.textContent='沿用现有骨骼角色测试尺度，不代表新版人物已制作。';
document.querySelectorAll('[data-careers]').forEach(e=>e.remove());
const tools=document.querySelector('.top-actions')!;
tools.insertAdjacentHTML('beforeend','<a href="http://127.0.0.1:5312/">返回正式公司</a><button id="review-projects">作品与介绍</button><button id="tour">步行巡游</button><button id="export-desk">导出前台 GLB</button><button id="export-building">导出建筑 GLB</button>');
$('camera-controls').innerHTML='<button data-view="entry" aria-pressed="true">入口</button><button data-view="all">全景</button><button data-view="floor1">一楼</button><button data-view="floor2">二楼</button><button data-view="floor3">三楼</button><button data-view="desk">前台近景</button><button data-view="first">第一人称</button><button data-view="third">第三人称</button>';
$('mission-title').textContent='入口 → 作品 → 前台 → 内部';$('mission-copy').textContent='左侧看公开作品；绕前台两侧进入折返楼梯。上层工位和房间仍是体量样板。';
document.querySelector('#mission small')!.textContent='未接正式员工、预约、任务与 MCP';
$('guide').hidden=false;$('location').textContent='正在准备样板…';
$('guide').insertAdjacentHTML('afterend','<output id="review-metrics" aria-label="场景几何统计"></output>');
const dialog=$<HTMLDialogElement>('panel');let lastFocus:HTMLElement|null=null;
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#d8cbbb');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
renderer.domElement.setAttribute('aria-label','三层暖木总部可行走空间样板');$('world').append(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,.08,180);
RectAreaLightUniformsLib.init();
scene.background=new T.Color('#d8cbbb');
scene.fog=new T.FogExp2('#d8cbbb',.0026);
const environmentGenerator=new T.PMREMGenerator(renderer);environmentGenerator.compileEquirectangularShader();
const roomEnvironment=environmentGenerator.fromScene(new RoomEnvironment(),.035);
scene.environment=roomEnvironment.texture;
scene.add(new T.HemisphereLight('#f4f7f2','#6c5a45',.5));
const sun=new T.DirectionalLight('#ffe0b2',2.1);sun.position.set(-12,22,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-23,right:23,top:24,bottom:-22,near:1,far:70});sun.shadow.normalBias=.03;sun.shadow.bias=-.00018;scene.add(sun);scene.add(sun.target);
const fill=new T.DirectionalLight('#dcecff',.42);fill.position.set(12,10,-8);scene.add(fill);
const lobbyWash=new T.RectAreaLight('#ffdfb0',3.25,13,7);lobbyWash.position.set(0,3.65,6.5);lobbyWash.lookAt(0,0,2);scene.add(lobbyWash);
const receptionWash=new T.RectAreaLight('#ffd19b',3.1,7.2,4.8);receptionWash.position.set(-6.6,3.55,7.1);receptionWash.lookAt(-6.8,1.0,6.6);scene.add(receptionWash);
const upperWash=new T.RectAreaLight('#ffe1b7',2.35,12,5.5);upperWash.position.set(0,7.35,2.2);upperWash.lookAt(0,4.3,1.0);scene.add(upperWash);
const galleryWash=new T.RectAreaLight('#ffe7c9',2.2,5.5,8);galleryWash.position.set(-9,3.5,3.2);galleryWash.lookAt(-12,1.2,2);scene.add(galleryWash);
const stairWash=new T.RectAreaLight('#fff0d8',2.45,4.2,8);stairWash.position.set(8,3.35,1.8);stairWash.lookAt(8,1.5,-.5);scene.add(stairWash);
let model:Awaited<ReturnType<typeof createHeadquarters>>|undefined;
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=2;controls.maxDistance=70;
const player=new T.Group();scene.add(player);let motion:CharacterMotion|undefined;
let pos={...SPAWN},entered=false,view='entry',yaw=0,pitch=.02,dragging=false,lastX=0,lastY=0,frameId=0,lastFrame=0,disposed=false,tourIndex=-1,visible=true;
const keys=new Set<string>(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentFloor=-1;
const views:Record<string,{at:number[];look:number[];section:number|null}>={
 entry:{at:[.7,1.72,10.35],look:[-.55,1.62,-3.9],section:null},
 all:{at:[29,23,32],look:[0,4.3,0],section:null},
 floor1:{at:[19,15,22],look:[-.4,1.0,1.4],section:0},
 floor2:{at:[21,20,24],look:[0,4.2,.6],section:1},
 floor3:{at:[20,24,24],look:[0,8.4,0],section:2},
 desk:{at:[.15,1.7,9.9],look:[-6.8,1.05,7.15],section:0},
};
function setView(value:string){
 view=value;controls.enabled=!['first','third'].includes(view);model?.setSection(views[value]?.section??null);
 if(views[value]){camera.position.fromArray(views[value].at);controls.target.fromArray(views[value].look);if(camera.aspect<.8&&value!=='desk'&&value!=='entry')camera.position.sub(controls.target).multiplyScalar(1.5).add(controls.target);controls.update();}
 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 renderer.shadowMap.needsUpdate=true;
}
function resize(){const {width,height}=$('world').getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(views[view])setView(view);}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('world'));resize();setView('entry');
function openPanel(title:string,html:string){lastFocus=document.activeElement as HTMLElement;$('panel-title').textContent=title;$('panel-body').innerHTML=html;keys.clear();dialog.showModal();}
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function shown(object:T.Object3D){for(let node:T.Object3D|null=object;node;node=node.parent)if(!node.visible)return false;return true;}
function showProjects(index?:number){const items=index===undefined?projects.items:[projects.items[index]];openPanel(index===undefined?'公司介绍与公开作品':items[0].title,`<p class="intro">北京童医魔盒科技服务有限公司：聚焦医疗与 AI，把专业经验转化为可使用的工具与服务。愿景：让人与自己信任的智能体协作，把想法做成真实成果。</p>${items.map(p=>`<article class="project"><div><h3>${escape(p.title)}</h3><p>${escape(p.description)}</p><small>${escape(p.status)}</small></div></article>`).join('')}<a class="source" href="${projects.source}" target="_blank" rel="noopener">来源：个人官网公开快照 · ${projects.checkedAt}</a>`);}
$('review-projects').onclick=()=>showProjects();$('close-panel').onclick=()=>dialog.close();dialog.addEventListener('close',()=>lastFocus?.focus());
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view!));
function stopTour(){tourIndex=-1;$('tour').textContent='步行巡游';}
function enter(){entered=true;$('entry').hidden=true;$('mission').hidden=false;$('touch').hidden=false;$('camera-controls').hidden=false;setView('third');player.visible=true;}
$('enter-visitor').onclick=enter;
$('tour').onclick=()=>{if(tourIndex>=0){stopTour();return;}if(!entered)enter();if(Math.hypot(pos.x-SPAWN.x,pos.z-SPAWN.z)>.1||pos.y>.1){openPanel('巡游起点','<p class="intro">巡游从入口开始，沿连续路线验证两组楼梯，不会瞬移角色。点击下方按钮返回空间样板入口再开始；这只重置样板中的位置。</p><button id="restart-tour" class="primary">回到样板入口并巡游</button>');$('restart-tour').onclick=()=>{pos={...SPAWN};yaw=0;dialog.close();tourIndex=0;$('tour').textContent='停止巡游';setView('third');};return;}tourIndex=0;$('tour').textContent='停止巡游';setView('third');};
const abort=new AbortController(),signal=abort.signal;
window.addEventListener('keydown',e=>{if(dialog.open||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();stopTour();keys.add(k);}if(k==='v'&&entered)setView(view==='first'?'third':'first');if(k==='e'&&entered&&pos.x<-9.5)showProjects();},{signal});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()),{signal});window.addEventListener('blur',()=>{keys.clear();dragging=false;},{signal});
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;keys.clear();if(visible){lastFrame=0;frameId=requestAnimationFrame(frame);}else cancelAnimationFrame(frameId);},{signal});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-key]')){
 button.onpointerdown=e=>{e.preventDefault();stopTour();keys.add(button.dataset.key!);button.setPointerCapture(e.pointerId);};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key!),{signal});
}
let pointerStart=new T.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{pointerStart.set(e.clientX,e.clientY);if(controls.enabled||dialog.open)return;dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);},{signal});
renderer.domElement.addEventListener('pointermove',e=>{if(!dragging||controls.enabled||dialog.open)return;yaw-=(e.clientX-lastX)*.005;pitch=T.MathUtils.clamp(pitch+(e.clientY-lastY)*.003,-.65,.65);lastX=e.clientX;lastY=e.clientY;},{signal});
renderer.domElement.addEventListener('pointerup',e=>{
 dragging=false;if(!entered||dialog.open||pointerStart.distanceTo(new T.Vector2(e.clientX,e.clientY))>6)return;
 const r=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
  if(!model)return;
  const hits=ray.intersectObject(model.root,true);const first=hits.find(h=>shown(h.object)&&h.object instanceof T.Mesh&&(h.object.material as T.Material)!==undefined&&!((h.object.material as T.MeshStandardMaterial).transparent));
 if(first&&Number.isInteger(first.object.userData.projectIndex))showProjects(first.object.userData.projectIndex);
},{signal});
for(const event of ['pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,()=>dragging=false,{signal});
function notify(text:string){$('notice').textContent=text;$('notice').hidden=false;}
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();notify('三维渲染中断，请关闭后重新打开样板。');cancelAnimationFrame(frameId);},{signal});
async function exportModel(kind:'desk'|'building'){
 const button=$<HTMLButtonElement>(kind==='desk'?'export-desk':'export-building');button.disabled=true;
 try{if(!model)throw new Error('空间仍在加载');const source=kind==='desk'?model.reception.clone(true):model.root.clone(true);source.position.set(0,0,0);source.traverse(o=>o.visible=true);source.updateMatrixWorld(true);const exporter=new GLTFExporter();const buffer=await exporter.parseAsync(source,{binary:true,onlyVisible:false});if(!(buffer instanceof ArrayBuffer))throw new Error('GLB exporter did not return binary');const url=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download=kind==='desk'?'tongyi-reception-sample.glb':'tongyi-three-story-blockout.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
 catch(e){notify('模型导出失败：'+(e as Error).message);}finally{button.disabled=false;}
}
$('export-desk').onclick=()=>void exportModel('desk');$('export-building').onclick=()=>void exportModel('building');
function frame(time:number){
 if(disposed||!visible)return;const dt=lastFrame?Math.min((time-lastFrame)/1000,.05):0;lastFrame=time;const before={...pos};
 if(entered&&!dialog.open){
  if(tourIndex>=0){
   const target=WALK_ROUTE[tourIndex],dx=target[0]-pos.x,dz=target[1]-pos.z,distance=Math.hypot(dx,dz),step=Math.min(distance,dt*2.8),next=advance(pos,distance?dx/distance*step:0,distance?dz/distance*step:0);
   if(distance<.025){tourIndex++;if(tourIndex===WALK_ROUTE.length){stopTour();notify('连续步行巡游完成：入口 → 二楼 → 三楼。此结果仅验证样板空间。');}}
   else if(dt&&Math.hypot(next.x-pos.x,next.z-pos.z)<.00001){stopTour();notify('巡游路径遇到阻挡，请记录当前位置后修正样板。');}else{pos=next;yaw=Math.atan2(-dx,-dz);}
  }else{
   let x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),z=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
   const len=Math.hypot(x,z);if(len){if(!['first','third'].includes(view))setView('third');x=x/len*dt*2.6;z=z/len*dt*2.6;const dx=x*Math.cos(yaw)+z*Math.sin(yaw),dz=-x*Math.sin(yaw)+z*Math.cos(yaw);pos=advance(pos,dx,0);pos=advance(pos,0,dz);}
  }
 }
 player.position.set(pos.x,pos.y,pos.z);const speed=dt?Math.hypot(pos.x-before.x,pos.z-before.z)/dt:0;if(speed>.001)player.rotation.y=Math.atan2(pos.x-before.x,pos.z-before.z);
 motion?.update(dt,speed,{paused:dialog.open,reducedMotion:reduced});player.visible=entered&&view!=='first';
 if(view==='first'){camera.position.set(pos.x,pos.y+1.68,pos.z);camera.lookAt(pos.x-Math.sin(yaw)*3,pos.y+1.68-Math.sin(pitch)*3,pos.z-Math.cos(yaw)*3);}
 if(view==='third'){
  const aim=new T.Vector3(pos.x,pos.y+1.15,pos.z),offset=new T.Vector3(Math.sin(yaw)*4.3,2.65+pitch*2,Math.cos(yaw)*4.3),desired=aim.clone().add(offset);
   const ray=new T.Raycaster(aim,offset.clone().normalize(),.1,offset.length());const hit=model?ray.intersectObject(model.root,true).find(h=>shown(h.object)&&h.object instanceof T.Mesh&&!((h.object.material as T.MeshStandardMaterial).transparent)):undefined;
  if(hit)desired.copy(aim).add(offset.clone().normalize().multiplyScalar(Math.max(.6,hit.distance-.24)));
  camera.position.copy(desired);camera.lookAt(aim);
 }
 const floor=Math.min(2,Math.round(pos.y/4.2));if(currentFloor!==floor){currentFloor=floor;renderer.shadowMap.needsUpdate=true;}
 $('location').textContent=`${floor+1}F · ${FLOOR_NAMES[floor]} · ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)} m`;
 if(speed>.01)renderer.shadowMap.needsUpdate=true;
 renderer.render(scene,camera);
 $('review-metrics').textContent=`${REVISION} · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles/1000).toFixed(0)}k triangles`;
 document.body.dataset.position=JSON.stringify(pos);document.body.dataset.tour=String(tourIndex);document.body.dataset.view=view;
 frameId=requestAnimationFrame(frame);
}
async function loadCharacter(){
 try{
  const data=document.getElementById('review-avatar-data')?.textContent?.trim();if(!data)throw new Error('缺少离线骨骼角色资源，请使用生成后的独立样板 HTML');
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
  const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());if(size.y<=0)throw new Error('角色尺寸无效');
  gltf.scene.scale.setScalar(1.85/size.y);gltf.scene.position.set(-center.x*gltf.scene.scale.x,-bounds.min.y*gltf.scene.scale.x,-center.z*gltf.scene.scale.x);
  gltf.scene.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=true;});player.add(gltf.scene);motion=new CharacterMotion(gltf.scene,gltf.animations);
   $('load-status').textContent='三层空间、真实家具与现有 Idle / Walk 骨骼角色已就绪';
 }catch(error){$('load-status').textContent='角色加载失败：'+(error as Error).message;notify('角色加载失败，仍可用全景和分层镜头检查建筑。');$('camera-controls').hidden=false;document.body.dataset.ready='error';}
}
async function boot(){
 $<HTMLButtonElement>('enter-visitor').disabled=true;
 $('load-status').textContent='正在加载建筑、真实家具与骨骼角色…';
 try{
  model=await createHeadquarters(projects.items);scene.add(model.root);setView('entry');
  if(model.furnitureFailures.length)notify('部分家具加载失败：'+model.furnitureFailures.join('；'));
  await loadCharacter();
  $<HTMLButtonElement>('enter-visitor').disabled=false;document.body.dataset.ready='true';
 }catch(error){
  $('load-status').textContent='空间加载失败：'+(error as Error).message;
  notify('空间加载失败：'+(error as Error).message);
  document.body.dataset.ready='error';
 }
 frameId=requestAnimationFrame(frame);
}
void boot();
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frameId);abort.abort();resizeObserver.disconnect();controls.dispose();motion?.dispose();model?.dispose();roomEnvironment.dispose();environmentGenerator.dispose();player.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of [o.material].flat()){for(const value of Object.values(m))if(value instanceof T.Texture)value.dispose();m.dispose();}}});renderer.dispose();},{once:true});
