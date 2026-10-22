import * as T from 'three';
import {createModelLoader} from '../../src/model-loader';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {CharacterMotion} from './character-motion.js';
import {RECEPTION,SPAWN,FLOOR_HEIGHT,canMove,supportAt} from './shared/world.js';
import projects from './data/projects.json';
import {OfficeVisuals} from '../../src/office';
import {createHeadquarters} from './headquarters-prototype/model-premium';
import {createOutdoor,type OutdoorVisuals} from './headquarters-prototype/outdoor';

export type Peer={id:string;x:number;y:number;z:number;yaw:number;role:string;moving?:boolean};
export type Mode='first'|'third'|'overview'|'character'|'lobby';
export type LobbyExhibit={kind:'company'|'project'|'business'|'cases'|'dashboard'|'messages';projectIndex?:number};
export type CasesPresentation={publishedCases:number;items:{title:string;serviceType:string;image?:string}[];updatedAt:string|null};
export type DashboardPresentation={visitors:number;publishedCases:number;publicProjects:number;confirmedDeliveries:number;updatedAt:string};
export type MessagesPresentation={approvedCount:number;items:{name:string;body:string;createdAt:string}[]};
type Activity={accountId:string;name:string;state:string;stage:string};
export class Headquarters {
 readonly renderer:T.WebGLRenderer;
 readonly scene=new T.Scene();
 readonly camera=new T.PerspectiveCamera(62,1,.08,160);
 readonly player=new T.Group();
 readonly pos=new T.Vector3(SPAWN.x,0,SPAWN.z);
 mode:Mode='lobby'; entered=false; paused=false; role='visitor'; id='';
 yaw=0; pitch=.12;
 private resizeObserver:ResizeObserver;private events=new AbortController();private disposed=false;private sectionLevel:number|null=null;
 private previousFrame=performance.now(); private keys=new Set<string>();
 private peers=new Map<string,T.Group>(); private peerTargets=new Map<string,Peer>();
 private avatar:T.Group|undefined; private ownerModel:T.Group|undefined;
 private ownerClips:T.AnimationClip[]=[];
 private ownerLoad?:Promise<void>;
 private ownerMotion:CharacterMotion|undefined;
 private sampleMotion:CharacterMotion|undefined;
 private employeePreview=false;
 readonly employeeSample=new T.Group();
 private peerMotions=new Map<string,CharacterMotion>();
 private visuals:OfficeVisuals;
 private lastSent=0; private dragging=false; private lastX=0; private lastY=0;
 private pointerStart=new T.Vector2(); private pointerDistance=0;
 private serverTarget:T.Vector3|undefined;
 private hadManualInput=false;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 private officeDoor=new T.Group();
 private officeWalls:T.Object3D[]=[];
 private premiumOffice?:Awaited<ReturnType<typeof createHeadquarters>>;
 private outdoor?:OutdoorVisuals;
 private stageTargets:T.Object3D[]=[];
 private stageOccluders:T.Object3D[]=[];
 private environmentTarget?:T.WebGLRenderTarget;
 private activityLayer=document.createElement('div');
 private activityBubbles:{button:HTMLButtonElement;point:T.Vector3}[]=[];
 private activityKey='';
 private workBubble=document.createElement('button');
 onBusinessInteract:()=>void=()=>{};
 private characterSkin='sage';
 private visualGeneration=0;
 onProximity:(near:boolean)=>void=()=>{};
 onMove:(p:{x:number;z:number;yaw:number})=>void=()=>{};
 onInteract:()=>void=()=>{};
 onContentInteract:()=>void=()=>{};
 onCompanyInteract:()=>void=()=>{};
 onActivityInteract:(activity:Activity|null)=>void=()=>{};
 onExhibitInteract:(exhibit:LobbyExhibit)=>void=()=>{};
 onExhibitNear:(exhibit:LobbyExhibit|null)=>void=()=>{};
 onError:(message:string)=>void=()=>{};
 constructor(private container:HTMLElement){
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'default'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  this.renderer.domElement.setAttribute('aria-label','可行走的三层暖木公司总部与户外园区');
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.paused=true;this.onError('三维画面连接中断，请刷新重新加载');});
  container.append(this.renderer.domElement);
  this.activityLayer.className='world-activity';this.activityLayer.setAttribute('aria-label','已授权公开的真实代班进展');container.append(this.activityLayer);
  this.workBubble.className='activity-bubble';this.workBubble.hidden=true;this.workBubble.onclick=()=>this.onBusinessInteract();container.append(this.workBubble);
  const pmrem=new T.PMREMGenerator(this.renderer);
  const roomEnvironment=new RoomEnvironment();
  this.environmentTarget=pmrem.fromScene(roomEnvironment,.035);roomEnvironment.dispose();
  this.scene.environment=this.environmentTarget.texture;
  pmrem.dispose();
  this.visuals=new OfficeVisuals(this.scene,'/',projects.items,undefined,undefined,'/models/nurse-reference-20261020.glb?rev=head-sides-20261020',true);
  this.officeDoor=this.visuals.officeDoor;this.officeWalls=this.visuals.officeWalls;
  this.scene.add(this.player);this.player.position.copy(this.pos);
  this.camera.position.set(18,12.5,34);this.camera.lookAt(0,4.2,3.5);
  this.resize();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
  this.bind();this.renderer.setAnimationLoop(()=>this.frame());
 }
 private makeAvatar(kind:string){const avatar=this.visuals.makeAvatar(kind);this.visuals.recolorCharacter(avatar,this.characterSkin);return avatar;}
 private mountPremiumVisuals(model:Awaited<ReturnType<typeof createHeadquarters>>,outdoor:OutdoorVisuals){
  this.premiumOffice?.dispose();this.outdoor?.dispose();
  this.premiumOffice=model;this.outdoor=outdoor;
  model.setSection(this.sectionLevel);
  this.scene.add(model.root,outdoor.root);
  this.stageTargets=[...model.targets];
  this.stageOccluders=[...model.occluders,...outdoor.occluders,...this.visuals.cameraOccluders];
  this.officeDoor=model.officeDoor;
  this.officeWalls=model.officeWalls;
  this.renderer.shadowMap.needsUpdate=true;
  if(model.furnitureFailures.length)this.onError(`部分家具未能载入：${model.furnitureFailures.join('；')}`);
 }
 async load(onProgress:(text:string)=>void){
  // Shell-only OfficeVisuals already owns the light rig and procedural visitor.
  // Its old furniture package belongs to the separate two-floor showroom.
  const loader=createModelLoader();
  this.avatar=this.makeAvatar('visitor');this.player.add(this.avatar);
  onProgress('正在搭建三层暖木总部');
  const modelGeneration=this.visualGeneration;
  const [headquarters,outdoor]=await Promise.all([createHeadquarters(projects.items),Promise.resolve(createOutdoor())]);
  if(modelGeneration!==this.visualGeneration){headquarters.dispose();outdoor.dispose();throw new Error('总部装载已被更新的装修请求替代');}
  this.mountPremiumVisuals(headquarters,outdoor);
  const sample=await loader.loadAsync('/models/hq-office-employee.glb');
  this.employeeSample.name='Office_Employee_Action_Sample';this.employeeSample.add(sample.scene);this.employeeSample.position.set(-6.5,4.2,7.46);this.employeeSample.rotation.y=Math.PI;
  this.scene.add(this.employeeSample);this.sampleMotion=new CharacterMotion(sample.scene,sample.animations);this.sampleMotion.setPose('Type');this.sampleMotion.update(0,0);
  onProgress('总部准备好了');
 }
 private ensureOwnerModel(){
  if(this.ownerLoad)return this.ownerLoad;
  this.ownerLoad=(async()=>{
   const loader=createModelLoader(),draco=new DRACOLoader();draco.setDecoderPath('/draco/');loader.setDRACOLoader(draco);
   try{
    const gltf=await loader.loadAsync('/models/shuai-rigged.glb?rev=neck-proportion-20261020');
    const model=gltf.scene,bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
    if(!Number.isFinite(size.y)||size.y<=0)throw new Error('人物尺寸无效');
    model.scale.setScalar(1.85/size.y);model.position.set(-center.x*model.scale.x,-bounds.min.y*model.scale.x,-center.z*model.scale.x);
    model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;for(const material of [o.material].flat())if(material instanceof T.MeshBasicMaterial)material.toneMapped=false;}if(o.userData.walkSpeed)model.userData.walkSpeed=o.userData.walkSpeed;});
    const validation=new CharacterMotion(model,gltf.animations);validation.dispose();
    if(this.disposed){this.releaseModel(model);return;}
    this.ownerModel=new T.Group();this.ownerModel.add(model);this.ownerModel.userData.walkSpeed=model.userData.walkSpeed;this.ownerClips=gltf.animations;
    if(this.role==='owner'&&this.entered){this.ownerMotion?.dispose();this.releaseAvatar(this.avatar);this.player.clear();this.avatar=cloneSkeleton(this.ownerModel) as T.Group;this.avatar.userData.ownerRig=true;this.player.add(this.avatar);this.ownerMotion=new CharacterMotion(this.avatar,this.ownerClips);}
    for(const [id,p]of this.peerTargets)if(p.role==='owner'){
     const previous=this.peers.get(id);if(!previous)continue;
     const avatar=cloneSkeleton(this.ownerModel) as T.Group;avatar.userData.role='owner';avatar.userData.ownerRig=true;avatar.position.copy(previous.position);avatar.rotation.copy(previous.rotation);
     this.releaseAvatar(previous);previous.removeFromParent();this.peerMotions.get(id)?.dispose();this.peers.set(id,avatar);this.peerMotions.set(id,new CharacterMotion(avatar,this.ownerClips));this.scene.add(avatar);
    }
   }finally{draco.dispose();}
  })();return this.ownerLoad;
 }
 private releaseModel(root:T.Object3D){const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(o instanceof T.Mesh){geometry.add(o.geometry);for(const m of [o.material].flat()){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 private releaseAvatar(root?:T.Object3D){if(!root)return;root.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose();if(!root.userData.ownerRig&&o instanceof T.Mesh)o.geometry.dispose();});}
 async setTheme(theme:unknown,decoration?:unknown,assetBase?:string|null){
  if(decoration||(theme as {id?:string})?.id!=='default')throw new Error('当前三层总部不兼容 hq-fixed-layout-v1 装修；请在独立展厅预览，等待布局迁移审核');
  const generation=++this.visualGeneration,candidate=new OfficeVisuals(new T.Scene(),'/',projects.items,theme,assetBase||undefined,'/models/nurse-reference-20261020.glb?rev=head-sides-20261020',true);
  let headquarters:Awaited<ReturnType<typeof createHeadquarters>>|undefined,outdoor:OutdoorVisuals|undefined;
  try{
   if(decoration)candidate.setDecoration(decoration);
   [headquarters,outdoor]=await Promise.all([createHeadquarters(projects.items),Promise.resolve(createOutdoor())]);
  }catch(error){headquarters?.dispose();outdoor?.dispose();candidate.dispose();throw error;}
  if(generation!==this.visualGeneration){headquarters?.dispose();outdoor?.dispose();candidate.dispose();throw new Error('装修加载已被较新的预览请求替代，请重试');}
  // All runtime characters/camera, server IDs and callbacks remain owned by this controller.
  this.visuals.dispose();this.visuals=candidate;candidate.attachTo(this.scene);
  this.mountPremiumVisuals(headquarters!,outdoor!);
  this.renderer.toneMappingExposure=(theme as {environment:{exposure:number}}).environment.exposure;
 }
 setCharacterSkin(skin:string){this.characterSkin=skin;if(this.avatar&&this.role!=='owner')this.visuals.recolorCharacter(this.avatar,skin);for(const g of this.peers.values())if(g.userData.role!=='owner')this.visuals.recolorCharacter(g,skin);}
 enter(role:string,id:string){this.role=role;this.id=id;this.entered=true;this.mode='third';this.paused=false;
  this.ownerMotion?.dispose();this.ownerMotion=undefined;
  this.releaseAvatar(this.avatar);this.player.clear();if(role==='owner'&&this.ownerModel){this.avatar=cloneSkeleton(this.ownerModel) as T.Group;this.avatar.userData.ownerRig=true;this.ownerMotion=new CharacterMotion(this.avatar,this.ownerClips);}else this.avatar=this.makeAvatar('visitor');this.player.add(this.avatar!);
  if(role==='owner'&&!this.ownerModel)void this.ensureOwnerModel().catch(()=>this.onError('老板人物暂未载入，当前使用通用人物；业务可继续，刷新可重试'));
  // Opening a browser is observation, not a command to take control from the user's agent.
  this.yaw=this.player.rotation.y-Math.PI;this.pitch=.04;
 }
 setMode(mode:Mode){this.employeePreview=false;this.mode=mode;this.keys.clear();if(mode==='character'){this.yaw=this.player.rotation.y-Math.PI;this.pitch=.05;}}
 setKey(key:string,down:boolean){if(down)this.keys.add(key);else this.keys.delete(key);}
 getPresence(){return {x:this.pos.x,z:this.pos.z,yaw:this.player.rotation.y-Math.PI};}
 applyServerPosition(p:Peer){if(!this.keys.size)this.serverTarget=new T.Vector3(p.x,p.y,p.z);}
 applyPosition(p:{x:number;y:number;z:number;yaw:number},force=true){if(force||Math.hypot(p.x-this.pos.x,p.z-this.pos.z)>.7){this.keys.clear();this.pos.set(p.x,p.y,p.z);this.player.rotation.y=p.yaw+Math.PI;}if(force){this.mode='third';this.yaw=p.yaw;this.pitch=.04;}}
 private bind(){
  const canvas=this.renderer.domElement,signal=this.events.signal;
  window.addEventListener('keydown',e=>{
   if(this.paused||!this.entered||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;
   const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)){e.preventDefault();this.keys.add(key);}
   if(key==='v'&&!e.repeat)this.setMode(this.mode==='first'?'third':'first');
   if(key==='e'&&!e.repeat){
    if(this.nearReception()){this.onInteract();return;}
    const exhibit=this.nearestExhibit();if(exhibit){this.onExhibitInteract(exhibit);return;}
   }
   if(key==='e'&&!e.repeat&&Math.abs(this.pos.y-4.2)<.45&&Math.hypot(this.pos.x-1.25,this.pos.z+10.4)<3)this.onContentInteract();
   if(key==='e'&&!e.repeat&&((this.pos.y<.5&&this.pos.x>3&&this.pos.z>4.2)||(this.role==='owner'&&Math.abs(this.pos.y-8.4)<.45&&this.pos.x>=3&&this.pos.z<=-3.35)))this.onCompanyInteract();
   if(key==='e'&&!e.repeat&&this.pos.y<.5&&this.pos.x>1.2&&this.pos.x<7.6&&this.pos.z>-1.8&&this.pos.z<3.6)this.onActivityInteract(null);
  },{signal});
  window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()),{signal});
  window.addEventListener('blur',()=>{this.keys.clear();this.dragging=false;},{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.keys.clear();},{signal});
  canvas.addEventListener('pointerdown',e=>{if(this.paused)return;this.dragging=true;this.lastX=e.clientX;this.lastY=e.clientY;this.pointerStart.set(e.clientX,e.clientY);this.pointerDistance=0;canvas.setPointerCapture(e.pointerId);},{signal});
  canvas.addEventListener('pointermove',e=>{if(!this.dragging||this.paused)return;this.pointerDistance=Math.max(this.pointerDistance,this.pointerStart.distanceTo(new T.Vector2(e.clientX,e.clientY)));this.yaw-=(e.clientX-this.lastX)*.005;this.pitch=T.MathUtils.clamp(this.pitch+(e.clientY-this.lastY)*.004,-.8,1.05);this.lastX=e.clientX;this.lastY=e.clientY;},{signal});
  canvas.addEventListener('pointerup',e=>{if(!this.dragging||this.paused||!this.entered||this.pointerDistance>6)return;const rect=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);const hit=ray.intersectObjects(this.stageTargets,false)[0];if(!hit)return;const blocker=ray.intersectObjects([...this.officeWalls,...this.stageOccluders],true)[0];if(blocker&&blocker.distance<hit.distance-.05)return;const exhibit=this.readExhibit(hit.object);if(exhibit)this.onExhibitInteract(exhibit);},{signal});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>this.dragging=false,{signal});
 }
 private nearReception(){return this.entered&&this.pos.y<.5&&Math.hypot(this.pos.x-RECEPTION.x,this.pos.z-RECEPTION.z)<=3.1;}
 updateBusiness(data:{publicProjects:number;confirmedDeliveries:number}|null){this.premiumOffice?.updateBusiness(data);}
 updateDashboard(data:DashboardPresentation|null){this.premiumOffice?.updateDashboard(data);}
 updateMessages(data:MessagesPresentation|null){this.premiumOffice?.updateMessages(data);}
 updateCases(data:CasesPresentation|null){this.premiumOffice?.updateCases(data);}
 updateOwnBusiness(data:{workingTasks:number}|null){this.workBubble.textContent=data?.workingTasks?`我的商业任务 · ${data.workingTasks}项进行中`:'';}
 setEmployeePose(name:string|null){if(!this.sampleMotion)throw new Error('员工动作样板尚未载入');this.employeePreview=true;this.keys.clear();this.employeeSample.position.set(...(name==='Sit'||name==='Type'?[-6.5,4.2,7.46]:[-4.4,4.2,8.8]) as [number,number,number]);this.sampleMotion.setPose(name);}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.visualGeneration++;
  this.renderer.setAnimationLoop(null);this.events.abort();this.resizeObserver.disconnect();
  this.ownerMotion?.dispose();this.sampleMotion?.dispose();for(const motion of this.peerMotions.values())motion.dispose();
  this.premiumOffice?.dispose();this.outdoor?.dispose();this.visuals.dispose();
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>(),skeletons=new Set<T.Skeleton>();
  for(const root of [this.scene,this.ownerModel])root?.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);if(o instanceof T.Light&&(o as T.DirectionalLight).shadow)(o as T.DirectionalLight).shadow.dispose();if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of [o.material].flat()){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}}});
  skeletons.forEach(skeleton=>skeleton.dispose());
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  this.environmentTarget?.dispose();this.renderer.dispose();this.renderer.domElement.remove();this.activityLayer.remove();this.workBubble.remove();this.scene.clear();this.peers.clear();this.peerMotions.clear();
 }
 private readExhibit(object:T.Object3D):LobbyExhibit|null{const value=object.userData;if(value.lobbyExhibit==='cases')return {kind:'cases'};if(value.lobbyExhibit==='business')return {kind:'business'};if(value.lobbyExhibit==='company')return {kind:'company'};if(value.lobbyExhibit==='dashboard')return {kind:'dashboard'};if(value.lobbyExhibit==='messages')return {kind:'messages'};if(value.lobbyExhibit==='project'&&Number.isInteger(value.projectIndex)&&projects.items[value.projectIndex])return {kind:'project',projectIndex:value.projectIndex};return null;}
 private nearestExhibit():LobbyExhibit|null{
  if(!this.entered)return null;
  let best:T.Object3D|undefined,distance=3;
  for(const object of this.stageTargets){const p=object.getWorldPosition(new T.Vector3()),d=Math.hypot(p.x-this.pos.x,p.z-this.pos.z,p.y-this.pos.y);if(d<distance){best=object;distance=d;}}
  return best?this.readExhibit(best):null;
 }
 updateActivity(items:Activity[]){
  const key=JSON.stringify(items);if(key===this.activityKey)return;this.activityKey=key;this.activityLayer.replaceChildren();this.activityBubbles=[];
  const stages:Record<string,string>={reading:'整理材料',drafting:'起草中',checking:'核对中',waiting:'等待本人'};
  const labels:Record<string,string>={queued:'等待领取',working:'处理中','input-required':'请本人补充','result-ready':'建议稿已到'};
  items.slice(0,4).forEach((item,i)=>{const b=document.createElement('button');b.className='activity-bubble';const name=document.createElement('strong'),state=document.createElement('span');name.textContent=item.name+' · 授权代班';state.textContent=item.state==='working'?stages[item.stage]||labels.working:labels[item.state]||'状态待确认';b.append(name,state);b.onclick=()=>this.onActivityInteract(item);this.activityLayer.append(b);this.activityBubbles.push({button:b,point:new T.Vector3(i%2?6:3,2.1,i<2?2.2:-.7)});});
 }
 updatePeers(peers:Peer[]){
  this.peerTargets=new Map(peers.filter(p=>p.id!==this.id).map(p=>[p.id,p]));
  for(const[id,g]of this.peers)if(!this.peerTargets.has(id)||g.userData.role!==this.peerTargets.get(id)?.role){this.peerMotions.get(id)?.dispose();this.peerMotions.delete(id);this.releaseAvatar(g);this.scene.remove(g);this.peers.delete(id);}
  for(const[id,p]of this.peerTargets)if(!this.peers.has(id)){const ownerRig=p.role==='owner'&&Boolean(this.ownerModel),g=ownerRig?cloneSkeleton(this.ownerModel!) as T.Group:this.makeAvatar('visitor');g.userData.role=p.role;g.userData.ownerRig=ownerRig;if(ownerRig)this.peerMotions.set(id,new CharacterMotion(g,this.ownerClips));g.position.set(p.x,p.y,p.z);this.peers.set(id,g);this.scene.add(g);}
  this.requestNearbyOwner();
 }
 private requestNearbyOwner(){if(!this.ownerLoad&&this.entered&&[...this.peerTargets.values()].some(p=>p.role==='owner'&&Math.abs(p.y-this.pos.y)<2&&Math.hypot(p.x-this.pos.x,p.z-this.pos.z)<12))void this.ensureOwnerModel().catch(()=>this.onError('老板人物暂未载入，当前使用通用人物；刷新可重试'));}
 private animateRobot(g:T.Group,speed:number,dt:number,paused=false){
  if(paused||!g.userData.limbs)return;
  g.userData.gait+=dt*speed*5;
  const swing=speed>.03?Math.sin(g.userData.gait)*.45:0;
  (g.userData.limbs as T.Group[]).forEach((limb,i)=>limb.rotation.x=swing*(i%2?-1:1)*(i>1?-.65:1));
 }
 private frame(){
  const t=performance.now(),dt=Math.min((t-this.previousFrame)/1000,.05);this.previousFrame=t;
  const desiredFov=this.entered&&this.mode==='lobby'?72:62;
  if(this.camera.fov!==desiredFov){this.camera.fov=desiredFov;this.camera.updateProjectionMatrix();}
  const before=this.pos.clone();if(this.paused)this.keys.clear();
  const manualInput=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].some(k=>this.keys.has(k));
  if(manualInput)this.serverTarget=undefined;
  else if(this.serverTarget){this.pos.lerp(this.serverTarget,1-Math.exp(-dt*14));if(this.pos.distanceTo(this.serverTarget)<.002){this.pos.copy(this.serverTarget);this.serverTarget=undefined;}}
  if(this.entered&&!this.paused&&this.mode!=='overview'&&this.mode!=='lobby'&&this.mode!=='character'){
   let x=0,z=0;if(this.keys.has('w')||this.keys.has('arrowup'))z-=1;if(this.keys.has('s')||this.keys.has('arrowdown'))z+=1;if(this.keys.has('a')||this.keys.has('arrowleft'))x-=1;if(this.keys.has('d')||this.keys.has('arrowright'))x+=1;
   const v=new T.Vector3(x,0,z);if(v.lengthSq()){v.normalize().applyAxisAngle(new T.Vector3(0,1,0),this.yaw).multiplyScalar(dt*2.9);
    const supportX=supportAt(this.pos.x+v.x,this.pos.z,this.pos.y);
    if(supportX&&canMove(this.pos.x+v.x,this.pos.z,this.pos.y,this.role,this.pos.x,this.pos.z)){this.pos.x+=v.x;this.pos.y=supportX.y;}
    const supportZ=supportAt(this.pos.x,this.pos.z+v.z,this.pos.y);
    if(supportZ&&canMove(this.pos.x,this.pos.z+v.z,this.pos.y,this.role,this.pos.x,this.pos.z)){this.pos.z+=v.z;this.pos.y=supportZ.y;}
   }
  }
  const dx=this.pos.x-before.x,dz=this.pos.z-before.z,speed=dt>0?Math.hypot(dx,dz)/dt:0;
  const section=this.employeePreview?1:this.entered&&this.mode!=='overview'?Math.floor(this.pos.y/FLOOR_HEIGHT):null;if(section!==this.sectionLevel){this.premiumOffice?.setSection(section);this.sectionLevel=section;this.visuals.invalidateShadows();}this.employeeSample.visible=section===null||section>=1;
  this.requestNearbyOwner();
  this.player.position.copy(this.pos);if(speed>.01){const heading=Math.atan2(dx,dz);const turn=T.MathUtils.euclideanModulo(heading-this.player.rotation.y+Math.PI,Math.PI*2)-Math.PI;this.player.rotation.y+=turn*(this.reduced?1:1-Math.exp(-dt*16));}
  this.player.visible=this.entered&&this.mode!=='first';
  this.ownerMotion?.update(dt,speed,{paused:this.paused||document.hidden,reducedMotion:this.reduced});
  this.sampleMotion?.update(dt,0,{paused:this.paused||document.hidden,reducedMotion:this.reduced});
  if(this.avatar)this.animateRobot(this.avatar,speed,dt,this.paused||document.hidden);
  if(this.entered&&((manualInput&&speed>.001&&t-this.lastSent>350)||(this.hadManualInput&&!manualInput))){this.lastSent=t;this.onMove(this.getPresence());}
  this.hadManualInput=manualInput;
  this.onProximity(this.nearReception());
  this.onExhibitNear(this.nearestExhibit());
  const doorOpen=this.role==='owner'&&this.entered&&Math.hypot(this.pos.x-3,this.pos.z+5)<1.8;
  this.officeDoor.rotation.y=T.MathUtils.lerp(this.officeDoor.rotation.y,doorOpen?Math.PI/2:0,this.reduced?1:1-Math.exp(-dt*7));
  if(this.employeePreview){this.player.visible=false;const target=this.employeeSample.position.clone().add(new T.Vector3(0,1,0));this.camera.position.copy(target).add(new T.Vector3(2.1,1,-2.5));this.camera.lookAt(target);}
  else if(this.mode==='lobby'){
   const desired=this.entered
    ?new T.Vector3(.6,this.camera.aspect<.8?1.78:1.84,10.8)
    :this.camera.aspect<.8?new T.Vector3(27,17,47):new T.Vector3(18,12.5,35);
   this.camera.position.lerp(desired,this.reduced?1:1-Math.exp(-dt*8));
   this.camera.lookAt(this.entered?new T.Vector3(-3.35,1.62,-1.2):new T.Vector3(0,4.2,3.8));
   if(this.entered)this.player.visible=false;
  }else if(this.mode==='overview'){
   const desired=this.camera.aspect<.8?new T.Vector3(38,27,43):new T.Vector3(26,19,32);
   this.camera.position.lerp(desired,this.reduced?1:1-Math.exp(-dt*7));this.camera.lookAt(0,4.3,2.8);
  }else if(this.mode==='character'){
   const target=this.pos.clone().add(new T.Vector3(0,1.0,0));
   const offset=new T.Vector3(0,.15+this.pitch,-(this.camera.aspect<.8?3.4:2.65)).applyAxisAngle(new T.Vector3(0,1,0),this.yaw);
   this.camera.position.copy(target.clone().add(offset));this.camera.lookAt(target);
  }else{
   const eye=this.pos.clone().add(new T.Vector3(0,1.65,0));
   const direction=new T.Vector3(-Math.sin(this.yaw)*Math.cos(this.pitch),-Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
   let desired=eye.clone();
   if(this.mode==='third'){
    const offset=new T.Vector3(0,1.15,this.camera.aspect<.8?6.2:4.0).applyAxisAngle(new T.Vector3(0,1,0),this.yaw);
    desired.add(offset);
    const ray=new T.Raycaster(eye,desired.clone().sub(eye).normalize(),0,eye.distanceTo(desired));const hit=ray.intersectObjects([...this.officeWalls,...this.stageOccluders],true)[0];if(hit)desired.copy(eye.clone().addScaledVector(ray.ray.direction,Math.max(.15,hit.distance-.18)));
    this.camera.position.lerp(desired,this.reduced?1:1-Math.exp(-dt*14));this.camera.lookAt(eye.addScaledVector(direction,2));
    this.player.visible=this.camera.position.distanceTo(new T.Vector3(this.pos.x,this.pos.y+1.65,this.pos.z))>1.85;
   }else{this.camera.position.copy(desired);this.camera.lookAt(eye.add(direction));}
  }
  for(const[id,g]of this.peers){const p=this.peerTargets.get(id)!,old=g.position.clone();g.position.lerp(new T.Vector3(p.x,p.y,p.z),1-Math.exp(-dt*10));g.rotation.y=p.yaw+Math.PI;const peerSpeed=dt>0?Math.hypot(g.position.x-old.x,g.position.z-old.z)/dt:0;this.peerMotions.get(id)?.update(dt,peerSpeed,{paused:document.hidden,reducedMotion:this.reduced});this.animateRobot(g,peerSpeed,dt,document.hidden);}
  for(const {button,point}of this.activityBubbles){const p=point.clone().project(this.camera);button.hidden=!this.entered||p.z>1||p.z<-1||Math.abs(p.x)>1||Math.abs(p.y)>1;button.style.left=(p.x+1)*.5*this.container.clientWidth+'px';button.style.top=(-p.y+1)*.5*this.container.clientHeight+'px';}
  const workPoint=this.pos.clone().add(new T.Vector3(0,2.2,0)).project(this.camera);this.workBubble.hidden=!this.entered||this.paused||!this.workBubble.textContent||workPoint.z>1||Math.abs(workPoint.x)>1||Math.abs(workPoint.y)>1;this.workBubble.style.left=(workPoint.x+1)*.5*this.container.clientWidth+'px';this.workBubble.style.top=(-workPoint.y+1)*.5*this.container.clientHeight+'px';
  this.visuals.updateShadowCasters([this.player,this.officeDoor,...this.peers.values()]);
  this.renderer.render(this.scene,this.camera);
 }
 private resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.camera.aspect=w/Math.max(h,1);this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
}
