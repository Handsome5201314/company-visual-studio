import {validateScene} from './decoration-package.js';
import budgets from './model-budgets.json' with {type:'json'};

// Version-one editable volumes lie on existing blocked counters or inside existing
// blocked furniture footprints. No new floor obstacle or navigation data is added.
export const DECORATION_ZONES=Object.freeze([
 {id:'reception-counter',name:'接待台陈设',min:[-6.6,1.15,.65],max:[-3.4,1.95,1.35]},
 {id:'work-counter-a',name:'工作台 A 陈设',min:[1.9,.86,-1.2],max:[7.1,1.5,-.2]},
 {id:'work-counter-b',name:'工作台 B 陈设',min:[1.9,.86,1.7],max:[7.1,1.5,2.7]},
 {id:'library',name:'书架装饰区',min:[8.1,0,4.1],max:[9.05,2.3,6.9]},
]);
export function objectEnvelope(object){
 const b=budgets[object.model];if(!b)throw new Error('模型无尺寸预算');
 const [sx,sy,sz]=object.scale,cs=Math.abs(Math.cos(object.rotationY)),sn=Math.abs(Math.sin(object.rotationY));
 const w=b.widthPerHeight*sx,d=b.depthPerHeight*sz,h=sy;
 return {min:[object.position[0]-(w*cs+d*sn)/2,object.position[1],object.position[2]-(w*sn+d*cs)/2],max:[object.position[0]+(w*cs+d*sn)/2,object.position[1]+h,object.position[2]+(w*sn+d*cs)/2]};
}
export function validateDecorationSafety(input){
 const scene=validateScene(input),envelopes=[];
 for(const object of scene.objects){
  const box=objectEnvelope(object);
  if(!DECORATION_ZONES.some(z=>box.min.every((v,i)=>v>=z.min[i]-1e-7)&&box.max.every((v,i)=>v<=z.max[i]+1e-7)))throw new Error(`物件 ${object.id} 超出安全装修体积；首版不允许占用走道、楼梯、门禁或交互点`);
  if(envelopes.some(b=>box.min.every((v,i)=>v<b.max[i]-.005)&&box.max.every((v,i)=>v>b.min[i]+.005)))throw new Error(`物件 ${object.id} 与已有装修重叠`);
  envelopes.push(box);
 }
 return scene;
}
