import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Lobby exhibition for the fixed headquarters plan. This module is visual only:
// it never changes the authoritative layout, collision, doors or staff anchors.
// Coordinates are world metres: +X right, +Y up, +Z south entrance.
//
// Layout contract used here:
//   entrance (-5,0,5.8), reception (-5,0,1) footprint x[-6.8,-3.2] z[.55,1.45]
//   partition x=-2.1, thickness .16, z[-7.3,4.2] + [6.8,7.5], opening z[4.2,6.8]
//   project gallery inside the west window, outside the player collision radius
//   company sign behind reception at z=-.7, with 2.05m clear height
//
// The returned root is owned by the host, which decides visibility (including
// overview), interaction and disposal. No renderer, global event listener,
// animation loop or collision object is created here.

const FONT_STACK='"Microsoft YaHei","PingFang SC","Noto Sans SC","Source Han Sans SC",sans-serif';
const PROJECT_SLOTS=[5.5,3.2,.9,-1.4,-3.7] as const;
const PROJECT_X=-9.88;
const PARTITION_X=-2.1;
const COMPANY_X=-5.225;
const COMPANY_NAME='北京童医魔盒科技服务有限公司';
const COMPANY_SUBTITLE='把真实问题，做成真实作品';
const COMPANY_INTRO='聚焦医疗与 AI，把专业经验转化为可使用的工具与服务。';
const COMPANY_VISION='让人与自己信任的智能体协作，把想法做成真实成果。';

interface Palette {
 base:string;
 frame:string;
 frameDark:string;
 paper:string;
 ink:string;
 muted:string;
 accent:string;
 accentDeep:string;
 metal:string;
 shadow:string;
 light:string;
 signText:string;
 signMuted:string;
 signBacking:string;
}

const WARM:Palette={
 base:'#f1e8d7',
 frame:'#c9a97c',
 frameDark:'#94714e',
 paper:'#faf4e7',
 ink:'#2f4438',
 muted:'#66644f',
 accent:'#3d5c4a',
 accentDeep:'#2c4639',
 metal:'#b18a55',
 shadow:'#202820',
 light:'#d9bd87',
 signText:'#334b3d',
 signMuted:'#6f6a54',
 signBacking:'#8a6a49'
};

const CYBER:Palette={
 base:'#eaf2f4',
 frame:'#c9d8df',
 frameDark:'#5d7d8d',
 paper:'#f7fbfc',
 ink:'#17384a',
 muted:'#52707f',
 accent:'#2f718b',
 accentDeep:'#1b4a60',
 metal:'#7fa3b3',
 shadow:'#0d2433',
 light:'#68d8e0',
 signText:'#ecfafc',
 signMuted:'#a9d8e2',
 signBacking:'#1b4055'
};

function createCanvas(width:number,height:number){
 const canvas=document.createElement('canvas');
 canvas.width=width;
 canvas.height=height;
 const context=canvas.getContext('2d');
 if(!context)throw new Error('大厅展陈无法创建排版画布');
 context.textBaseline='top';
 context.textAlign='left';
 return {canvas,context};
}

function canvasTexture(width:number,height:number,draw:(context:CanvasRenderingContext2D,width:number,height:number)=>void):T.CanvasTexture{
 const {canvas,context}=createCanvas(width,height);
 draw(context,width,height);
 const texture=new T.CanvasTexture(canvas);
 texture.colorSpace=T.SRGBColorSpace;
 texture.anisotropy=8;
 texture.needsUpdate=true;
 return texture;
}

function wrapLines(context:CanvasRenderingContext2D,text:string,maxWidth:number):string[]{
 const lines:string[]=[];
 for(const paragraph of text.split('\n')){
  let line='';
  for(const character of Array.from(paragraph)){
   const candidate=line+character;
   if(line&&context.measureText(candidate).width>maxWidth){
    // Keep closing punctuation with the line it belongs to instead of
    // starting a new line with a comma or full stop.
    if(/^[，。；：、！？）》】’”]/.test(character)){line=candidate;continue;}
    lines.push(line);
    line=character;
   }else line=candidate;
  }
  if(line)lines.push(line);
 }
 return lines.length?lines:[''];
}

function fitText(
 context:CanvasRenderingContext2D,
 text:string,
 maxWidth:number,
 maxLines:number,
 startSize:number,
 minSize:number,
 weight:number
):{size:number;lines:string[]} {
 for(let size=startSize;size>=minSize;size-=2){
  context.font=`${weight} ${size}px ${FONT_STACK}`;
  const lines=wrapLines(context,text,maxWidth);
  if(lines.length<=maxLines)return {size,lines};
 }
 context.font=`${weight} ${minSize}px ${FONT_STACK}`;
 const lines=wrapLines(context,text,maxWidth).slice(0,maxLines);
 const lastIndex=lines.length-1;
 let last=lines[lastIndex]??'';
 while(last.length>1&&context.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);
 lines[lastIndex]=last+'…';
 return {size:minSize,lines};
}

function drawInlineRow(
 context:CanvasRenderingContext2D,
 palette:Palette,
 label:string,
 text:string,
 x:number,
 y:number,
 maxWidth:number,
 size:number,
 minSize:number
){
 context.font=`600 ${size}px ${FONT_STACK}`;
 const labelWidth=context.measureText(label).width;
 const gap=26;
 const body=fitText(context,text,maxWidth-labelWidth-gap,1,size,minSize,400);
 context.textAlign='left';
 context.textBaseline='top';
 context.fillStyle=palette.accent;
 context.font=`600 ${size}px ${FONT_STACK}`;
 context.fillText(label,x,y);
 context.fillStyle=palette.ink;
 context.font=`400 ${body.size}px ${FONT_STACK}`;
 context.fillText(body.lines[0]??'',x+labelWidth+gap,y);
}

function projectCaption(palette:Palette,index:number,title:string):T.CanvasTexture{
 return canvasTexture(1024,512,(context)=>{
  context.fillStyle=palette.paper;
  context.fillRect(0,0,1024,512);

  context.fillStyle=palette.accent;
  context.font=`700 104px ${FONT_STACK}`;
  context.textAlign='left';
  context.textBaseline='top';
  context.fillText(String(index+1).padStart(2,'0'),44,30);

  context.fillStyle=palette.muted;
  context.font=`500 30px ${FONT_STACK}`;
  context.fillText('项目',216,50);

  context.fillStyle=palette.metal;
  context.fillRect(190,44,2,120);

  const titleLayout=fitText(context,title,760,3,62,38,600);
  context.fillStyle=palette.ink;
  context.font=`600 ${titleLayout.size}px ${FONT_STACK}`;
  titleLayout.lines.forEach((line,lineIndex)=>{
   context.fillText(line,216,116+lineIndex*titleLayout.size*1.17);
  });

  context.fillStyle=palette.metal;
  context.fillRect(44,468,936,2);
  context.fillStyle=palette.accent;
  context.fillRect(44,466,72,4);
 });
}

function companyPrint(palette:Palette):T.CanvasTexture{
 return canvasTexture(2048,640,(context)=>{
  context.fillStyle=palette.paper;
  context.fillRect(0,0,2048,640);

  const name=fitText(context,COMPANY_NAME,1780,1,112,78,700);
  context.textAlign='center';
  context.textBaseline='top';
  context.fillStyle=palette.ink;
  context.font=`700 ${name.size}px ${FONT_STACK}`;
  context.fillText(name.lines[0]??COMPANY_NAME,1024,100);

  context.fillStyle=palette.metal;
  context.fillRect(1024-260,228,520,3);

  const subtitle=fitText(context,COMPANY_SUBTITLE,1500,1,52,36,500);
  context.fillStyle=palette.accent;
  context.font=`500 ${subtitle.size}px ${FONT_STACK}`;
  context.fillText(subtitle.lines[0]??COMPANY_SUBTITLE,1024,242);

  // A restrained rule bridges the brand line and the two explanation rows.
  context.fillStyle=palette.metal;
  context.fillRect(160,372,1728,2);

  context.fillStyle=palette.accentDeep;
  context.fillRect(120,330,6,230);
  drawInlineRow(context,palette,'关于我们',COMPANY_INTRO,160,470,1728,34,26);
  drawInlineRow(context,palette,'愿景',COMPANY_VISION,160,522,1728,34,26);
 });
}

function partitionSign(palette:Palette):T.CanvasTexture{
 return canvasTexture(1024,192,(context)=>{
  context.clearRect(0,0,1024,192);
  context.textAlign='left';
  context.textBaseline='top';
  context.fillStyle=palette.signText;
  context.font=`700 76px ${FONT_STACK}`;
  context.fillText('办公区',40,46);
  context.fillStyle=palette.metal;
  context.fillRect(294,42,2,108);
  context.fillStyle=palette.signMuted;
  context.font=`500 27px ${FONT_STACK}`;
  context.fillText('WORKSPACE',326,82);
 });
}

function grainTexture():T.CanvasTexture{
 const texture=canvasTexture(256,256,(context)=>{
  context.fillStyle='#ffffff';
  context.fillRect(0,0,256,256);
  // Six broad, low-contrast bands. Deliberately not a dense line field.
  for(let i=0;i<6;i++){
   const x=(i*47+19)%256;
   context.strokeStyle=i%2?'rgba(82,58,33,.055)':'rgba(255,249,235,.10)';
   context.lineWidth=7+(i%3)*5;
   context.beginPath();
   context.moveTo(x,-20);
   context.bezierCurveTo(x+12,70,x-10,170,x+6,276);
   context.stroke();
  }
 });
 texture.wrapS=texture.wrapT=T.RepeatWrapping;
 texture.repeat.set(2,2);
 texture.name='lobby-oak-grain';
 return texture;
}

function disposeObject(object:T.Object3D){
 const geometries=new Set<T.BufferGeometry>();
 const materials=new Set<T.Material>();
 const textures=new Set<T.Texture>();
 object.traverse(node=>{
  if(!(node instanceof T.Mesh))return;
  geometries.add(node.geometry);
  for(const material of [node.material].flat()){
   materials.add(material);
   for(const value of Object.values(material)){
    if(value instanceof T.Texture)textures.add(value);
   }
  }
 });
 geometries.forEach(geometry=>geometry.dispose());
 materials.forEach(material=>material.dispose());
 textures.forEach(texture=>texture.dispose());
}

export async function createLobbyExhibition(
 projects: Array<{title:string;image:string}>,
 variant: 'warm'|'cyber'='warm'
): Promise<{root:T.Group;targets:T.Object3D[];cameraOccluders:T.Object3D[]}> {
 if(projects.length>PROJECT_SLOTS.length)throw new Error(`大厅展陈最多支持${PROJECT_SLOTS.length}个项目`);
 projects.forEach((project,index)=>{
  if(!project||typeof project.title!=='string'||!project.title.trim())throw new Error(`第${index+1}个展陈项目缺少标题`);
  if(typeof project.image!=='string'||!project.image)throw new Error(`第${index+1}个展陈项目缺少图片地址`);
 });

 const palette=variant==='cyber'?CYBER:WARM;
 const loader=new T.TextureLoader();
 const settled=await Promise.allSettled(projects.map(project=>loader.loadAsync(project.image)));
 const failedIndex=settled.findIndex(result=>result.status==='rejected');
 if(failedIndex>=0){
  for(const result of settled)if(result.status==='fulfilled')result.value.dispose();
  const failed=settled[failedIndex];
  const reason=failed.status==='rejected'
   ?(failed.reason instanceof Error?failed.reason:new Error(String(failed.reason)))
   :new Error('图片加载失败');
  throw new Error(`展陈图片加载失败：${projects[failedIndex]?.title??'未知项目'}`,{cause:reason});
 }
 const images:T.Texture[]=[];
 for(const result of settled){
  if(result.status!=='fulfilled')throw new Error('展陈图片加载失败');
  const texture=result.value;
  texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=8;
  texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;
  texture.name=`project-image-${images.length}`;
  images.push(texture);
 }

 const root=new T.Group();
 root.name='lobby-exhibition';
 const targets:T.Object3D[]=[];
 const cameraOccluders:T.Object3D[]=[];

 const unitBox=new T.BoxGeometry(1,1,1);
 const unitPlane=new T.PlaneGeometry(1,1);
 const unitCylinder=new T.CylinderGeometry(1,1,1,12);
 const units=[unitBox,unitPlane,unitCylinder];
 const createdMaterials:T.Material[]=[];
 const grain=variant==='warm'?grainTexture():undefined;

 const standard=(color:string,roughness=.72,metalness=0,map?:T.Texture)=>{
  const material=new T.MeshStandardMaterial({
   color,roughness,metalness,
   ...(map?{map}:{})
  });
  material.name='lobby-standard-material';
  material.userData={
   baseColor:color,
   baseRoughness:roughness,
   baseMetalness:metalness,
   lobbyExhibit:true,
   lobbyTextured:!!map,
   lobbyPrint:false
  };
  createdMaterials.push(material);
  return material;
 };

 const lightMaterial=(color:string)=>{
  const material=new T.MeshBasicMaterial({color,toneMapped:false});
  material.name='lobby-light-material';
  // baseColor echoes the authored strip colour; a recolour pass that reads the
  // convention sees the amber/cyan value, never a neutral grey.
  material.userData={baseColor:color,lobbyExhibit:true,lobbyLight:true};
  createdMaterials.push(material);
  return material;
 };

 const printMaterial=(texture:T.Texture,name:string,transparent=false)=>{
  const material=new T.MeshBasicMaterial({map:texture,toneMapped:false,transparent,depthWrite:!transparent});
  material.name=name;
  // White base + BasicMaterial keeps printed colour out of the theme's
  // StandardMaterial recolour pass, so a texture can never be washed grey.
  material.userData={baseColor:'#ffffff',lobbyExhibit:true,lobbyTextured:true,lobbyPrint:true};
  createdMaterials.push(material);
  return material;
 };

 const pickMaterial=(name:string)=>{
  const material=new T.MeshBasicMaterial({
   transparent:true,
   opacity:0,
   colorWrite:false,
   depthWrite:false,
   side:T.DoubleSide,
   toneMapped:false
  });
  material.name=name;
  material.userData={baseColor:'#ffffff',lobbyExhibit:true,lobbyPick:true};
  createdMaterials.push(material);
  return material;
 };

 const materials={
  base:standard(palette.base,.82,0),
  frame:standard(palette.frame,variant==='cyber'?.38:.72,variant==='cyber'?.45:0,grain),
  frameDark:standard(palette.frameDark,.76,0),
  paper:standard(palette.paper,.9,0),
  metal:standard(palette.metal,.3,.62),
  shadow:standard(palette.shadow,.88,0),
  signBacking:standard(palette.signBacking,.72,0),
  light:lightMaterial(palette.light)
 };

 const box=(
  parent:T.Object3D,
  name:string,
  material:T.Material,
  width:number,
  height:number,
  depth:number,
  x:number,
  y:number,
  z:number
 )=>{
  const mesh=new T.Mesh(unitBox,material);
  mesh.name=name;
  mesh.position.set(x,y,z);
  mesh.scale.set(width,height,depth);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  parent.add(mesh);
  return mesh;
 };

 const plane=(
  parent:T.Object3D,
  name:string,
  material:T.Material,
  width:number,
  height:number,
  x:number,
  y:number,
  z:number,
  rotationY=0
 )=>{
  const mesh=new T.Mesh(unitPlane,material);
  mesh.name=name;
  mesh.position.set(x,y,z);
  mesh.scale.set(width,height,1);
  mesh.rotation.y=rotationY;
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  parent.add(mesh);
  return mesh;
 };

 const rod=(
  parent:T.Object3D,
  name:string,
  material:T.Material,
  radius:number,
  height:number,
  x:number,
  y:number,
  z:number
 )=>{
  const mesh=new T.Mesh(unitCylinder,material);
  mesh.name=name;
  mesh.position.set(x,y,z);
  mesh.scale.set(radius,height,radius);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  parent.add(mesh);
  return mesh;
 };

 const lattice=(
  parent:T.Object3D,
  name:string,
  z0:number,
  z1:number,
  slatWidth:number,
  gap:number
 )=>{
  const margin=.14;
  const height=2.05;
  const centerY=.89+height/2;
  const parts:T.BufferGeometry[]=[];
  for(let z=z0+margin+slatWidth/2;z+slatWidth/2<=z1-margin;z+=slatWidth+gap){
   const geometry=unitBox.clone();
   geometry.applyMatrix4(new T.Matrix4().compose(
    new T.Vector3(PARTITION_X,centerY,z),
    new T.Quaternion(),
    new T.Vector3(.09,height,slatWidth)
   ));
   parts.push(geometry);
  }
  if(parts.length===0)throw new Error('分区墙格栅没有可用的竖梃位置');
  const merged=mergeGeometries(parts,false);
  parts.forEach(geometry=>geometry.dispose());
  if(!merged)throw new Error('分区墙格栅合并失败');
  const mesh=new T.Mesh(merged,materials.frame);
  mesh.name=name;
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  parent.add(mesh);
  return mesh;
 };

 try{
  // ---- partition wall -----------------------------------------------------
  const partition=new T.Group();
  partition.name='partition-wall';
  partition.userData.layout='lobby-office-divider';
  root.add(partition);

  const segments=[[-7.3,4.2],[6.8,7.5]] as const;
  const cyber=variant==='cyber';
  for(const [z0,z1] of segments){
   const length=z1-z0;
   const centerZ=(z0+z1)/2;
   box(partition,`partition-toe-${z0}`,materials.shadow,.12,.07,length,PARTITION_X,.035,centerZ);
   box(partition,`partition-base-${z0}`,materials.base,.16,.78,length,PARTITION_X,.46,centerZ);
   box(partition,`partition-cap-${z0}`,materials.frame,.16,.04,length,PARTITION_X,.87,centerZ);
   box(partition,`partition-inlay-${z0}`,cyber?materials.light:materials.metal,.006,.018,length-.02,PARTITION_X-.083,.80,centerZ);
   lattice(partition,`partition-lattice-${z0}`,z0,z1,cyber?.035:.045,cyber?.33:.235);
   box(partition,`partition-rail-low-${z0}`,materials.frame,.12,.04,length,PARTITION_X,.91,centerZ);
   box(partition,`partition-rail-mid-${z0}`,materials.frame,.12,.05,length,PARTITION_X,1.88,centerZ);
   box(partition,`partition-rail-top-${z0}`,materials.frame,.16,.08,length,PARTITION_X,2.98,centerZ);
   box(partition,`partition-top-light-${z0}`,materials.light,.012,.012,length-.1,PARTITION_X-.084,2.935,centerZ);
  }

  // Posts sit inside the wall segments so the clear opening stays exactly
  // z=4.2..6.8; only thin metal reveals line the jamb faces.
  for(const side of [{post:4.15,face:4.205},{post:6.85,face:6.795}]){
   box(partition,`partition-jamb-${side.post}`,materials.frame,.16,2.17,.10,PARTITION_X,1.935,side.post);
   box(partition,`partition-jamb-cap-${side.post}`,materials.metal,.16,.04,.12,PARTITION_X,3.0,side.post);
   box(partition,`partition-jamb-reveal-${side.post}`,materials.metal,.03,2.02,.008,PARTITION_X,1.93,side.face);
  }

  // Door lintel: solid above 2.7m only; the 2.6m opening stays walkable.
  box(partition,'partition-lintel',materials.frame,.16,.22,2.6,PARTITION_X,2.91,5.5);
  box(partition,'partition-lintel-reveal',materials.shadow,.13,.04,2.56,PARTITION_X,2.75,5.5);
  box(partition,'partition-lintel-light',materials.light,.05,.012,2.5,PARTITION_X,2.715,5.5);

  const signTexture=partitionSign(palette);
  box(partition,'partition-sign-back',materials.signBacking,.018,.24,1.25,PARTITION_X-.084,2.91,5.5);
  plane(partition,'partition-sign-text',printMaterial(signTexture,'partition-sign-material',true),1.2,.225,PARTITION_X-.095,2.91,5.5,-Math.PI/2);
  box(partition,'partition-sign-underline',materials.metal,.004,.01,1.2,PARTITION_X-.096,2.785,5.5);

  partition.traverse(node=>{if(node instanceof T.Mesh)cameraOccluders.push(node);});

  // ---- west window project gallery ---------------------------------------
  const gallery=new T.Group();
  gallery.name='lobby-project-gallery';
  gallery.userData.layout='west-window-exhibition';
  root.add(gallery);

  const railStart=-4.65;
  const railEnd=6.35;
  const railLength=railEnd-railStart;
  const railCenter=(railStart+railEnd)/2;
  box(gallery,'gallery-rail',materials.metal,.07,.07,railLength,PROJECT_X,3.06,railCenter);
  for(const z of [6,0,-4]){
   box(gallery,`gallery-bracket-${z}`,materials.frameDark,10+PROJECT_X,.06,.08,(-10+PROJECT_X)/2,3.06,z);
   box(gallery,`gallery-wall-plate-${z}`,materials.metal,.04,.18,.18,-9.98,3.06,z);
  }

  for(let index=0;index<projects.length;index++){
   const project=projects[index];
   const z=PROJECT_SLOTS[index];
   const stand=new T.Group();
   stand.name=`project-stand-${index}`;
   stand.position.set(PROJECT_X,0,z);
   stand.userData.projectIndex=index;
   gallery.add(stand);

   box(stand,`project-back-${index}`,materials.frameDark,.07,1.64,1.46,-.055,1.9,0);
   box(stand,`project-face-${index}`,materials.paper,.014,1.52,1.34,-.012,1.9,0);
   box(stand,`project-frame-top-${index}`,materials.frame,.07,.06,1.5,.008,2.75,0);
   box(stand,`project-frame-bottom-${index}`,materials.frame,.07,.06,1.5,.008,1.05,0);
   box(stand,`project-frame-left-${index}`,materials.frame,.07,1.64,.06,.008,1.9,-.72);
   box(stand,`project-frame-right-${index}`,materials.frame,.07,1.64,.06,.008,1.9,.72);

   const liner=cyber?materials.light:materials.metal;
   box(stand,`project-liner-top-${index}`,liner,.012,.018,1.3,.014,2.66,0);
   box(stand,`project-liner-bottom-${index}`,liner,.012,.018,1.3,.014,1.14,0);
   box(stand,`project-liner-left-${index}`,liner,.012,1.5,.018,.014,1.9,-.66);
   box(stand,`project-liner-right-${index}`,liner,.012,1.5,.018,.014,1.9,.66);

   box(stand,`project-image-matte-${index}`,materials.paper,.006,.78,1.32,0,2.31,0);
   box(stand,`project-divider-${index}`,materials.metal,.01,.012,1.26,.008,1.915,0);

   const image=images[index];
   if(image){
    // Project sources are logos: contain the complete image without cropping.
    const source=image.image as HTMLImageElement;
    const width=source.naturalWidth||source.width;
    const height=source.naturalHeight||source.height;
    if(width<=0||height<=0)throw new Error(`项目图标尺寸无效：${project.title}`);
    // SVGs with only a viewBox need a concrete bitmap before WebGL upload.
    const bitmap=document.createElement('canvas'),bitmapScale=Math.min(512/width,512/height);
    bitmap.width=Math.max(1,Math.round(width*bitmapScale));bitmap.height=Math.max(1,Math.round(height*bitmapScale));
    const context=bitmap.getContext('2d');if(!context)throw new Error('无法绘制项目图标');
    context.drawImage(source,0,0,bitmap.width,bitmap.height);image.image=bitmap;image.needsUpdate=true;
    const imageScale=Math.min(1.12/width,.67/height);
    const imageMaterial=new T.MeshBasicMaterial({map:image,toneMapped:false,transparent:true});
    imageMaterial.name=`project-image-material-${index}`;
    imageMaterial.userData={baseColor:'#ffffff',lobbyExhibit:true,lobbyTextured:true,lobbyPrint:true};
    createdMaterials.push(imageMaterial);
    plane(stand,`project-image-${index}`,imageMaterial,width*imageScale,height*imageScale,.006,2.31,0,Math.PI/2);
   }

   const caption=projectCaption(palette,index,project.title.trim());
   caption.name=`project-caption-texture-${index}`;
   plane(stand,`project-caption-${index}`,printMaterial(caption,`project-caption-material-${index}`),1.26,.63,.006,1.575,0,Math.PI/2);

   rod(stand,`project-hanger-${index}-0`,materials.metal,.008,.28,-.012,2.92,-.55);
   rod(stand,`project-hanger-${index}-1`,materials.metal,.008,.28,-.012,2.92,.55);
   rod(stand,`project-ferrule-${index}-0`,materials.metal,.02,.018,-.012,2.787,-.55);
   rod(stand,`project-ferrule-${index}-1`,materials.metal,.02,.018,-.012,2.787,.55);

   const pick=plane(stand,`project-pick-${index}`,pickMaterial(`project-pick-material-${index}`),1.5,1.76,.06,1.9,0,Math.PI/2);
   pick.userData={lobbyExhibit:'project',projectIndex:index};
   targets.push(pick);
  }

  // ---- company sign behind reception -------------------------------------
  const company=new T.Group();
  company.name='lobby-company-sign';
  company.position.set(COMPANY_X,.25,-.7);
  company.userData.layout='suspended-company-statement';
  root.add(company);

  box(company,'company-backing',materials.signBacking,5.15,1.56,.04,0,2.6,-.06);
  box(company,'company-board',materials.paper,5.15,1.6,.10,0,2.6,0);
  box(company,'company-frame-top',materials.frame,5.15,.06,.06,0,3.37,.075);
  box(company,'company-frame-bottom',materials.frame,5.15,.06,.06,0,1.83,.075);
  box(company,'company-frame-left',materials.frame,.06,1.6,.06,-2.545,2.6,.075);
  box(company,'company-frame-right',materials.frame,.06,1.6,.06,2.545,2.6,.075);

  const companyTexture=companyPrint(palette);
  companyTexture.name='company-print-texture';
  plane(company,'company-print',printMaterial(companyTexture,'company-print-material'),5.0,1.5625,0,2.6,.055,0);

  const companyPick=plane(company,'company-pick',pickMaterial('company-pick-material'),5.05,1.55,0,2.6,.13,0);
  companyPick.userData={lobbyExhibit:'company'};
  targets.push(companyPick);

  // Suspension: short hangers to a crossbar, then slim cables to the ceiling.
  // The group lift keeps solids at or above y=2.05, so the reception path
  // remain visually open and no new collision is introduced.
  box(company,'company-crossbar',materials.frame,5.0,.06,.06,0,3.48,-.06);
  for(const x of [-1.9,1.9])rod(company,`company-hanger-${x}`,materials.metal,.008,.10,x,3.45,-.06);
  for(const x of [-2.325,2.325]){
   rod(company,`company-cable-${x}`,materials.metal,.007,3.17,x,5.065,-.06);
   rod(company,`company-ceiling-plate-${x}`,materials.frameDark,.05,.02,x,6.65,-.06);
  }
  for(const x of [-2.43,2.43]){
   for(const y of [1.94,3.26])box(company,`company-standoff-${x}-${y}`,materials.metal,.035,.035,.03,x,y,.11);
  }

  root.userData={lobbyExhibition:true,variant,projectCount:projects.length};
  return {root,targets,cameraOccluders};
 }catch(error){
  disposeObject(root);
  createdMaterials.forEach(material=>material.dispose());
  units.forEach(geometry=>geometry.dispose());
  images.forEach(texture=>texture.dispose());
  grain?.dispose();
  throw error;
 }
}
