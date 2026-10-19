import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {validateTheme,DEFAULT_THEME,applyCharacterSkin} from './theme.js';
import budgets from './model-budgets.json';
import {validateDecorationSafety} from './decoration-safety.js';
import {FIXTURE_SLOTS} from './decoration-package.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type ProjectArtwork={title:string;image:string};
// Rendering only. Movement, access control, domain records and MCP stay in the host.
export class OfficeVisuals {
 readonly root=new T.Group();
 readonly officeDoor=new T.Group();
 readonly officeWalls:T.Object3D[]=[];
 private scene=this.root;
 private models=new Map<string,T.Object3D>();
 private materials:T.MeshStandardMaterial[]=[];
 private materialCache=new Map<string,T.MeshStandardMaterial>();
 private decorationLayer=new T.Group();
 private fixtureLayer=new T.Group();
 private surfaceOverrides:{id:string;color:string;roughness:number;metalness:number}[]=[];
 private theme=DEFAULT_THEME;
 private ambient=new T.HemisphereLight('#fff4df','#82735d',1.7);
 private sun=new T.DirectionalLight('#ffdfab',4.2);
 private fill=new T.DirectionalLight('#dae4de',1);
 private shadowPoses=new Map<T.Object3D,string>();
 private contactMaterial?:T.MeshBasicMaterial;
 constructor(private world:T.Scene,private baseUrl:string,private projects:ProjectArtwork[]=[],theme:unknown=DEFAULT_THEME,private packageAssetBase?:string) {
  this.theme=validateTheme(theme);
  this.root.name='company-visual-root';world.add(this.root);
  this.sun.position.set(-14,13,1);this.sun.target.position.set(2,0,-3);
  this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
  this.sun.shadow.autoUpdate=false;
  Object.assign(this.sun.shadow.camera,{left:-18,right:18,top:16,bottom:-16,near:.5,far:50});
  this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.035;
  this.fill.position.set(7,6,9);this.root.add(this.ambient,this.sun,this.sun.target,this.fill);
  this.build();this.craftDetails();this.mergeStatic();this.root.add(this.decorationLayer,this.fixtureLayer);this.setTheme(this.theme);
 }
 attachTo(world:T.Scene){this.world=world;world.add(this.root);this.setTheme(this.theme);}
 invalidateShadows(){this.sun.shadow.needsUpdate=true;}
 updateShadowCasters(roots:T.Object3D[]){
  const next=new Map<T.Object3D,string>();let changed=this.shadowPoses.size!==roots.length;
  for(const root of roots){const parts:string[]=[];root.traverse(o=>{parts.push(o.visible?'1':'0',...[...o.position,...o.quaternion,...o.scale].map(n=>n.toFixed(3)));});const pose=parts.join(',');next.set(root,pose);if(this.shadowPoses.get(root)!==pose)changed=true;}
  this.shadowPoses=next;if(changed)this.invalidateShadows();
 }
 private assetUrl(path:string){const base=this.packageAssetBase&&this.theme.assets.includes(path)?this.packageAssetBase:this.baseUrl;return base.replace(/\/$/,'')+'/'+path;}
 setTheme(input:unknown) {
  const theme=validateTheme(input);this.theme=theme;
  for(const material of this.materials){const base=material.userData.baseColor;material.color.set(theme.environment.palette[base] || base);}
  this.world.background=new T.Color(theme.environment.background);
  this.world.fog=new T.Fog(theme.environment.background,45,100);
  this.ambient.color.set(theme.environment.sky);this.ambient.groundColor.set(theme.environment.ground);this.ambient.intensity=theme.environment.ambient;
  this.sun.color.set(theme.environment.sunColor);this.sun.intensity=theme.environment.sun;
  this.fill.color.set(theme.environment.fillColor);this.fill.intensity=theme.environment.fill;
  this.applySurfaces();
  this.invalidateShadows();
 }
 recolorCharacter(root:T.Object3D,skin:string){applyCharacterSkin(root,skin);}
 setDecoration(input:unknown){
  const data=validateDecorationSafety(input),candidate=new T.Group();candidate.name='editable-decoration';
  for(const o of data.objects){const object=this.furniture(o.model,...o.position as [number,number,number],1,o.rotationY,candidate);object.scale.fromArray(o.scale);object.userData.decorationId=o.id;}
  for(const l of data.lights){const light=new T.PointLight(l.color,l.intensity,l.distance,2);light.position.fromArray(l.position);candidate.add(light);}
  const fixtures=this.createFixtures(data.fixtures||[]);
  this.clearLayer(this.decorationLayer);this.decorationLayer=candidate;this.root.add(candidate);
  this.clearLayer(this.fixtureLayer);this.fixtureLayer=fixtures;this.root.add(fixtures);
  this.surfaceOverrides=data.surfaces||[];this.setTheme(this.theme);
 }
 private createFixtures(overrides:{id:string;model:string}[]){const layer=new T.Group();layer.name='fixed-furniture-slots';for(const s of FIXTURE_SLOTS){const model=overrides.find(o=>o.id===s.id)?.model||s.model;const object=this.furniture(model,...s.position as [number,number,number],s.height,s.rotationY,layer);object.userData.fixtureId=s.id;}this.batchContacts(layer);return layer;}
 private clearLayer(layer:T.Group){layer.traverse(o=>{if(o instanceof T.Mesh&&o.name==='contact-shading')o.geometry.dispose();});layer.removeFromParent();layer.clear();}
 private applySurfaces(){
  const groups:Record<string,string[]>={floor:['#c7a47d','#cba980','#c1a079','#d4dfe4'],mezzanine:['#796246','#c9a983','#bd9973'],'back-wall':['#e6dcc6'],acoustic:['#6c805a','#85936b'],'reception-front':['#aa7954','#895c3e'],worktops:['#d7ba91','#e7d9b8'],'office-wall':['#788364','#bda883'],railings:['#3f4c3d']};
  for(const m of this.materials){m.roughness=m.userData.baseRoughness??.8;m.metalness=m.userData.baseMetalness??0;const entry=this.surfaceOverrides.find(s=>groups[s.id]?.includes(m.userData.baseColor));if(entry){m.color.set(entry.color);m.roughness=entry.roughness;m.metalness=entry.metalness;}}
 }
 get decorations(){return this.decorationLayer;}
 dispose(){
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  const collect=(o:T.Object3D)=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of [o.material].flat()){materials.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);}}};
  this.root.traverse(collect);for(const source of this.models.values())source.traverse(collect);
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  this.sun.shadow.dispose();this.root.removeFromParent();this.models.clear();this.materialCache.clear();this.materials=[];
  this.shadowPoses.clear();
 }
 private mat(color:string,roughness=.8){const key=color+':'+roughness,cached=this.materialCache.get(key);if(cached)return cached;const m=new T.MeshStandardMaterial({color:this.theme.environment.palette[color] || color,roughness});m.userData.baseColor=color;m.userData.baseRoughness=roughness;this.materials.push(m);this.materialCache.set(key,m);return m;}
 private round(w:number,h:number,d:number,x:number,y:number,z:number,color:string,r=.08,parent:T.Object3D=this.scene){const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)),this.mat(color,.55));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 private box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent:T.Object3D=this.scene){
  const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),this.mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 private cylinder(r:number,h:number,x:number,y:number,z:number,color:string,parent:T.Object3D=this.scene){
  const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,24),this.mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 private text(text:string,w:number,h:number,x:number,y:number,z:number,color='#f6f0db',bg='#3b5144',ry=0){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*h/w);
  const ctx=canvas.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=color;ctx.font=`500 ${Math.min(canvas.height*.5,100)}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,canvas.height/2,970);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const plane=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}));plane.position.set(x,y,z);plane.rotation.y=ry;this.scene.add(plane);return plane;
 }
 private rail(x1:number,z1:number,x2:number,z2:number,y1:number,y2=y1){
  const a=new T.Vector3(x1,y1,z1),b=new T.Vector3(x2,y2,z2),delta=b.clone().sub(a);
  const mesh=new T.Mesh(new T.CylinderGeometry(.035,.035,delta.length(),12),this.mat('#3f4c3d'));
  mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());this.scene.add(mesh);
 }
 private contact(w:number,d:number,x:number,y:number,z:number,parent:T.Object3D){
  if(!this.contactMaterial){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,5,32,32,32);gradient.addColorStop(0,'rgba(26,23,17,.32)');gradient.addColorStop(.45,'rgba(26,23,17,.18)');gradient.addColorStop(1,'rgba(26,23,17,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);this.contactMaterial=new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false,toneMapped:false});}
  const shadow=new T.Mesh(new T.PlaneGeometry(w,d),this.contactMaterial);shadow.name='contact-shading';shadow.rotation.x=-Math.PI/2;shadow.position.set(x,y,z);shadow.raycast=()=>{};parent.add(shadow);
 }
 private batchContacts(parent:T.Object3D){
  const rows=parent.children.filter((o):o is T.Mesh=>o instanceof T.Mesh&&o.name==='contact-shading');if(rows.length<2)return;
  const geometries=rows.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);});const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)return;
  const mesh=new T.Mesh(merged,this.contactMaterial);mesh.name='contact-shading';mesh.raycast=()=>{};parent.add(mesh);rows.forEach(o=>{o.geometry.dispose();o.removeFromParent();});
 }
 private build(){
  this.box(20.5,.5,16.5,0,-.28,0,'#78634c');
  if(this.theme.architecture==='cyber'){
   for(let x=-9;x<=9;x+=2)for(let z=-7;z<=7;z+=2)this.box(1.96,.08,1.96,x,-.02,z,'#d4dfe4');
   for(const x of [-1.25,1.25])this.box(.035,.015,14,x,.03,0,'#48b9cf');
  }else for(let i=0;i<40;i++)this.box(.493,.08,16,-9.75+i*.5,-.02,0,i%3===0?'#c7a47d':i%3===1?'#cba980':'#c1a079');
  this.box(20.3,7,.22,0,3.5,-8,'#e6dcc6');
  this.box(.2,.9,16,-10,.45,0,'#bbae90');
  // Left wall is a real wood window lattice; the sunlight crosses its mullions.
  for(let z=-8;z<=8;z+=2)this.box(.19,6.3,.12,-10,3.8,z,'#806d50');
  for(let y=1.1;y<=7;y+=1.18)this.box(.19,.10,16,-10,y,0,'#806d50');
  const glass=new T.Mesh(new T.PlaneGeometry(16,6),new T.MeshStandardMaterial({color:'#f0dfb5',transparent:true,opacity:.11,roughness:.2,side:T.DoubleSide,depthWrite:false}));glass.position.set(-10.05,4,0);glass.rotation.y=Math.PI/2;this.scene.add(glass);
  this.box(.3,7,.3,-10,3.5,-8,'#6c5e43');this.box(20.2,.23,.28,0,7,-8,'#6c5e43');
  // Full-size mezzanine with a walkable staircase and protected edges.
  this.box(11,.26,5,4.45,3.27,-5.5,'#796246');
  for(let i=0;i<22;i++)this.box(.492,.05,4.9,-.8+i*.5,3.42,-5.5,i%2?'#c9a983':'#bd9973');
  for(let i=0;i<18;i++){const h=(i+1)/18*3.4;this.box(2.1,h,.335,0,h/2,3-(i+.5)*6/18,'#b28a61');}
  for(let i=0;i<=6;i++){const z=3-i;const y=i/6*3.4;this.cylinder(.035,1,-1.07,y+.5,z,'#3f4c3d');this.cylinder(.035,1,1.07,y+.5,z,'#3f4c3d');}
  this.rail(-1.07,3,-1.07,-3,1,4.4);this.rail(1.07,3,1.07,-3,1,4.4);
  if(this.theme.architecture==='cyber')for(let i=0;i<18;i++)this.box(1.92,.025,.035,0,(i+1)/18*3.4+.015,3-i*6/18-.30,'#48b9cf');
  for(let x=1.35;x<10;x+=.65)this.cylinder(.025,1,x,3.95,-3,'#3f4c3d');this.rail(1.35,-3,10,-3,4.45);
  for(let z=-8;z<-3;z+=.7)this.cylinder(.025,1,-1.07,3.95,z,'#3f4c3d');this.rail(-1.07,-8,-1.07,-3.3,4.45);
  this.box(.19,3.3,.2,9,1.65,-3.2,'#806748');this.box(.19,3.3,.2,2.6,1.65,-3.2,'#806748');
  // Sage green back wall, wood acoustic slats, warm practical lighting.
  this.box(8.5,2.8,.08,5.1,5.2,-7.83,'#6c805a');
  for(let i=0;i<24;i++)this.box(.065,2.8,.06,1.1+i*.35,5.2,-7.73,'#85936b');
  this.text('童医魔盒科技',5.4,.75,4.8,5.45,-7.66);
  this.text('把真实问题，做成真实作品',4.5,.38,4.8,4.8,-7.65,'#ede5cd','#6c805a');
  // A closed private office, with one server-authorized doorway on the west.
  this.officeWalls.push(this.box(6.9,3.15,.18,6.45,5.0,-3.35,'#788364'));
  this.officeWalls.push(this.box(.18,3.15,2.4,3,5.0,-6.8,'#bda883'));
  this.officeWalls.push(this.box(.18,3.15,1.05,3,5.0,-3.875,'#bda883'));
  this.officeWalls.push(this.box(.18,3.15,4.5,9.9,5,-5.6,'#bda883'));
  this.officeWalls.push(this.box(6.9,.13,4.5,6.45,6.62,-5.6,'#c7b38e'));
  this.officeWalls.push(this.box(.18,.48,1.2,3,6.38,-5,'#bda883'));
  this.officeDoor.position.set(3,3.4,-5.6);this.scene.add(this.officeDoor);
  this.box(.10,2.75,1.2,0,1.375,.6,'#725d42',this.officeDoor);
  this.cylinder(.035,.22,-.1,1.25,1.03,'#e6c78d',this.officeDoor);
  this.officeWalls.push(this.text('老板办公室 · 预约请到一楼前台',4.9,.36,6.4,5.1,-3.24,'#f5ead4','#526247'));
  // Dedicated upstairs journal corner; published articles live in the content service.
  this.box(2.7,1.65,.13,1.25,5.15,-7.55,'#9b7954');
  this.box(2.45,1.4,.04,1.25,5.15,-7.46,'#3e5544');
  this.text('内容放映室',2.1,.34,1.25,5.55,-7.42,'#f9ecd0','#3e5544');
  this.text('行业观察 · 研究新知 · 医生故事',2.2,.25,1.25,5.12,-7.41,'#dfd6bb','#3e5544');
  this.text('靠近后按 E 阅读公告栏',2.0,.24,1.25,4.75,-7.41,'#dfd6bb','#3e5544');
  this.text('接待 · 需求登记',2.6,.4,-5,1.0,1.49,'#f4ead6','#496051');
  this.text('作品与进行中的事',4.6,.5,-5.4,3.2,-7.84,'#443e31','#e6dcc6');
  this.text('个人工作区 · 可由本人或授权智能体操作',5.3,.42,5.2,2.55,-7.82,'#544d3c','#e6dcc6');
  this.box(3.6,1.05,.9,-5,.525,1,'#aa7954');
  for(let i=0;i<25;i++)this.box(.065,.88,.03,-6.65+i*.136,.49,1.467,'#895c3e');
  this.box(3.8,.09,1.05,-5,1.1,1,'#e7d9b8');
  this.box(4.3,.018,3,-5,.045,3.2,'#8a9975');
  this.box(6.5,.018,6.9,4.7,.045,.7,'#a59d7b');
  this.box(3.7,.018,4,-7.3,.045,-3.8,'#c2906b');
  this.box(5.8,.022,4.0,6.25,.05,5.8,'#9ca282');
  this.box(2.4,.12,1.1,6,.80,5.9,'#d7ba91');
  for(const x of [5.1,6.9])for(const z of [5.55,6.25])this.box(.09,.74,.09,x,.37,z,'#52594a');
  for(const z of [4.95,6.85]){this.box(2,.14,.5,6,.48,z,'#916b4e');this.box(2,.7,.1,6,.9,z+(z<6?-.23:.23),'#817d59');}
  this.text('会客室 · 预约双方私密交流',3.8,.36,6,2.4,7.7,'#3a4f3e','#f0e6d1',Math.PI);
  const robot=this.makeAvatar('reception');robot.position.set(-5,0,-.05);this.scene.add(robot);
  this.text('接待员 · 需求咨询',2.1,.34,-5,2.5,-.03,'#3a4f3e','#f0e6d1');
  // Pending workstations remain unoccupied, rather than acting out fake work.
  for(const z of [-.7,2.2]){
   this.box(5.7,.12,1.35,4.5,.79,z,'#d7ba91');
   for(const x of [2.1,6.9])for(const dz of [-.45,.45])this.box(.08,.74,.08,x,.37,z+dz,'#52594a');
   // Screens are replaceable fixed slots; no duplicate placeholder monitor geometry.
  }
  // Pendant lamps are local forms, not a post-processing color filter.
  for(const[x,z,y]of [[-5,1,5.7],[4.5,1,6.2],[5,-5.7,6.5]]){
   this.cylinder(.013,7-y,x,(7+y)/2,z,'#4f4c3a');
   const shade=new T.Mesh(new T.ConeGeometry(.5,.25,32,1,true),this.mat('#57654d'));shade.position.set(x,y,z);this.scene.add(shade);
   const bulb=new T.Mesh(new T.SphereGeometry(.09,16,12),new T.MeshBasicMaterial({color:'#ffe0a1'}));bulb.position.set(x,y-.13,z);this.scene.add(bulb);
  }
  // Distant greenery is scenery only. No buildings or clinical files are imported.
  this.box(90,.2,90,0,-.8,-5,'#c3bc95');
  for(let i=0;i<9;i++){
   const x=-15-(i%3)*4,z=-15+i*4;
   if(this.theme.architecture==='cyber'){this.box(2.2,8+i%3*3,2.2,x,2,z,'#aac6d4');this.box(2.25,.12,2.25,x,6+(i%3)*1.5,z,'#48b9cf');continue;}
   this.cylinder(.14,2.6,x,.5,z,'#8a7959');
   const tree=new T.Mesh(new T.IcosahedronGeometry(2,2),this.mat(i%2?'#9ba977':'#acb887'));tree.scale.y=1.5;tree.position.set(x,3,z);tree.castShadow=true;this.scene.add(tree);
  }
  if(this.theme.architecture==='cyber'){
   for(const z of [-.7,2.2])for(const x of [3,6]){
    this.box(1.25,.05,.9,x,1.95,z-.2,'#245a75');
    for(const dx of [-.59,.59])this.box(.05,1.1,.08,x+dx,1.4,z-.6,'#7194a4');
    this.box(1.1,.025,.025,x,1.9,z+.2,'#48b9cf');
   }
   const ring=new T.Mesh(new T.TorusGeometry(2.3,.045,8,64),new T.MeshBasicMaterial({color:'#79d7e2'}));ring.rotation.x=Math.PI/2;ring.position.set(4.5,4.8,1);this.scene.add(ring);
   for(const z of [4.9,6.9])this.box(2.3,.04,.025,6,.9,z,'#48b9cf');
   this.text('协作实验室',3.1,.42,-5.2,4.7,-7.83,'#e4f8ff','#245a75');
  }
 }
 private mergeStatic(){
  // Only immutable, direct architectural meshes. Door/walls/characters and
  // editable layers retain identity and their own lifecycle in the host.
  this.root.updateMatrixWorld(true);const groups=new Map<T.Material,T.Mesh[]>();
  for(const o of this.root.children)if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial&&!this.officeWalls.includes(o)){const rows=groups.get(o.material)||[];rows.push(o);groups.set(o.material,rows);}
  for(const [material,rows]of groups){if(rows.length<3)continue;const geometries=rows.map(o=>{const g=o.geometry.clone().applyMatrix4(o.matrix);return g.index?g.toNonIndexed():g;});const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)continue;const mesh=new T.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='batched-architecture';this.root.add(mesh);rows.forEach(o=>{o.geometry.dispose();o.removeFromParent();});}
 }
 private craftDetails(){
  const cyber=this.theme.architecture==='cyber';
  // Joinery on the closed office facade breaks up the blank upper-storey box.
  // All pieces remain part of its cutaway group; the host's solid walls stay put.
  const facade=new T.Group();facade.name='office-facade-joinery';this.root.add(facade);this.officeWalls.push(facade);
  for(const x of [4.12,6.43,8.74]){
   this.round(2.15,.88,.045,x,5.79,-3.23,cyber?'#739cae':'#b49973',.025,facade);
   this.round(2.02,.75,.022,x,5.79,-3.195,cyber?'#183e56':'#40594f',.025,facade);
   this.box(2.03,.018,.015,x,5.60,-3.18,cyber?'#72cfd7':'#a78f68',facade);
  }
  this.box(6.85,.08,.065,6.45,4.18,-3.22,cyber?'#93bccb':'#af9169',facade);
  for(const z of [-7.25,-5.75,-4.25])this.box(.025,2.94,.035,10.005,5.0,z,cyber?'#6aa4ba':'#8e795d',facade);
  // A precise stair assembly: individual tread caps and shadow gaps follow the
  // authoritative stair, without adding a new footprint or touching navigation.
  for(let i=0;i<18;i++){const y=(i+1)/18*3.4,z=3-(i+.5)/3;this.box(2.04,.035,.31,0,y+.013,z,cyber?'#8cbdca':'#dcc39d');this.box(2.03,.018,.022,0,y+.035,z+.14,cyber?'#71dce1':'#8c7251');}
  // Thin wall-mounted joinery and gallery; remains behind the circulation area.
  for(let i=0;i<3;i++){
   const x=-8.5+i*2.05;this.round(1.76,2.25,.09,x,2.15,-7.79,cyber?'#274d65':'#86694d',.04);
   this.round(1.6,2.09,.035,x,2.15,-7.72,cyber?'#0f2d43':'#f0dfbc',.03);
   const disc=new T.Mesh(new T.CircleGeometry(.48,48),this.mat(cyber?'#5db9ce':['#b7794c','#79916b','#c0a66e'][i]));disc.position.set(x,2.36,-7.69);this.root.add(disc);
   for(let j=0;j<6;j++)this.box(.82+j*.08,.012,.015,x,1.5+j*.065,-7.68,cyber?'#6daebf':'#a2865f');
  }
  if(cyber){
   // Ribbed portal and segmented luminous ceiling, replacing the warm pergola.
   for(const x of [-8.5,-4.8,1.6,5.4,9.1]){
    const spine=new T.Mesh(new T.TorusGeometry(2.9,.075,6,32,Math.PI),this.mat('#678e9d',.35));spine.rotation.y=Math.PI/2;spine.position.set(x,4.05,1.4);this.root.add(spine);
    this.round(.13,1.65,.16,x,4.83,-1.5,'#24485b');this.round(.13,1.65,.16,x,4.83,4.3,'#24485b');
   }
   for(const z of [-1.45,4.2]){this.round(17.8,.11,.16,.15,5.7,z,'#294f63');this.box(17.55,.018,.05,.15,5.63,z,'#8ce8eb');}
   // Reception shell with layered wings, concealed base and integrated display.
   this.round(3.55,.68,.13,-5,.72,1.48,'#d5e7ed',.06);this.round(3.05,.36,.035,-5,.78,1.56,'#1c4058',.06);
   for(let i=0;i<9;i++)this.box(.06,.12+i%3*.06,.015,-6+i*.25,.8,1.585,'#68c9d8');
   this.round(3.1,.08,.10,-5,.16,1.48,'#193e55');
   // Terraced vertical research garden, floating planters on the back wall.
   for(let i=0;i<4;i++){this.round(1.2,.17,.32,8.5,1+i*.53,-7.65,'#274c62');for(let j=0;j<7;j++){const leaf=new T.Mesh(new T.OctahedronGeometry(.12,1),this.mat(j%2?'#60a49a':'#96c8b4'));leaf.scale.set(.5,1.9,.7);leaf.rotation.z=(j-3)*.15;leaf.position.set(8.07+j*.14,1.25+i*.53,-7.55);this.root.add(leaf);}}
  }else{
   // Slatted timber canopy with brass suspension. It frames the double-height
   // space while keeping the main overview open to the two floors.
   for(let i=0;i<9;i++)this.round(.09,.12,4.8,-8.7+i*.66,6.7,-4.5,'#806d50',.025);
   for(const z of [-6.4,-2.65])this.round(5.75,.12,.1,-6.05,6.57,z,'#6c5e43',.025);
   // Sculpted pendant shades (lathed profile), not a single cone with a bulb.
   for(const [x,z,y]of [[-6,3.6,4.8],[4.5,.7,5.6]]){
    const points=[[.05,0],[.13,.03],[.16,.22],[.29,.34],[.48,.37],[.51,.34]].map(p=>new T.Vector2(...p as [number,number]));
    const mesh=new T.Mesh(new T.LatheGeometry(points,40),this.mat('#d4b683',.45));mesh.position.set(x,y,z);mesh.rotation.x=Math.PI;mesh.castShadow=true;this.root.add(mesh);
    this.cylinder(.012,7-y,x,(7+y)/2,z,'#7f785f');this.cylinder(.46,.018,x,y-.34,z,'#f6e6c4');
   }
   // Fluted reception and upholstered meeting benches with rounded joinery.
   this.round(3.7,.08,1.08,-5,1.12,1,'#e7d9b8',.035);
   for(const z of [4.95,6.85]){this.round(1.94,.09,.45,6,.6,z,'#819270',.04);for(let i=0;i<5;i++)this.box(.012,.31,.014,5.28+i*.36,.94,z+(z<6?-.292:.292),'#a3ac88');}
   // Wall books and storage give the mezzanine a furnished silhouette.
   for(let row=0;row<2;row++){this.round(2.6,.08,.42,1.25,3.9+row*.5,-7.53,'#9c815f',.025);for(let i=0;i<12;i++){const h=.19+(i%4)*.04;this.box(.11,h,.19,.15+i*.19,3.94+row*.5+h/2,-7.48,['#697e62','#a97e59','#d0ba8a','#48605a'][i%4]);}}
  }
  // Deterministic grain in the actual timber material, not a screen overlay.
  if(!cyber){const c=document.createElement('canvas');c.width=128;c.height=512;const ctx=c.getContext('2d')!;ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,128,512);for(let i=0;i<100;i++){const x=(i*37)%128;ctx.strokeStyle=i%3?'#d2cebf':'#f8f5ea';ctx.lineWidth=i%3?.5:1;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+4,180,x-4,320,x+2,512);ctx.stroke();}const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(1,4);map.colorSpace=T.SRGBColorSpace;for(const m of this.materials)if(['#c7a47d','#cba980','#c1a079','#d7ba91','#c9a983','#bd9973'].includes(m.userData.baseColor)){m.map=map;m.needsUpdate=true;}}
 }
 makeAvatar(kind:string){
  const g=new T.Group(),coat=kind==='reception'?'#e6d4ae':'#708c7b';
  const head=new T.Mesh(new T.CapsuleGeometry(.28,.16,5,16),this.mat('#e4e2cb'));head.position.y=1.55;g.add(head);
  this.box(.43,.24,.05,0,1.57,.265,'#283f36',g);
  for(const x of [-.11,.11])this.box(.045,.055,.025,x,1.58,.3,'#dceab9',g);
  const body=new T.Mesh(new T.CapsuleGeometry(.24,.42,6,16),this.mat(coat));body.position.y=.94;g.add(body);
  const limbs:T.Group[]=[];
  for(const x of [-.16,.16]){const pivot=new T.Group();pivot.position.set(x,.59,0);g.add(pivot);this.cylinder(.09,.48,0,-.25,0,'#515b48',pivot);this.box(.18,.13,.29,0,-.51,.055,'#454c3d',pivot);limbs.push(pivot);}
  for(const x of [-.36,.36]){const pivot=new T.Group();pivot.position.set(x,1.2,0);g.add(pivot);const arm=new T.Mesh(new T.CapsuleGeometry(.075,.38,4,12),this.mat(coat));arm.position.y=-.22;pivot.add(arm);limbs.push(pivot);}
  g.userData.limbs=limbs;g.userData.gait=0;
  g.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});return g;
 }
 async load(onProgress:(text:string)=>void){
  const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath(this.assetUrl('draco/'));loader.setDRACOLoader(draco);
  const names=['chairdesk','computerscreen','plantsmall1','pottedplant','loungedesignsofa','loungedesignchair','tablecoffee','bookcaseopen','books','desk','laptop','kitchencabinet','kitchencoffeemachine'];
  let loaded=0;
  try {
  const jobs=await Promise.allSettled(names.map(async name=>{const gltf=await loader.loadAsync(this.assetUrl(this.theme.models[name] || `furniture/${name}.glb`));this.models.set(name,gltf.scene);onProgress(`布置总部 ${++loaded}/${names.length}`);}));
  const failed=jobs.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  for(const z of [-.7,2.2])for(const x of [3,6]){
   this.furniture('chairdesk',x,0,z+.95,1.18);
   this.furniture('plantsmall1',x+.85,.86,z,.34);
  }
  this.furniture('chairdesk',6,3.4,-6.9,1.17,Math.PI);this.furniture('laptop',6,4.25,-5.8,.38);
  this.furniture('books',7,4.25,-5.7,.16);
  this.furniture('loungedesignchair',-5.4,0,-6.1,.95,-.4);this.furniture('tablecoffee',-5.6,0,-4.3,.48);
  this.furniture('books',-5.6,.48,-4.3,.16);
  for(const[x,z,y]of [[-9,-7,0],[-9,6.8,0],[8.7,6.7,0],[8.9,-6.9,3.4],[-1.8,-7,0]])this.furniture('pottedplant',x,y,z,1.55);
  for(const x of [2.4,3.5])this.furniture('kitchencabinet',x,0,-7,.85);
  this.furniture('kitchencoffeemachine',2.5,.85,-7,.5);
  await Promise.all(this.projects.map(async(p,i)=>{
   const x=-8.5+i*1.68;
   this.box(1.36,1.6,.08,x,1.91,-7.75,'#937452');
   this.box(1.24,1.48,.03,x,1.91,-7.69,'#f5ecd7');
   const texture=await new T.TextureLoader().loadAsync(p.image);texture.colorSpace=T.SRGBColorSpace;
   const artwork=new T.Mesh(new T.PlaneGeometry(.86,.86),new T.MeshBasicMaterial({map:texture,transparent:true}));artwork.position.set(x,2.08,-7.66);this.scene.add(artwork);
   this.text(p.title,1.18,.25,x,1.37,-7.66,'#394832','#f5ecd7');
  }));
  this.fixtureLayer.removeFromParent();this.fixtureLayer=this.createFixtures([]);this.root.add(this.fixtureLayer);
  this.batchStaticFurniture();this.batchContacts(this.root);
  this.invalidateShadows();
  onProgress('总部准备好了');
  }finally{draco.dispose();}
 }
 private furniture(name:string,x:number,y:number,z:number,height:number,ry=0,parent:T.Object3D=this.scene){
  const source=this.models.get(name);if(!source)throw new Error(`家具缺失：${name}`);
  const mesh=source.clone(true),b=new T.Box3().setFromObject(mesh),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
  if(![size.x,size.y,size.z].every(Number.isFinite)||size.y<=0)throw new Error(`模型尺寸无效：${name}`);
  const limit=budgets[name as keyof typeof budgets];
  if(!limit||size.x/size.y>limit.widthPerHeight||size.z/size.y>limit.depthPerHeight)throw new Error(`模型超出原家具包围盒：${name}。请缩减比例；布局变更须迁移碰撞。`);
  const s=height/size.y;mesh.scale.setScalar(s);mesh.position.set(-c.x*s,-b.min.y*s,-c.z*s);
  mesh.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  const group=new T.Group();group.add(mesh);group.position.set(x,y,z);group.rotation.y=ry;if(parent===this.root)group.userData.staticFurniture=true;parent.add(group);
  // Soft contact shading complements the sun without adding real-time lights.
  const w=size.x*s,d=size.z*s,cos=Math.abs(Math.cos(ry)),sin=Math.abs(Math.sin(ry));
  this.contact(w*cos+d*sin,d*cos+w*sin,x,y===0?.066:y===3.4?3.45:y+.004,z,parent);
  return group;
 }
 private batchStaticFurniture(){
  const roots=this.root.children.filter(o=>o.userData.staticFurniture);this.root.updateMatrixWorld(true);const byMaterial=new Map<T.Material,T.BufferGeometry[]>();
  for(const root of roots)root.traverse(o=>{if(!(o instanceof T.Mesh)||Array.isArray(o.material))return;let geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}const rows=byMaterial.get(o.material)||[];rows.push(geometry);byMaterial.set(o.material,rows);});
  for(const [material,geometries]of byMaterial){const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)throw Error('固定家具几何合批失败');const mesh=new T.Mesh(merged,material);mesh.name='batched-fixed-furniture';mesh.castShadow=true;mesh.receiveShadow=true;this.root.add(mesh);}
  roots.forEach(o=>o.removeFromParent());
 }
}
