import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {LEVEL_HEIGHT,STAIR} from './plan.js';
import oakTextureUrl from './textures/light-oak.jpg?inline';
import stoneTextureUrl from './textures/cream-stone.jpg?inline';
import fabricTextureUrl from './textures/forest-fabric.jpg?inline';

export interface Project {title:string;description:string;status:string;image:string}
const FONT='"Microsoft YaHei","PingFang SC",sans-serif';
export function createHeadquarters(projects:Project[]){
 if(projects.length!==5)throw new Error('本样板按已授权的五个公开项目布展；项目数量变化需重新排布，不能静默丢弃');
 const root=new T.Group();root.name='Warm_Headquarters_Spatial_Prototype';
 const floors:T.Group[]=[],targets:T.Mesh[]=[];
 const texture=(url:string,rx:number,ry:number)=>{
  const value=new T.TextureLoader().load(url);
  value.wrapS=value.wrapT=T.RepeatWrapping;value.repeat.set(rx,ry);value.colorSpace=T.SRGBColorSpace;value.anisotropy=8;
  return value;
 };
 const oakMap=texture(oakTextureUrl,2,2),stoneMap=texture(stoneTextureUrl,7,6),fabricMap=texture(fabricTextureUrl,2.5,1.2);
 const physical=(color:string,roughness:number,metalness=0,extra:T.MeshPhysicalMaterialParameters={})=>new T.MeshPhysicalMaterial({color,roughness,metalness,...extra});
 const materials={
  oak:physical('#d1a06c',.34,0,{map:oakMap,clearcoat:.16,clearcoatRoughness:.34,envMapIntensity:1.05}),
  edge:physical('#875a36',.38,0,{map:oakMap,clearcoat:.12,clearcoatRoughness:.4}),
  stone:physical('#f4eee4',.25,0,{map:stoneMap,clearcoat:.22,clearcoatRoughness:.23,envMapIntensity:1.2}),
  floor:physical('#e8dfd3',.3,0,{map:stoneMap,clearcoat:.34,clearcoatRoughness:.19,envMapIntensity:1.4}),
  plaster:physical('#eee8dd',.72,0),
  plasterWarm:physical('#dec39b',.68,0),
  dark:physical('#202824',.34,.58,{envMapIntensity:1.2}),
  sage:physical('#405443',.72,0),
  leaf:physical('#214c2f',.62,0,{side:T.DoubleSide}),
  leafLight:physical('#527a42',.58,0,{side:T.DoubleSide}),
  leafDeep:physical('#173d28',.66,0,{side:T.DoubleSide}),
  cloth:physical('#d8cbb8',.8,0,{map:fabricMap}),
  clothLight:physical('#eadfce',.83,0),
  brass:physical('#c39b55',.28,.66,{envMapIntensity:1.8}),
  screen:physical('#132c3d',.24,.28,{envMapIntensity:1.4}),
  white:physical('#fffaf1',.4,0),
  blackGlow:new T.MeshBasicMaterial({color:'#0e1513'}),
  light:new T.MeshStandardMaterial({color:'#ffe7b5',emissive:'#ffd596',emissiveIntensity:4.5,toneMapped:false}),
  lightSoft:new T.MeshStandardMaterial({color:'#fff1d1',emissive:'#ffd9a1',emissiveIntensity:2.1,toneMapped:false}),
  glass:physical('#d4e4df',.05,0,{transparent:true,opacity:.2,transmission:.52,thickness:.04,ior:1.46,depthWrite:false,side:T.DoubleSide,envMapIntensity:2}),
  rug:physical('#c9baa5',.92,0),
 };
 function box(parent:T.Object3D,name:string,size:number[],pos:number[],material:T.Material,radius=0){
  const geo=radius?new RoundedBoxGeometry(size[0],size[1],size[2],3,radius):new T.BoxGeometry(size[0],size[1],size[2]);
  const mesh=new T.Mesh(geo,material);mesh.name=name;mesh.position.fromArray(pos);mesh.castShadow=material!==materials.glass;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 function cylinder(parent:T.Object3D,name:string,radius:number,height:number,pos:number[],material:T.Material,segments=32){
  const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,height,segments),material);mesh.name=name;mesh.position.fromArray(pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 function repeats(parent:T.Object3D,name:string,size:number[],positions:number[][],material:T.Material){
  const mesh=new T.InstancedMesh(new T.BoxGeometry(...size as [number,number,number]),material,positions.length);mesh.name=name;
  const matrix=new T.Matrix4();positions.forEach((p,i)=>{matrix.makeTranslation(p[0],p[1],p[2]);mesh.setMatrixAt(i,matrix);});mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 function line(parent:T.Object3D,a:number[],b:number[],radius:number,material:T.Material){
  const from=new T.Vector3(...a as [number,number,number]),to=new T.Vector3(...b as [number,number,number]);
  const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,from.distanceTo(to),8),material);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.sub(from).normalize());parent.add(mesh);return mesh;
 }
 function rail(parent:T.Object3D,a:number[],b:number[]){
  line(parent,[a[0],a[1]+1.03,a[2]],[b[0],b[1]+1.03,b[2]],.035,materials.dark);
  const d=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.ceil(d/1.8);
  for(let i=0;i<=n;i++){const t=i/n,x=T.MathUtils.lerp(a[0],b[0],t),y=T.MathUtils.lerp(a[1],b[1],t),z=T.MathUtils.lerp(a[2],b[2],t);line(parent,[x,y,z],[x,y+1.03,z],.025,materials.dark);}
  // Glass infill is geometric, without opaque walls across the view.
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([a[0],a[1]+.1,a[2],b[0],b[1]+.1,b[2],b[0],b[1]+.94,b[2],a[0],a[1]+.94,a[2]],3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  const panel=new T.Mesh(geometry,materials.glass);panel.material.side=T.DoubleSide;parent.add(panel);
 }
 function plaque(parent:T.Object3D,name:string,title:string,copy:string,w:number,h:number,pos:number[],rotation=0){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=Math.round(1536*h/w);const c=canvas.getContext('2d');if(!c)throw new Error('无法生成展牌');
  c.fillStyle='#f7f1e5';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#375749';c.fillRect(70,70,60,9);
  const poster=h/w>.8;
  if(poster){c.fillStyle='#365b49';c.fillRect(0,0,1536,410);c.fillStyle='#dce6d6';c.font=`34px ${FONT}`;c.fillText('公开作品 / PROJECT',80,95);c.fillStyle='#ffffff';}
  c.font=`500 ${poster?100:59}px ${FONT}`;c.fillText(title,poster?80:70,poster?265:163);c.fillStyle='#5e665b';c.font=`${poster?59:32}px ${FONT}`;
  const words=Array.from(copy);let text='',lineY=poster?550:240;for(const char of words){if(c.measureText(text+char).width>1370){c.fillText(text,70,lineY);text='';lineY+=poster?97:50;}text+=char;}c.fillText(text,70,lineY);
  if(poster){c.fillStyle='#365b49';c.font=`42px ${FONT}`;c.fillText('走近阅读 · 点击展牌',70,canvas.height-110);}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.name=name;mesh.position.fromArray(pos);mesh.rotation.y=rotation;parent.add(mesh);return mesh;
 }
 function screen(parent:T.Object3D,name:string,label:string,detail:string,w:number,h:number,pos:number[],rotation=0,tone='#256bbb'){
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=Math.round(1200*h/w);const c=canvas.getContext('2d');if(!c)throw new Error('无法生成项目屏');
  const grad=c.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,'#061a2c');grad.addColorStop(.5,tone);grad.addColorStop(1,'#111918');c.fillStyle=grad;c.fillRect(0,0,canvas.width,canvas.height);
  c.globalAlpha=.25;for(let i=0;i<12;i++){c.strokeStyle='#c8efff';c.lineWidth=i%3===0?4:1;c.beginPath();c.arc(canvas.width*.78,canvas.height*.42,70+i*28,.2,4.9);c.stroke();}c.globalAlpha=1;
  c.fillStyle='#a8ddf6';c.font=`500 24px ${FONT}`;c.fillText('TONGYI MOHE / PROJECT',54,66);
  c.fillStyle='#ffffff';c.font=`700 ${Math.max(34,Math.min(78,w*35))}px ${FONT}`;c.fillText(label,54,canvas.height*.38);
  c.fillStyle='#d8e3e4';c.font=`28px ${FONT}`;const words=Array.from(detail);let line='',y=canvas.height*.54;for(const char of words){if(c.measureText(line+char).width>canvas.width-108){c.fillText(line,54,y);line='';y+=42;}line+=char;}c.fillText(line,54,y);
  c.fillStyle='#c8eef7';c.fillRect(54,canvas.height-74,64,3);c.font=`20px ${FONT}`;c.fillText('公开作品 · 点击阅读',54,canvas.height-30);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));mesh.name=name;mesh.position.fromArray(pos);mesh.rotation.y=rotation;parent.add(mesh);return mesh;
 }
 function glowingLine(parent:T.Object3D,name:string,size:number[],pos:number[],material=materials.light){return box(parent,name,size,pos,material);}
 function plant(parent:T.Object3D,x:number,y:number,z:number,scale=1){
  const g=new T.Group();g.name='Plant_Assembly';g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
  box(g,'Cream_Planter',[.76,.72,.76],[0,.36,0],materials.stone,.07);box(g,'Dark_Soil',[.61,.025,.61],[0,.73,0],materials.dark);
  const positions:number[][]=[];for(let i=0;i<8;i++)positions.push([-.35+i*.1,.36,.39]);repeats(g,'Oak_Planter_Flutes',[.055,.62,.04],positions,materials.oak);
  // Curved leaves, not a solid green sphere. Deterministic for repeatable QA.
  for(let i=0;i<11;i++){
   const angle=i*2.4,length=.78+(i%4)*.18,start=new T.Vector3(0,.77,0),tip=new T.Vector3(Math.cos(angle)*(.38+i%3*.1),.95+length,Math.sin(angle)*(.38+i%3*.1));
   line(g,start.toArray(),tip.toArray(),.009,materials.leaf);
   const points:number[]=[],uv:number[]=[],indices:number[]=[];
   for(let j=0;j<=10;j++){const t=j/10,center=start.clone().lerp(tip,t);center.y+=Math.sin(t*Math.PI)*.22;const width=Math.sin(t*Math.PI)*.14;for(const sign of [-1,1]){points.push(center.x+Math.cos(angle+Math.PI/2)*width*sign,center.y,center.z+Math.sin(angle+Math.PI/2)*width*sign);uv.push((sign+1)/2,t);}if(j<10){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
   const material=i%2?materials.leaf:materials.leafLight;material.side=T.DoubleSide;const leaf=new T.Mesh(geometry,material);leaf.castShadow=true;g.add(leaf);
  }
 }
 const base=new T.Group();base.name='Foundation';root.add(base);
 box(base,'Floating_Plinth',[31,.45,25],[0,-.4,0],materials.stone,.18);
 box(base,'Ground_Slab',[30,.22,24],[0,-.11,0],materials.floor);
 const grout=new T.MeshStandardMaterial({color:'#c3bcaf',roughness:1});
 const joints:number[][]=[];for(let x=-13;x<15;x+=2)joints.push([x,.004,0]);repeats(base,'Floor_Grout_Long',[.012,.008,24],joints,grout);
 const cross:number[][]=[];for(let z=-10;z<12;z+=2)cross.push([0,.004,z]);repeats(base,'Floor_Grout_Cross',[30,.008,.012],cross,grout);
 for(let floor=0;floor<3;floor++){
  const y=floor*LEVEL_HEIGHT,g=new T.Group();g.name=`Level_${floor+1}`;floors.push(g);root.add(g);
  if(floor>0){
   box(g,'West_Slab',[11.5,.24,24],[-9.25,y-.12,0],materials.oak);box(g,'East_Slab',[11.5,.24,24],[9.25,y-.12,0],materials.oak);
   box(g,'Back_Slab',[7,.24,8.6],[0,y-.12,-7.7],materials.oak);box(g,'Atrium_Bridge',[7,.24,2.4],[0,y-.12,4.6],materials.oak);
   for(const x of [-3.5,3.5]){rail(g,[x,y,-3.4],[x,y,3.4]);rail(g,[x,y,5.8],[x,y,11.8]);}
   rail(g,[-3.5,y,5.8],[3.5,y,5.8]);rail(g,[-3.5,y,-3.4],[-2.9,y,-3.4]);rail(g,[2.9,y,-3.4],[3.5,y,-3.4]);
  }
  box(g,'Rear_Plaster',[30,3.85,.2],[0,y+1.925,-12],materials.plaster);
  box(g,'Rear_Oak_Ribbon',[30,.42,.16],[0,y+3.65,-11.84],materials.oak);
  box(g,'Ceiling_Wash',[29,.025,.035],[0,y+3.38,-11.7],materials.light);
  for(const x of [-14.9,14.9]){
   box(g,'Side_Sill',[.17,.4,24],[x,y+.2,0],materials.oak);
   box(g,'Side_Glass',[.04,3.1,23.4],[x,y+2.05,0],materials.glass);
   for(let z=-12;z<=12;z+=3)box(g,'Window_Mullion',[.1,3.4,.08],[x,y+2.1,z],materials.dark);
   box(g,'Window_Top_Rail',[.16,.12,24],[x,y+3.8,0],materials.dark);
   box(g,'Front_Fascia',[11.5,.4,.24],[x<0?-9.25:9.25,y+3.95,12],materials.oak);
  }
  for(const x of [-14.7,-3.5,3.5,14.7])for(const z of [-11.7,11.7])box(g,'Structural_Column',[.28,4.2,.28],[x,y+2.1,z],materials.edge);
  if(floor>0){
   for(const x of [-10,-6.5,6.5,10])for(const z of [-.2,6.6]){
    box(g,'Worktable_Blockout',[2.8,.12,1.35],[x,y+.78,z],materials.stone,.04);
    for(const dx of [-1.15,1.15])box(g,'Table_Leg',[.07,.72,1.12],[x+dx,y+.36,z],materials.dark);
    box(g,'Monitor_Blockout',[.95,.58,.045],[x,y+1.16,z-.18],materials.dark,.025);
   }
   for(const x of [-4.25,4.25])for(const z of [-8,2,9.8])plant(g,x,y,z,.85);
   plaque(g,'Floor_Name',floor===1?'02 / 创作与项目':'03 / 管理与协作','空间体量样板 · 业务尚未迁移',5.7,1.25,[-8.8,y+2.5,-11.84]);
  }
  if(floor<2){
   const stairs=new T.Group();stairs.name=`Staircase_${floor+1}_to_${floor+2}`;g.add(stairs);
   for(let i=0;i<STAIR.steps;i++){
    const rise=LEVEL_HEIGHT/2/STAIR.steps,run=4.8/STAIR.steps;
    box(stairs,'Oak_Tread_Up',[2.5,.14,run+.018],[-1.65,y+(i+1)*rise-.07,3.4-(i+.5)*run],materials.oak,.015);
    box(stairs,'Cream_Riser_Up',[2.5,rise,.04],[-1.65,y+(i+.5)*rise,3.4-i*run],materials.stone);
    box(stairs,'Oak_Tread_Return',[2.5,.14,run+.018],[1.65,y+2.1+(i+1)*rise-.07,-1.4+(i+.5)*run],materials.oak,.015);
    box(stairs,'Cream_Riser_Return',[2.5,rise,.04],[1.65,y+2.1+(i+.5)*rise,-1.4+i*run],materials.stone);
    if(i%2===0){box(stairs,'Tread_Accent',[2.25,.018,.022],[-1.65,y+(i+1)*rise+.007,3.4-i*run-.04],materials.light);box(stairs,'Tread_Accent',[2.25,.018,.022],[1.65,y+2.1+(i+1)*rise+.007,-1.4+i*run+.04],materials.light);}
   }
   box(stairs,'Half_Landing',[5.8,.18,2],[0,y+2.01,-2.4],materials.oak);
   for(const x of [-2.9,-.4])rail(stairs,[x,y,3.4],[x,y+2.1,-1.4]);
   for(const x of [.4,2.9])rail(stairs,[x,y+2.1,-1.4],[x,y+4.2,3.4]);
   rail(stairs,[-2.9,y+2.1,-3.4],[2.9,y+2.1,-3.4]);
   rail(stairs,[-2.9,y+2.1,-3.4],[-2.9,y+2.1,-1.4]);rail(stairs,[2.9,y+2.1,-3.4],[2.9,y+2.1,-1.4]);
  }
 }
 // Reception is the first detailed modular sample. Light and sign are separate
 // nodes; the cabinet itself is exportable without people, electronics or rooms.
 const reception=new T.Group();reception.name='Reception_Cabinet_5_6m';reception.position.set(0,0,7.2);floors[0].add(reception);
 box(reception,'Recessed_Platform',[5.45,.12,1.04],[0,.06,0],materials.dark,.07);
 box(reception,'Cabinet_Core',[5.5,.93,1.02],[0,.585,0],materials.edge,.07);
 const slats:number[][]=[];for(let x=-2.67;x<2.69;x+=.082)slats.push([x,.59,.532]);repeats(reception,'Oak_Fluted_Front',[.051,.89,.045],slats,materials.oak);
 for(const sign of [-1,1]){const side:number[][]=[];for(let z=-.44;z<.5;z+=.082)side.push([sign*2.772,.59,z]);repeats(reception,'Oak_Fluted_Side',[.045,.89,.051],side,materials.oak);}
 box(reception,'Black_Counter_Reveal',[5.63,.035,1.16],[0,1.07,0],materials.dark,.07);
 box(reception,'Cream_Stone_Counter',[5.65,.095,1.18],[0,1.135,0],materials.stone,.08);
 box(reception,'Inset_Stone_Brand_Panel',[3.7,.54,.035],[0,.63,.578],materials.stone,.035);
 box(reception,'Toe_Accent_LED',[5.24,.018,.018],[0,.14,.542],materials.light);
 // Employee-side storage and knee recess: intentional editable geometry.
 for(const x of [-2.05,2.05]){box(reception,'Rear_Storage',[1.1,.84,.49],[x,.53,-.76],materials.oak,.025);for(const yy of [.4,.7])box(reception,'Drawer_Reveal',[1.03,.012,.01],[x,yy,-1.012],materials.dark);box(reception,'Brass_Pull',[.25,.025,.025],[x,.78,-1.025],materials.brass);}
 box(reception,'Rear_Worktop',[5.1,.07,.48],[0,.91,-.77],materials.oak,.025);
 const receptionSign=plaque(floors[0],'Reception_Sign','童医魔盒','TONGYI MOHE · 接待与合作',3.3,.52,[0,.67,7.83]);
 receptionSign.renderOrder=1;
 const backdrop=floors[0];box(backdrop,'Reception_Backdrop',[6.1,2.9,.2],[0,1.45,6],materials.oak,.045);
 const rearSlats:number[][]=[];for(let x=-2.95;x<=2.95;x+=.14)rearSlats.push([x,1.45,6.12]);repeats(backdrop,'Backdrop_Flutes',[.06,2.82,.06],rearSlats,materials.edge);
 box(backdrop,'Company_Sign_Backing',[5.78,1.13,.065],[0,2.02,6.2],materials.stone,.02);
 plaque(backdrop,'Company_Identity','北京童医魔盒科技服务有限公司','把真实问题，做成真实作品',5.7,1.05,[0,2.02,6.244]);
 for(const x of [-3.35,3.35])plant(backdrop,x,0,6.05,1.15);
 plaque(backdrop,'Gallery_Title','公开作品 / PROJECTS','五个已公开项目 · 资料来自个人官网快照',6,1.1,[-9.3,2.85,-1.8]);
 for(let i=0;i<projects.length;i++){
  const z=8.8-i*2.25,x=-12.7;box(backdrop,'Project_Plinth',[1.25,.82,1.65],[x,.41,z],materials.oak,.05);
  box(backdrop,'Project_Frame',[.12,1.65,1.6],[x-.45,1.62,z],materials.dark,.04);
  const target=plaque(backdrop,`Project_${i}`,projects[i].title,projects[i].description+' / '+projects[i].status,1.5,1.5,[x-.37,1.65,z],Math.PI/2);target.userData.projectIndex=i;targets.push(target);
 }
 plaque(backdrop,'Vision','专业经验 × AI 协作','让人与自己信任的智能体协作，把想法做成真实成果。',5.9,1.55,[-8.7,2.1,-11.85]);
 plaque(backdrop,'Careers','诚招英才','医疗内容创作者 · 招聘与稿酬规则以正式公司公告为准',5.7,1.4,[-8.8,1.85,-5.5]);
 // One lounge arrangement establishes scale; no staged customers or staff.
 box(backdrop,'Sofa_Wood_Shell',[4.2,.85,1.25],[10.8,.49,7.1],materials.oak,.13);
 box(backdrop,'Sofa_Seat',[3.8,.3,1.07],[10.8,.61,7.2],materials.cloth,.13);
 box(backdrop,'Sofa_Back',[3.8,.75,.22],[10.8,1.05,6.62],materials.cloth,.1);
 for(const x of [9.4,12.2])box(backdrop,'Sage_Cushion',[.64,.62,.22],[x,1.02,6.87],materials.sage,.14);
 const table=new T.Mesh(new T.CylinderGeometry(.72,.72,.12,48),materials.oak);table.position.set(10.5,.48,9);table.castShadow=true;table.receiveShadow=true;backdrop.add(table);box(backdrop,'Table_Foot',[.7,.42,.7],[10.5,.21,9],materials.dark,.12);
 for(const p of [[13.7,0,9.7],[6,0,9.8],[-13.7,0,-10.5]])plant(backdrop,...p as [number,number,number],1.1);
 // Glass consultation room and sealed CEO block are volume samples only.
 for(const[floor,x,z,w,d,title]of [[0,10,-6.6,6,6,'咨询会客 / 空间样板'],[2,10,-7,6,7,'CEO 私室 / 待宿主权限迁移']] as const){
  const y=floor*4.2,g=floors[floor];
  box(g,'Room_Back',[w,3.1,.16],[x,y+1.55,z-d/2],materials.plaster);
  for(const sign of [-1,1])box(g,'Room_Side',[.08,3.1,d],[x+sign*w/2,y+1.55,z],materials.glass);
  box(g,'Room_Front',[w,3.1,.06],[x,y+1.55,z+d/2],floor===2?materials.plaster:materials.glass);
  box(g,'Room_Lintel',[w,.14,.14],[x,y+3.18,z+d/2],materials.dark);
  plaque(g,'Room_Label',title,'房间边界与摆位验证，未迁移正式业务',w-.3,.7,[x,y+2.5,z+d/2+.06]);
 }
 const resources=()=>{const geometries=new Set<T.BufferGeometry>(),mats=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of [o.material].flat()){mats.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}}});return {geometries,mats,textures};};
 return {root,floors,reception,targets,setSection(level:number|null){floors.forEach((g,i)=>g.visible=level===null||i<=level);},dispose(){const r=resources();r.geometries.forEach(g=>g.dispose());r.textures.forEach(t=>t.dispose());r.mats.forEach(m=>m.dispose());root.removeFromParent();}};
}
