import * as T from 'three';
import {createModelLoader} from '../../src/model-loader';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import './character-review.css';
const stage=document.querySelector<HTMLDivElement>('#stage')!,status=document.querySelector<HTMLParagraphElement>('#status')!,select=document.querySelector<HTMLSelectElement>('#character')!,reference=document.querySelector<HTMLImageElement>('#reference')!,note=document.querySelector<HTMLParagraphElement>('#reference-note')!,walk=document.querySelector<HTMLButtonElement>('#walk')!;
const models:Record<string,string>={
 'shuai-alpha':'/models/shuai-transparent-20261020.glb?rev=transparent-20261020',
 shuai:'/models/shuai-rigged.glb?rev=neck-proportion-20261020',
 nurse:'/models/nurse-reference-20261020.glb?rev=head-sides-20261020'
};
const requested=new URLSearchParams(location.search).get('character');
if(requested&&Object.hasOwn(models,requested))select.value=requested;
function staticStatus(){return select.value==='shuai-alpha'?'新图重建 · 静态候选，尚未通过保真验收；可拖动查看。':'模型已加载，当前为静止姿态，可拖动查看。';}
const scene=new T.Scene();scene.background=new T.Color('#d6d5d1');
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;stage.append(renderer.domElement);
const camera=new T.PerspectiveCamera(35,1,.01,30),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.4;controls.maxDistance=6;controls.target.set(0,.94,0);
const hemisphere=new T.HemisphereLight(0xffffff,0x777777,2);scene.add(hemisphere);
let neutralEnvironment:T.Texture|undefined;
const cache=new Map<string,{model:T.Group;clips:T.AnimationClip[]}>();let current:T.Group|undefined,mixer:T.AnimationMixer|undefined,playing=false,loading=false,referenceView=false;
const clock=new T.Clock();
function stopAnimation(){
 mixer?.stopAllAction();playing=false;walk.textContent='播放走路';
 if(current)status.textContent=staticStatus();
}
function view(name:string){
 referenceView=name==='reference'&&select.value==='shuai';
 if(referenceView){
  stopAnimation();
  // Sparse fit to 14 original-image facial landmarks. Keep the camera level;
  // lens shift frames the body without tilting the view up at the face.
  camera.fov=53.695517;camera.position.set(.001869799,1.507383868,2.161335032);controls.target.set(.001869799,1.507383868,0);
 }else{
  camera.fov=35;const positions:Record<string,[number,number,number]>={front:[0,.94,3.35],quarter:[2,.94,2.7],quarter30:[1.675,.94,2.901185],quarter45:[2.368808,.94,2.368808],side:[3.35,.94,0],left:[-3.35,.94,0],back:[0,.94,-3.35]};camera.position.fromArray(positions[name]||positions.front);controls.target.set(0,.94,0);
 }
 controls.update();resize();
}
view('front');
function resize(){
 const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;
 renderer.setSize(width,height);camera.aspect=width/height;
 if(referenceView){
  // Match the original image's object-fit:contain, including narrow viewports.
  // All dimensions are CSS pixels; the renderer handles device pixel ratio.
  const scale=Math.min(width/1024,height/1536);
  camera.zoom=1;camera.fov=T.MathUtils.radToDeg(2*Math.atan(height/(2*1517.23777183*scale)));
  camera.setViewOffset(width,height,(512-514.05806013)*scale,(768-328.97432842)*scale,width,height);
 }else camera.clearViewOffset();
 camera.updateProjectionMatrix();
}new ResizeObserver(resize).observe(stage);
async function load(){
 if(loading)return;loading=true;select.disabled=true;walk.disabled=true;status.textContent='正在加载模型…';
 try{
  const id=select.value;document.querySelector<HTMLButtonElement>('[data-view="reference"]')!.disabled=id!=='shuai';reference.src=id==='nurse'?'/brand/nurse-original-reference.png':id==='shuai-alpha'?'/brand/shuai-transparent-reference-20261020.png':'/brand/shuai-original-reference.webp';note.textContent=id==='shuai-alpha'?'以本次提供的透明底图片重新生成；直接使用原图蒙版。当前为静态候选，未替换游戏角色。':id==='shuai'?'以最初全身原图为依据；“原图平视”使用相同显示比例并停止动画，便于核对轮廓。':'原始护士截图分辨率较低；面部与背部细节包含推断。';
  document.querySelector<HTMLHeadingElement>('#model-title')!.textContent=id==='shuai-alpha'?'3D 模型 · 新图重建（静态候选）':'3D 模型 · 游戏使用中';
  let item=cache.get(id);if(!item){const data=await createModelLoader().loadAsync(models[id]);item={model:data.scene,clips:data.animations};item.model.traverse(o=>{if(o instanceof T.Mesh)for(const m of [o.material].flat())if(m instanceof T.MeshBasicMaterial)m.toneMapped=false;});cache.set(id,item);}
  if(current)scene.remove(current);mixer?.stopAllAction();current=item.model;scene.add(current);mixer=new T.AnimationMixer(current);playing=false;
  if(id==='shuai-alpha'&&!neutralEnvironment){const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);neutralEnvironment=pmrem.fromScene(room).texture;room.dispose();pmrem.dispose();}
  scene.environment=id==='shuai-alpha'?neutralEnvironment!:null;
  hemisphere.intensity=id==='shuai-alpha'?.5:2;scene.environmentIntensity=.65;
  renderer.toneMapping=id==='shuai-alpha'?T.ACESFilmicToneMapping:T.NoToneMapping;
  stopAnimation();walk.disabled=!item.clips.some(c=>c.name==='Walk');view(id==='shuai'?'reference':'front');status.textContent=staticStatus();
  const url=new URL(location.href);url.searchParams.set('character',id);history.replaceState(null,'',url);
 }catch(error){status.textContent='模型加载失败：'+(error instanceof Error?error.message:String(error));}
 finally{loading=false;select.disabled=false;}
}
select.onchange=()=>void load();document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>view(button.dataset.view!));
walk.onclick=()=>{const item=cache.get(select.value);if(!item||!mixer)return;if(playing){stopAnimation();status.textContent='模型已加载，当前为静止姿态，可拖动查看。';}else{const clip=item.clips.find(c=>c.name==='Walk');if(clip){mixer.clipAction(clip).reset().play();playing=true;walk.textContent='停止走路';status.textContent='正在播放走路；核对比例请使用静止姿态。';}}};
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.1);mixer?.update(dt);controls.update();renderer.render(scene,camera);});void load();
