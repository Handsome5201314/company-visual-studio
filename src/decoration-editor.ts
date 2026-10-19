import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OfficeVisuals} from './office';
import {validateTheme,THEMES,MODEL_IDS} from './theme.js';
import {validateDecorationSafety,DECORATION_ZONES} from './decoration-safety.js';
import './decoration-editor.css';

type DecorationObject={id:string;model:string;position:number[];rotationY:number;scale:number[]};
type DecorationLight={id:string;position:number[];color:string;intensity:number;distance:number};
type DecorationScene={schemaVersion:number;compatibleContract:string;objects:DecorationObject[];lights:DecorationLight[]};
export type Design={theme:ReturnType<typeof validateTheme>;scene:DecorationScene};
type Options={assetBase?:string|null;readOnly?:boolean;comparison?:Design;comparisonAssetBase?:string|null;save?:(design:Design)=>Promise<void>;submit?:()=>Promise<void>};
const empty=()=>({schemaVersion:1,compatibleContract:'hq-fixed-layout-v1',objects:[],lights:[]});
const copy=<V>(v:V):V=>structuredClone(v);
export function createDecorationEditor(host:HTMLElement,initial:Partial<Design>={},options:Options={}){
 let design:Design={theme:validateTheme(initial.theme||THEMES[0]),scene:validateDecorationSafety(initial.scene||empty())},original=options.comparison?{theme:validateTheme(options.comparison.theme),scene:validateDecorationSafety(options.comparison.scene)}:copy(design);
 let office:OfficeVisuals|undefined,alive=true,busy=false,selected='',compare=false,generation=0,submitted=false,contextLost=false;
 const past:Design[]=[],future:Design[]=[];
 host.classList.add('decoration-editor');host.innerHTML=`<div class="de-stage"><div data-canvas></div><p data-load role="status">正在布置编辑场景…</p><div class="de-scene-error" hidden data-scene-error role="alert"><p data-scene-error-text></p><button type="button" data-retry>重新加载预览</button></div><p class="de-guide">拖动环绕 · 选中物件后可拖动摆放 · 绿色框为安全编辑范围</p></div><aside class="de-tools" aria-label="装修创作工具"><h3>装修工作台</h3><p>保留建筑、路线与角色。新陈设放入绿色区域；此处修改均为草稿。</p><label>空间风格<select data-theme></select></label><label>已添加物件<select data-selection><option value="">选择一个物件</option></select></label><label>家具模型<select data-model></select></label><label>添加到<select data-zone></select></label><button data-add>添加陈设</button><fieldset data-transform disabled><legend>选中物件</legend><div class="de-coordinates"><label>X<input data-x type="number" step="0.05"></label><label>Y<input data-y type="number" step="0.05"></label><label>Z<input data-z type="number" step="0.05"></label></div><label>朝向（度）<input data-angle type="number" step="15"></label><label>高度（米）<input data-size type="number" min="0.05" max="2" step="0.05"></label><button data-transform-apply>更新位置与尺寸</button><button data-replace>替换选中模型</button><button data-remove>删除选中陈设</button></fieldset><label>木饰／主体材质<input data-color type="color"></label><button data-material>应用材质</button><label>装饰灯颜色<input data-light-color type="color" value="#ffcc88"></label><label>装饰灯强度<input data-intensity type="range" min="0" max="3" step="0.1" value="1"></label><button data-light>设置接待区装饰灯</button><div class="de-actions"><button data-undo disabled>撤销</button><button data-redo disabled>重做</button><button data-compare>查看修改前</button><button data-export>导出设计 JSON</button><button data-screenshot>保存预览图</button></div><label>导入兼容设计<input data-import type="file" accept=".json,application/json"></label><button data-save class="primary">${options.save?'保存公司草稿':'保存到本机文件'}</button>${options.submit?'<button data-submit>提交老板审批</button>':''}<p data-message role="status" aria-live="polite"></p></aside>`;
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
 const opt=(value:string,label:string)=>{const n=document.createElement('option');n.value=value;n.textContent=label;return n;};
 themes.replaceChildren(...THEMES.map(t=>opt(t.id,t.name)));models.replaceChildren(...MODEL_IDS.map(id=>opt(id,id)));models.value='plantsmall1';zone.replaceChildren(...DECORATION_ZONES.map(z=>opt(z.id,z.name)));
 function reflect(){
  host.setAttribute('aria-busy',String(busy));host.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('.de-tools input,.de-tools button,.de-tools select').forEach(el=>el.disabled=busy||compare||submitted);$<HTMLButtonElement>('[data-compare]').disabled=busy;
  themes.value=design.theme.id;$<HTMLInputElement>('[data-color]').value=design.theme.environment.palette['#d7ba91']||'#d7ba91';
  const list=$<HTMLSelectElement>('[data-selection]');list.replaceChildren(opt('','选择一个物件'),...design.scene.objects.map(o=>opt(o.id,`${o.id} · ${o.model}`)));list.value=selected;
  const o=design.scene.objects.find(o=>o.id===selected);$<HTMLFieldSetElement>('[data-transform]').disabled=!o||busy||compare||submitted;
  ['x','y','z'].forEach((a,i)=>$<HTMLInputElement>(`[data-${a}]`).value=o?String(o.position[i]):'');$<HTMLInputElement>('[data-angle]').value=o?String(Math.round(o.rotationY*180/Math.PI)):'';$<HTMLInputElement>('[data-size]').value=o?String(o.scale[1]):'';
  $<HTMLButtonElement>('[data-undo]').disabled=!past.length||busy||compare||submitted;$<HTMLButtonElement>('[data-redo]').disabled=!future.length||busy||compare||submitted;
 }
 async function render(){
  if(contextLost){status('三维连接已中断，请返回并重新打开此预览。',true);return;}const token=++generation;busy=true;$('[data-scene-error]').hidden=true;$('[data-load]').textContent='正在验证并加载草稿…';reflect();
  const d=compare?original:design,candidate=new OfficeVisuals(new T.Scene(),'/',[],d.theme,(compare&&options.comparison?options.comparisonAssetBase:options.assetBase)||undefined);
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
 themes.onchange=()=>{if(busy||compare)return;const theme=THEMES.find(t=>t.id===themes.value)!;past.push(copy(design));future.length=0;design={theme:copy(theme),scene:copy(design.scene)};void render().catch(e=>status((e as Error).message,true));};
 function history(from:Design[],to:Design[]){if(busy||compare)return;const d=from.pop();if(!d)return;to.push(copy(design));design=d;selected='';void render().catch(e=>status((e as Error).message,true));}
 $('[data-undo]').onclick=()=>history(past,future);$('[data-redo]').onclick=()=>history(future,past);
 $('[data-compare]').onclick=()=>{if(busy)return;compare=!compare;$('[data-compare]').textContent=compare?'返回当前设计':'查看修改前';void render().catch(e=>status((e as Error).message,true));};
 function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const exportDesign=()=>download(new Blob([JSON.stringify(design,null,2)],{type:'application/json'}),'company-design.json');
 $('[data-export]').onclick=exportDesign;$('[data-screenshot]').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(b=>{if(b)download(b,'company-design-preview.png');else status('预览图导出失败，请重试',true);});};
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
