import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {LEVEL_HEIGHT, STAIR} from './plan.js';
import {asset} from '../asset-base';
import oakTextureUrl from './textures/light-oak.jpg?inline';
import stoneTextureUrl from './textures/cream-stone.jpg?inline';
import fabricTextureUrl from './textures/forest-fabric.jpg?inline';
import {
  bookcaseOpenUrl,
  booksUrl,
  coffeeTableUrl,
  floorLampUrl,
  loungeChairUrl,
  loungeSofaUrl,
  plantSmallUrl,
  pottedPlantUrl,
} from './furniture-assets';

export interface Project {title:string;description:string;status:string;image:string}

const FONT='"Microsoft YaHei","PingFang SC",sans-serif';
const FLOOR_HEIGHT=LEVEL_HEIGHT;
const CEILING_HEIGHT=7.72;
const FURNITURE_ASSETS={
  bookcaseopen:bookcaseOpenUrl,
  books:booksUrl,
  tablecoffee:coffeeTableUrl,
  lamproundfloor:floorLampUrl,
  loungedesignchair:loungeChairUrl,
  loungedesignsofa:loungeSofaUrl,
  plantsmall1:plantSmallUrl,
  pottedplant:pottedPlantUrl,
  taskchair:asset('/furniture/warm/chairdesk.glb'),
  computerscreen:asset('/furniture/warm/computerscreen.glb'),
  officecabinet:asset('/furniture/warm/kitchencabinet.glb'),
  coffeemachine:asset('/furniture/warm/kitchencoffeemachine.glb'),
} as const;

type Vec3=[number,number,number];

export async function createHeadquarters(projects:Project[]){
  if(projects.length!==5)throw new Error('本样板按已授权的五个公开项目布展；项目数量变化需重新排布，不能静默丢弃');
  RectAreaLightUniformsLib.init();

  const root=new T.Group();
  root.name='Premium_Warm_Wood_Headquarters';
  const floors:T.Group[]=[];
  const workstationFallbacks:T.Group[]=[];
  const targets:T.Mesh[]=[];
  const businessScreens:T.CanvasTexture[]=[];
  let caseScreen:T.CanvasTexture|undefined,caseFingerprint='';
  let dashboardScreen:T.CanvasTexture|undefined,dashboardFingerprint='';
  let messageScreen:T.CanvasTexture|undefined,messageFingerprint='';
  const sectionLights:T.RectAreaLight[]=[];
  const occluders:T.Object3D[]=[];
  const officeWalls:T.Object3D[]=[];
  const officeDoor=new T.Group();
  officeDoor.name='Owner_Office_Door';

  const loadTexture=(url:string,rx:number,ry:number)=>{
    const value=new T.TextureLoader().load(url);
    value.wrapS=value.wrapT=T.RepeatWrapping;
    value.repeat.set(rx,ry);
    value.colorSpace=T.SRGBColorSpace;
    value.anisotropy=8;
    return value;
  };

  const oakMap=loadTexture(oakTextureUrl,2.4,2.4);
  const stoneMap=loadTexture(stoneTextureUrl,8,6);
  const fabricMap=loadTexture(fabricTextureUrl,2.2,1.2);

  const physical=(color:string,roughness:number,metalness=0,extra:T.MeshPhysicalMaterialParameters={})=>{
    // Satin joinery needs PBR, not a second clearcoat lobe on every surface.
    const {clearcoat,clearcoatRoughness,...standard}=extra;
    return new T.MeshStandardMaterial({color,roughness,metalness,...standard});
  };

  const materials={
    oak:physical('#8e6242',.33,0,{map:oakMap,bumpMap:oakMap,bumpScale:.055,clearcoat:.26,clearcoatRoughness:.29,envMapIntensity:1.1}),
    oakDark:physical('#503727',.37,0,{map:oakMap,bumpMap:oakMap,bumpScale:.045,clearcoat:.2,clearcoatRoughness:.33,envMapIntensity:.98}),
    oakLight:physical('#b77f50',.37,0,{map:oakMap,bumpMap:oakMap,bumpScale:.04,clearcoat:.18,clearcoatRoughness:.33,envMapIntensity:1.02}),
    stone:physical('#c9b9a5',.28,0,{map:stoneMap,bumpMap:stoneMap,bumpScale:.028,clearcoat:.36,clearcoatRoughness:.18,envMapIntensity:1.34}),
    floor:physical('#918270',.5,0,{map:stoneMap,bumpMap:stoneMap,bumpScale:.025,envMapIntensity:.8}),
    floorTint:physical('#aa9781',.28,0,{map:stoneMap,bumpMap:stoneMap,bumpScale:.035,clearcoat:.44,clearcoatRoughness:.17,envMapIntensity:1.4}),
    plaster:physical('#dbccb7',.76,0,{envMapIntensity:.54}),
    plasterWarm:physical('#bfa27a',.72,0,{envMapIntensity:.7}),
    charcoal:physical('#202522',.44,.42,{envMapIntensity:1.0}),
    black:physical('#0d1110',.38,.42,{envMapIntensity:1.25}),
    creamFabric:physical('#cfc5b6',.9,0,{map:fabricMap,envMapIntensity:.52}),
    ivoryFabric:physical('#e1d8ca',.9,0,{map:fabricMap,envMapIntensity:.52}),
    sageFabric:physical('#3f5044',.88,0,{map:fabricMap,envMapIntensity:.56}),
    terracotta:physical('#a96f53',.88,0,{map:fabricMap,envMapIntensity:.5}),
    leaf:physical('#2d6139',.68,0,{side:T.DoubleSide,envMapIntensity:.62}),
    leafLight:physical('#5b8a4d',.66,0,{side:T.DoubleSide,envMapIntensity:.64}),
    leafDeep:physical('#193d28',.72,0,{side:T.DoubleSide,envMapIntensity:.58}),
    brass:physical('#b99256',.34,.64,{envMapIntensity:1.16}),
    white:physical('#fffaf2',.36,0,{envMapIntensity:1}),
    rug:physical('#726a5e',.98,0,{envMapIntensity:.28}),
    screen:physical('#102838',.24,.22,{envMapIntensity:.9}),
    blueGlow:new T.MeshStandardMaterial({color:'#2d7cc2',emissive:'#1767a9',emissiveIntensity:1.8,roughness:.25,metalness:.18}),
    light:new T.MeshStandardMaterial({color:'#ffd79a',emissive:'#ff9d45',emissiveIntensity:5.8,toneMapped:false}),
    lightSoft:new T.MeshStandardMaterial({color:'#ffedcd',emissive:'#ffc66d',emissiveIntensity:4.2,toneMapped:false}),
    glass:physical('#bcd5d2',.12,0,{transparent:true,opacity:.12,depthWrite:false,side:T.DoubleSide,envMapIntensity:1.3}),
    glassDark:physical('#73908f',.16,0,{transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide,envMapIntensity:1.18}),
    water:physical('#8fb5b1',.12,0,{transparent:true,opacity:.72,envMapIntensity:1.8}),
  };

  function box(
    parent:T.Object3D,
    name:string,
    size:Vec3,
    position:Vec3,
    material:T.Material,
    radius=0,
  ){
    const geometry=radius
      ?new RoundedBoxGeometry(size[0],size[1],size[2],4,radius)
      :new T.BoxGeometry(size[0],size[1],size[2]);
    const mesh=new T.Mesh(geometry,material);
    mesh.name=name;
    mesh.position.fromArray(position);
    mesh.castShadow=material!==materials.glass&&material!==materials.glassDark;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(
    parent:T.Object3D,
    name:string,
    radiusTop:number,
    radiusBottom:number,
    height:number,
    position:Vec3,
    material:T.Material,
    segments=36,
  ){
    const mesh=new T.Mesh(new T.CylinderGeometry(radiusTop,radiusBottom,height,segments),material);
    mesh.name=name;
    mesh.position.fromArray(position);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }

  function instances(
    parent:T.Object3D,
    name:string,
    size:Vec3,
    positions:Vec3[],
    material:T.Material,
  ){
    const mesh=new T.InstancedMesh(new T.BoxGeometry(...size),material,positions.length);
    mesh.name=name;
    const matrix=new T.Matrix4();
    positions.forEach((position,index)=>{
      matrix.makeTranslation(position[0],position[1],position[2]);
      mesh.setMatrixAt(index,matrix);
    });
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }

  function line(
    parent:T.Object3D,
    name:string,
    from:Vec3,
    to:Vec3,
    radius:number,
    material:T.Material,
    segments=10,
  ){
    const start=new T.Vector3(...from);
    const end=new T.Vector3(...to);
    const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,start.distanceTo(end),segments),material);
    mesh.name=name;
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());
    mesh.castShadow=true;
    parent.add(mesh);
    return mesh;
  }

  function glassPanel(parent:T.Object3D,name:string,a:Vec3,b:Vec3,height:number){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.Float32BufferAttribute([
        a[0],a[1],a[2],
        b[0],b[1],b[2],
        b[0],b[1]+height,b[2],
        a[0],a[1]+height,a[2],
      ],3),
    );
    geometry.setIndex([0,1,2,0,2,3]);
    geometry.computeVertexNormals();
    const panel=new T.Mesh(geometry,materials.glass);
    panel.name=name;
    parent.add(panel);
    return panel;
  }

  function railRun(parent:T.Object3D,name:string,a:Vec3,b:Vec3){
    line(parent,`${name}_TopRail`,[a[0],a[1]+1.08,a[2]],[b[0],b[1]+1.08,b[2]],.028,materials.charcoal);
    line(parent,`${name}_BottomRail`,[a[0],a[1]+.13,a[2]],[b[0],b[1]+.13,b[2]],.014,materials.charcoal);
    glassPanel(parent,`${name}_Glass`,a,b,.9);
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    const count=Math.max(1,Math.ceil(length/1.65));
    for(let i=0;i<=count;i++){
      const t=i/count;
      const x=T.MathUtils.lerp(a[0],b[0],t);
      const y=T.MathUtils.lerp(a[1],b[1],t);
      const z=T.MathUtils.lerp(a[2],b[2],t);
      box(parent,`${name}_Post`,[.035,.95,.035],[x,y+.56,z],materials.charcoal,.007);
    }
  }

  function slatWallX(
    parent:T.Object3D,
    name:string,
    centerX:number,
    y:number,
    z:number,
    width:number,
    height:number,
    material=materials.oak,
  ){
    const positions:Vec3[]=[];
    for(let x=centerX-width/2;x<=centerX+width/2+.001;x+=.105)positions.push([x,y,z]);
    return instances(parent,name,[.055,height,.068],positions,material);
  }

  function slatWallZ(
    parent:T.Object3D,
    name:string,
    x:number,
    y:number,
    centerZ:number,
    depth:number,
    height:number,
    material=materials.oak,
  ){
    const positions:Vec3[]=[];
    for(let z=centerZ-depth/2;z<=centerZ+depth/2+.001;z+=.105)positions.push([x,y,z]);
    return instances(parent,name,[.068,height,.055],positions,material);
  }

  function canvasTexture(
    width:number,
    height:number,
    paint:(context:CanvasRenderingContext2D)=>void,
  ){
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext('2d');
    if(!context)throw new Error('无法创建场景文字纹理');
    paint(context);
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;
    texture.anisotropy=8;
    return texture;
  }

  function signPlane(
    parent:T.Object3D,
    name:string,
    title:string,
    subtitle:string,
    size:[number,number],
    position:Vec3,
    rotationY=0,
    palette:'ivory'|'dark'='ivory',
  ){
    const canvasHeight=Math.round(1200*size[1]/size[0]);
    const texture=canvasTexture(1200,canvasHeight,(c)=>{
      c.fillStyle=palette==='ivory'?'#f7f1e5':'#17231d';
      c.fillRect(0,0,1200,canvasHeight);
      c.fillStyle=palette==='ivory'?'#4e715e':'#d6b47c';
      c.fillRect(72,Math.max(20,canvasHeight*.11),74,Math.max(4,canvasHeight*.035));
      c.fillStyle=palette==='ivory'?'#1f3027':'#ffffff';
      const preferredTitleSize=Math.max(30,Math.min(82,canvasHeight*.3));
      c.font=`700 ${preferredTitleSize}px ${FONT}`;
      const titleSize=Math.min(preferredTitleSize,preferredTitleSize*Math.min(1,1000/Math.max(1,c.measureText(title).width)));
      c.font=`700 ${titleSize}px ${FONT}`;
      c.fillText(title,72,canvasHeight*.53);
      c.fillStyle=palette==='ivory'?'#667066':'#c4d1c8';
      const subtitleSize=Math.max(18,Math.min(42,canvasHeight*.115));
      c.font=`${subtitleSize}px ${FONT}`;
      const maxWidth=1040;
      let line='';
      let y=canvasHeight*.82;
      for(const char of Array.from(subtitle)){
        if(c.measureText(line+char).width>maxWidth){
          c.fillText(line,72,y);
          line='';
          y+=subtitleSize*1.28;
        }
        line+=char;
      }
      c.fillText(line,72,y);
    });
    const mesh=new T.Mesh(
      new T.PlaneGeometry(size[0],size[1]),
      new T.MeshBasicMaterial({map:texture,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
    );
    mesh.name=name;
    mesh.position.fromArray(position);
    mesh.rotation.y=rotationY;
    parent.add(mesh);
    return mesh;
  }

  function verticalBrandSign(
    parent:T.Object3D,
    name:string,
    lines:string[],
    size:[number,number],
    position:Vec3,
    rotationY=0,
  ){
    const texture=canvasTexture(640,Math.round(640*size[1]/size[0]),(c)=>{
      const gradient=c.createLinearGradient(0,0,0,640*size[1]/size[0]);
      gradient.addColorStop(0,'#1a352a');
      gradient.addColorStop(1,'#0d231a');
      c.fillStyle=gradient;
      c.fillRect(0,0,640,640*size[1]/size[0]);
      c.strokeStyle='#c7a46b';
      c.lineWidth=6;
      c.strokeRect(28,28,584,640*size[1]/size[0]-56);
      c.textAlign='center';
      c.fillStyle='#f4ead7';
      c.font=`700 ${Math.min(104,470/lines.length)}px ${FONT}`;
      lines.forEach((line,index)=>{
        c.fillText(line,320,170+index*Math.min(132,510/lines.length));
      });
      c.fillStyle='#70bfa9';
      c.beginPath();
      c.arc(320,640*size[1]/size[0]-92,18,0,Math.PI*2);
      c.fill();
    });
    const mesh=new T.Mesh(new T.PlaneGeometry(size[0],size[1]),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
    mesh.name=name;
    mesh.position.fromArray(position);
    mesh.rotation.y=rotationY;
    parent.add(mesh);
    return mesh;
  }

  function projectScreen(
    parent:T.Object3D,
    name:string,
    project:Project,
    projectIndex:number,
    size:[number,number],
    position:Vec3,
    rotationY=0,
  ){
    const texture=canvasTexture(1400,Math.round(1400*size[1]/size[0]),(c)=>{
      const gradient=c.createLinearGradient(0,0,1400,900);
      gradient.addColorStop(0,'#061a26');
      gradient.addColorStop(.52,'#174b67');
      gradient.addColorStop(1,'#0f251d');
      c.fillStyle=gradient;
      c.fillRect(0,0,1400,1400*size[1]/size[0]);
      c.globalAlpha=.25;
      for(let i=0;i<8;i++){
        c.strokeStyle='#b9ebff';
        c.lineWidth=i%2?1:3;
        c.beginPath();
        c.arc(1090,490,80+i*35,.2,5.1);
        c.stroke();
      }
      c.globalAlpha=1;
      c.fillStyle='#8ed7ff';
      c.font=`500 27px ${FONT}`;
      c.fillText(`PROJECT / 0${projectIndex+1}`,72,72);
      c.fillStyle='#ffffff';
      c.font=`700 ${Math.max(62,Math.min(112,size[0]*33))}px ${FONT}`;
      c.fillText(project.title,72,330);
      c.fillStyle='#d7e4e6';
      c.font=`${Math.max(28,Math.min(44,size[0]*14))}px ${FONT}`;
      let line='';
      let y=405;
      for(const char of Array.from(project.description)){
        if(c.measureText(line+char).width>640){
          c.fillText(line,72,y);
          line='';
          y+=52;
        }
        line+=char;
      }
      c.fillText(line,72,y);
      // Real project image on the right column; text above never overlaps it.
      const loadImage=(src:string,onDone:(img:HTMLImageElement)=>void)=>{const img=new Image();img.crossOrigin='anonymous';img.src=src;img.decode().then(()=>{if(img.naturalWidth>0)onDone(img);}).catch(()=>{});};
      loadImage(project.image,img=>{
        const px=800,py=110,pw=530,ph=530,r=26;
        c.save();c.beginPath();c.roundRect(px,py,pw,ph,r);c.clip();
        const scale=Math.max(pw/img.naturalWidth,ph/img.naturalHeight);
        const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
        c.drawImage(img,px+(pw-dw)/2,py+(ph-dh)/2,dw,dh);
        c.restore();
        c.strokeStyle='#8ed7ff';c.lineWidth=3;c.beginPath();c.roundRect(px,py,pw,ph,r);c.stroke();
        texture.needsUpdate=true;
      });
      c.fillStyle='#d0b988';
      c.fillRect(72,760,86,4);
      c.fillStyle='#f3f0e7';
      c.font=`31px ${FONT}`;
      c.fillText(project.status,72,815);
      c.fillStyle='#a8e4ff';
      c.font=`25px ${FONT}`;
      c.fillText('点击展屏 · 查看公开项目',72,1500*size[1]/size[0]-54);
    });
    const mesh=new T.Mesh(
      new T.PlaneGeometry(size[0],size[1]),
      new T.MeshBasicMaterial({map:texture,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),
    );
    mesh.name=name;
    mesh.position.fromArray(position);
    mesh.rotation.y=rotationY;
    mesh.userData.projectIndex=projectIndex;
    mesh.userData.lobbyExhibit='project';
    parent.add(mesh);
    targets.push(mesh);
    return mesh;
  }

  function monitorScreen(
    parent:T.Object3D,
    name:string,
    position:Vec3,
    rotationY=0,
    size:[number,number]=[.78,.43],
  ){
    const wide=size[0]/size[1]>3;
    const texture=canvasTexture(1000,wide?200:620,(c)=>{
      c.fillStyle='#0d1b20';
      c.fillRect(0,0,1000,wide?200:620);
      c.fillStyle='#234d4d';
      c.fillRect(36,wide?12:36,928,wide?34:64);
      c.fillStyle='#a6ddd1';
      c.font=`500 ${wide?22:26}px ${FONT}`;
      c.fillText('童医魔盒 · 公开经营数据',60,wide?37:78);
      c.font=`${wide?28:32}px ${FONT}`;
      c.fillText('等待服务端数据',60,wide?105:220);
      c.font=`${wide?18:26}px ${FONT}`;
      c.fillText('点击终端 · 查看本人项目与待审事项',60,wide?180:480);
    });
    const screen=new T.Mesh(
      new T.PlaneGeometry(size[0],size[1]),
      new T.MeshBasicMaterial({map:texture,toneMapped:false}),
    );
    screen.name=name;
    screen.position.fromArray(position);
    screen.rotation.y=rotationY;
    screen.userData.lobbyExhibit=name==='Public_Business_Terminal'?'cases':'business';
    targets.push(screen);
    if(name==='Public_Business_Terminal')caseScreen=texture;else businessScreens.push(texture);
    parent.add(screen);
    return screen;
  }

  function areaLight(
    parent:T.Object3D,
    name:string,
    color:string,
    intensity:number,
    width:number,
    height:number,
    position:Vec3,
    target:Vec3,
  ){
    const light=new T.RectAreaLight(color,intensity,width,height);
    light.name=name;
    light.position.fromArray(position);
    light.lookAt(new T.Vector3(...target));
    parent.add(light);
    sectionLights.push(light);
    return light;
  }

  function windowBackdrop(parent:T.Object3D,name:string,size:[number,number],position:Vec3){
    const texture=canvasTexture(1600,760,(c)=>{
      const sky=c.createLinearGradient(0,0,0,760);
      sky.addColorStop(0,'#a9d5e7');
      sky.addColorStop(.5,'#dce9e3');
      sky.addColorStop(1,'#8da681');
      c.fillStyle=sky;
      c.fillRect(0,0,1600,760);
      c.filter='blur(24px)';
      const canopy=['#668858','#8aa66c','#496b4c','#b2c18a'];
      canopy.forEach((color,index)=>{
        c.fillStyle=color;
        c.globalAlpha=.48+index*.09;
        c.beginPath();
        c.arc(190+index*360,420+(index%2)*70,180+index*34,0,Math.PI*2);
        c.fill();
      });
      c.filter='none';
      c.globalAlpha=1;
      c.fillStyle='#f7e3b5';
      c.beginPath();
      c.arc(1310,155,72,0,Math.PI*2);
      c.fill();
    });
    const mesh=new T.Mesh(
      new T.PlaneGeometry(size[0],size[1]),
      new T.MeshBasicMaterial({map:texture,toneMapped:false}),
    );
    mesh.name=name;
    mesh.position.fromArray(position);
    parent.add(mesh);
    return mesh;
  }

  function plant(parent:T.Object3D,x:number,y:number,z:number,scale=1,variant=0){
    const plantGroup=new T.Group();
    plantGroup.name='Layered_Indoor_Plant';
    plantGroup.position.set(x,y,z);
    plantGroup.scale.setScalar(scale);
    parent.add(plantGroup);
    box(plantGroup,'Stone_Planter',[.86,.72,.86],[0,.36,0],materials.stone,.08);
    box(plantGroup,'Planter_Inner_Shadow',[.68,.025,.68],[0,.73,0],materials.charcoal);
    box(plantGroup,'Planter_Light_Reveal',[.79,.018,.79],[0,.085,0],materials.lightSoft,.005);
    const stones:Vec3[]=[];
    for(let i=0;i<12;i++)stones.push([Math.cos(i*2.1)*.25,.755,Math.sin(i*2.1)*.25]);
    instances(plantGroup,'Pebbles',[.08,.055,.06],stones,materials.floorTint);
    const branchGeometry=new T.CylinderGeometry(.009,.015,1,6);
    const branches=new T.InstancedMesh(branchGeometry,materials.leafDeep,20);
    branches.name='Instanced_Organic_Stems';
    branches.castShadow=true;
    plantGroup.add(branches);

    // A broad, gently folded leaf reads as an indoor plant at game distance;
    // the prior needle-like strips read as a procedural placeholder.
    const leafPoints:number[]=[];
    const leafUvs:number[]=[];
    const leafIndices:number[]=[];
    const leafSegments=8;
    for(let j=0;j<=leafSegments;j++){
      const t=j/leafSegments;
      const width=Math.sin(t*Math.PI)*(.185-.055*t);
      const fold=Math.sin(t*Math.PI)*.032;
      leafPoints.push(-width,t,0,0,t,fold,width,t,0);
      leafUvs.push(0,t,.5,t,1,t);
      if(j<leafSegments){
        const k=j*3;
        leafIndices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);
      }
    }
    const leafGeometry=new T.BufferGeometry();
    leafGeometry.setAttribute('position',new T.Float32BufferAttribute(leafPoints,3));
    leafGeometry.setAttribute('uv',new T.Float32BufferAttribute(leafUvs,2));
    leafGeometry.setIndex(leafIndices);
    leafGeometry.computeVertexNormals();
    const leafBuckets:T.Matrix4[][]=[[],[],[]];
    const stemMatrix=new T.Matrix4();
    const yAxis=new T.Vector3(0,1,0);
    const leafScale=new T.Vector3();
    for(let i=0;i<20;i++){
      const angle=i*2.399+variant*.37;
      const crown=.9+(i%5)*.055;
      const reach=.2+(i%4)*.075;
      const start=new T.Vector3(Math.cos(angle)*.035,crown,Math.sin(angle)*.035);
      const direction=new T.Vector3(
        Math.cos(angle)*reach,
        .82+(i%3)*.12,
        Math.sin(angle)*reach,
      ).normalize();
      const length=.78+(i%5)*.105;
      const quaternion=new T.Quaternion().setFromUnitVectors(yAxis,direction);
      const mid=start.clone().addScaledVector(direction,length*.5);
      stemMatrix.compose(mid,quaternion,new T.Vector3(1,length,1));
      branches.setMatrixAt(i,stemMatrix);

      const leafMatrix=new T.Matrix4();
      leafScale.set(.92+(i%3)*.17,.98+(i%4)*.12,1);
      leafMatrix.compose(start,quaternion,leafScale);
      leafBuckets[i%3].push(leafMatrix);
    }
    branches.instanceMatrix.needsUpdate=true;
    leafBuckets.forEach((matrices,index)=>{
      const leaves=new T.InstancedMesh(
        leafGeometry,
        index===0?materials.leafLight:index===1?materials.leaf:materials.leafDeep,
        matrices.length,
      );
      leaves.name='Instanced_Broad_Leaves';
      matrices.forEach((matrix,leafIndex)=>leaves.setMatrixAt(leafIndex,matrix));
      leaves.instanceMatrix.needsUpdate=true;
      leaves.castShadow=true;
      leaves.receiveShadow=true;
      plantGroup.add(leaves);
    });
  }

  function planterBench(parent:T.Object3D,x:number,y:number,z:number,w:number,d=1.05){
    box(parent,'Stone_Planter_Bench',[w,.58,d],[x,y+.29,z],materials.stone,.06);
    box(parent,'Planter_Bench_Waterline',[w-.08,.045,d-.08],[x,y+.6,z],materials.water);
    const count=Math.max(3,Math.floor(w/1.1));
    for(let i=0;i<count;i++)plant(parent,x-w/2+.55+i*(w-.9)/(count-1),y+.52,z,.82,i%3);
  }

  function bookcase(parent:T.Object3D,x:number,y:number,z:number,width:number,height:number,rotationY=0){
    const group=new T.Group();
    group.name='Open_Oak_Bookcase';
    group.position.set(x,y,z);
    group.rotation.y=rotationY;
    parent.add(group);
    box(group,'Bookcase_Back',[width,height,.12],[0,height/2,0],materials.oakDark,.025);
    for(const side of [-1,1])box(group,'Bookcase_Side',[.11,height,.42],[side*width/2,height/2,.24],materials.oak,.025);
    for(let row=0;row<5;row++)box(group,'Bookcase_Shelf',[width,.075,.43],[0,.42+row*((height-.5)/4),.25],materials.oak,.018);
    for(let row=0;row<4;row++){
      for(let i=0;i<7;i++){
        const bookHeight=.25+(row+i)%3*.06;
        const color=row%2===0?materials.ivoryFabric:materials.sageFabric;
        box(group,'Book',[.055+(i%2)*.015,bookHeight,.2],[-width/2+.28+i*.13,.46+row*((height-.5)/4)+bookHeight/2,.38],color,.006);
      }
    }
  }

  function loungeChair(parent:T.Object3D,x:number,y:number,z:number,rotationY:number,accent:T.Material){
    const group=new T.Group();
    group.name='Lobby_Lounge_Chair';
    group.position.set(x,y,z);
    group.rotation.y=rotationY;
    parent.add(group);
    box(group,'Chair_Oak_Base',[1.45,.34,1.32],[0,.4,0],materials.oakDark,.09);
    box(group,'Chair_Seat',[1.28,.22,1.15],[0,.59,0],materials.ivoryFabric,.12);
    box(group,'Chair_Back',[1.28,.72,.24],[0,1.0,-.48],materials.ivoryFabric,.12);
    box(group,'Chair_Accent_Pillow',[.5,.48,.12],[.24,.96,-.34],accent,.09);
    for(const dx of [-.53,.53])for(const dz of [-.43,.43]){
      line(group,'Chair_Brass_Leg',[dx,.25,dz],[dx,.03,dz],.025,materials.brass);
    }
  }

  function officeChair(parent:T.Object3D,x:number,y:number,z:number,rotationY=0){
    const group=new T.Group();
    group.name='Task_Chair';
    group.position.set(x,y,z);
    group.rotation.y=rotationY;
    parent.add(group);
    box(group,'Task_Chair_Seat',[.72,.14,.66],[0,.5,0],materials.sageFabric,.06);
    box(group,'Task_Chair_Back',[.68,.76,.12],[0,.91,-.3],materials.charcoal,.05);
    line(group,'Task_Chair_Stem',[0,.12,0],[0,.38,0],.035,materials.charcoal);
    for(const angle of [0,Math.PI*.67,Math.PI*1.34]){
      line(
        group,
        'Task_Chair_Foot',
        [Math.cos(angle)*.03,.1,Math.sin(angle)*.03],
        [Math.cos(angle)*.33,.035,Math.sin(angle)*.33],
        .025,
        materials.charcoal,
      );
    }
  }

  function upperAtriumGlazing(parent:T.Object3D,y:number,x:number){
    box(parent,'Upper_Office_Glass_Front',[.03,2.18,15.0],[x,y+2.1,4.15],materials.glassDark);
    box(parent,'Upper_Office_Bottom_Rail',[.08,.12,15.05],[x,y+1.02,4.15],materials.charcoal,.012);
    box(parent,'Upper_Office_Head_Rail',[.08,.13,15.05],[x,y+3.19,4.15],materials.charcoal,.012);
    for(let z=-3.3;z<=11.6;z+=2.4){
      box(parent,'Upper_Office_Black_Mullion',[.075,2.22,.065],[x,y+2.1,z],materials.charcoal,.009);
    }
    box(parent,'Upper_Office_Warm_Cove',[.055,.025,14.7],[x,y+3.12,4.15],materials.lightSoft,.004);
  }

  function upperBridgeGlazing(parent:T.Object3D,y:number){
    box(parent,'Upper_Bridge_Glass_Front',[7.0,2.18,.03],[0,y+2.1,-7.38],materials.glassDark);
    box(parent,'Upper_Bridge_Bottom_Rail',[7.05,.12,.08],[0,y+1.02,-7.38],materials.charcoal,.012);
    box(parent,'Upper_Bridge_Head_Rail',[7.05,.13,.08],[0,y+3.19,-7.38],materials.charcoal,.012);
    for(const x of [-3.45,-1.15,1.15,3.45]){
      box(parent,'Upper_Bridge_Black_Mullion',[.065,2.22,.075],[x,y+2.1,-7.38],materials.charcoal,.009);
    }
    box(parent,'Upper_Bridge_Warm_Cove',[6.8,.025,.055],[0,y+3.12,-7.38],materials.lightSoft,.004);
  }

  type FurnitureName=keyof typeof FURNITURE_ASSETS;
  const furnitureSources=new Map<FurnitureName,T.Group>();
  const furnitureFailures:string[]=[];
  const furnitureLoader=new GLTFLoader();
  const furnitureJobs=await Promise.allSettled(
    (Object.entries(FURNITURE_ASSETS) as [FurnitureName,string][]).map(async([name,url])=>{
      try{
        const gltf=await furnitureLoader.loadAsync(url);
        furnitureSources.set(name,gltf.scene);
      }catch(error){
        furnitureFailures.push(`${name}: ${(error as Error).message}`);
      }
    }),
  );
  for(const [index,job] of furnitureJobs.entries()){
    if(job.status==='rejected')furnitureFailures.push(`${Object.keys(FURNITURE_ASSETS)[index]}: ${(job.reason as Error).message}`);
  }

  const contactMaterial=new T.MeshBasicMaterial({
    color:'#171b18',
    transparent:true,
    opacity:.12,
    depthWrite:false,
    toneMapped:false,
  });

  function furniture(
    parent:T.Object3D,
    name:FurnitureName,
    x:number,
    y:number,
    z:number,
    height:number,
    rotationY=0,
  ){
    const source=furnitureSources.get(name);
    if(!source)return null;
    const model=source.clone(true);
    const bounds=new T.Box3().setFromObject(model);
    const size=bounds.getSize(new T.Vector3());
    const center=bounds.getCenter(new T.Vector3());
    if(![size.x,size.y,size.z].every(Number.isFinite)||size.y<=0){
      furnitureFailures.push(`${name}: 模型包围盒无效`);
      return null;
    }
    const scale=height/size.y;
    model.scale.setScalar(scale);
    model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    model.traverse((object)=>{
      if(!(object instanceof T.Mesh))return;
      object.castShadow=true;
      object.receiveShadow=true;
      for(const material of [object.material].flat()){
        if(material instanceof T.MeshStandardMaterial){
          material.envMapIntensity=Math.min(material.envMapIntensity,.9);
          material.needsUpdate=true;
        }
      }
    });
    const group=new T.Group();
    group.name=`Asset_${name}`;
    group.position.set(x,y,z);
    group.rotation.y=rotationY;
    group.add(model);
    parent.add(group);

    const width=size.x*scale,depth=size.z*scale;
    const contact=new T.Mesh(new T.CircleGeometry(1,36),contactMaterial);
    contact.name=`${name}_Contact_Shadow`;
    contact.rotation.x=-Math.PI/2;
    contact.position.set(x,y+.012,z);
    contact.scale.set(width*.58,depth*.58,1);
    contact.renderOrder=1;
    parent.add(contact);
    return group;
  }

  function sofa(parent:T.Object3D,x:number,y:number,z:number,rotationY=0){
    const group=new T.Group();
    group.name='Hotel_Grade_Lobby_Sofa';
    group.position.set(x,y,z);
    group.rotation.y=rotationY;
    parent.add(group);
    box(group,'Sofa_Oak_Shell',[4.6,.45,1.55],[0,.38,0],materials.oakDark,.15);
    box(group,'Sofa_Seat',[4.2,.28,1.3],[0,.63,.05],materials.ivoryFabric,.14);
    box(group,'Sofa_Back',[4.15,.86,.25],[0,1.03,-.55],materials.creamFabric,.13);
    box(group,'Sofa_Arm_Left',[.25,.7,1.3],[-2.17,.82,.02],materials.creamFabric,.11);
    box(group,'Sofa_Arm_Right',[.25,.7,1.3],[2.17,.82,.02],materials.creamFabric,.11);
    for(const xOffset of [-1.18,1.18]){
      box(group,'Sofa_Sage_Cushion',[.85,.72,.19],[xOffset,.96,-.37],materials.sageFabric,.11);
    }
    box(group,'Sofa_Terracotta_Pillow',[.5,.5,.16],[.12,.94,-.31],materials.terracotta,.1);
    for(const dx of [-1.9,1.9])for(const dz of [-.52,.52]){
      line(group,'Sofa_Brass_Leg',[dx,.25,dz],[dx,.04,dz],.028,materials.brass);
    }
  }

  function meetingRoom(parent:T.Object3D,y:number){
    const group=new T.Group();
    group.name='Glass_Meeting_Room';
    parent.add(group);
    const x=10.1,z=-6.7,w=6.2,d=6.4;
    box(group,'Meeting_Room_Back',[w,3.15,.16],[x,y+1.575,z-d/2],materials.plaster,.02);
    for(const sx of [-1,1]){
      box(group,'Meeting_Glass_Side',[.035,3.05,d],[x+sx*w/2,y+1.53,z],materials.glassDark);
      for(let dz=-d/2;dz<=d/2+.01;dz+=d/3){
        box(group,'Meeting_Black_Mullion',[.07,3.15,.07],[x+sx*w/2,y+1.58,z+dz],materials.charcoal,.01);
      }
    }
    for(const side of [-1,1]){
      box(group,'Meeting_Glass_Front_Panel',[2.02,3.05,.035],[x+side*2.08,y+1.53,z+d/2],materials.glassDark);
      box(group,'Meeting_Front_Outer_Mullion',[.07,3.15,.07],[x+side*(w/2),y+1.58,z+d/2],materials.charcoal,.01);
      box(group,'Meeting_Front_Door_Mullion',[.07,3.15,.07],[x+side*1.02,y+1.58,z+d/2],materials.charcoal,.01);
    }
    box(group,'Meeting_Lintel',[w,.16,.16],[x,y+3.16,z+d/2],materials.charcoal,.02);
    box(group,'Meeting_Rear_Screen_Frame',[4.2,1.65,.08],[x,y+2.15,z-d/2+.1],materials.charcoal,.03);
    box(group,'Meeting_Rear_High_Window',[3.92,1.42,.045],[x,y+2.15,z-d/2+.16],materials.blueGlow,.01);
    box(group,'Meeting_Oak_Wall_Base',[w-.3,1.08,.1],[x,y+.58,z-d/2+.18],materials.oakDark,.025);
    for(const dx of [-2.55,-1.7,-.85,0,.85,1.7,2.55]){
      box(group,'Meeting_Acoustic_Rib',[.055,2.9,.045],[x+dx,y+1.55,z-d/2+.25],materials.oak,.009);
    }
    cylinder(group,'Meeting_Table',1.65,1.65,.12,[x,y+.8,z-.35],materials.oak,64);
    cylinder(group,'Meeting_Table_Pedestal',.48,.66,.72,[x,y+.4,z-.35],materials.charcoal);
    for(let i=0;i<8;i++){
      const angle=i/8*Math.PI*2;
      loungeChair(
        group,
        x+Math.cos(angle)*2.15,
        y,
        z-.35+Math.sin(angle)*2.15,
        -angle+Math.PI/2,
        i%3===0?materials.sageFabric:materials.creamFabric,
      );
    }
    box(group,'Meeting_Table_Inlay',[2.1,.018,.76],[x,y+.87,z-.35],materials.charcoal,.03);
    cylinder(group,'Meeting_Centerpiece',.18,.18,.6,[x,y+.96,z-.35],materials.brass,20);
    signPlane(group,'Meeting_Room_Sign','协作会议室','预约后进行语音、文件与会议记录协作',[2.9,.64],[x,y+3.34,z+d/2+.1]);
  }

  const foundation=new T.Group();
  foundation.name='Foundation_And_Floor_Finish';
  root.add(foundation);
  box(foundation,'Floating_Stone_Plinth',[31.4,.42,25.4],[0,-.46,0],materials.stone,.16);
  box(foundation,'Ground_Slab',[30,.18,24],[0,-.09,0],materials.floorTint);
  box(foundation,'Entrance_Runner',[6.75,.012,15.2],[0,.008,4.2],materials.floor);
  box(foundation,'Entrance_Runner_Shadow_Left',[.025,.01,15.2],[-3.4,.014,4.2],materials.charcoal);
  box(foundation,'Entrance_Runner_Shadow_Right',[.025,.01,15.2],[3.4,.014,4.2],materials.charcoal);
  const groutMaterial=new T.MeshStandardMaterial({color:'#d6cec2',roughness:.92});
  const jointsX:Vec3[]=[];
  for(let x=-14;x<=14;x+=2)jointsX.push([x,.01,0]);
  instances(foundation,'Floor_Joints_Long',[.007,.006,24],jointsX,groutMaterial);
  const jointsZ:Vec3[]=[];
  for(let z=-11;z<=11;z+=2)jointsZ.push([0,.01,z]);
  instances(foundation,'Floor_Joints_Cross',[30,.006,.007],jointsZ,groutMaterial);

  areaLight(root,'Lobby_Softbox','#ffe1bd',7.8,12.5,6.4,[0,3.58,6.6],[0,.9,2.2]);
  areaLight(root,'Reception_Softbox','#ffd8ae',5.3,6.2,4.4,[-5.7,3.55,7.2],[-5.8,1.1,6.6]);
  areaLight(root,'Gallery_Softbox','#ffe6c7',4.4,7.2,5.2,[-10.4,3.48,2.8],[-12.7,1.4,1.6]);
  areaLight(root,'Second_Floor_West','#ffdca5',8.2,10.5,5.4,[-8.6,7.72,2.4],[-9.2,4.4,-.4]);
  areaLight(root,'Second_Floor_East','#e3edf0',6.4,10.5,5.4,[8.7,7.72,2.4],[8.8,4.4,-1.2]);
  areaLight(root,'Third_Floor_West','#ffd49a',7.6,10,5.2,[-8.7,11.9,1.8],[-8.9,8.5,-1]);
  areaLight(root,'Third_Floor_East','#ffe2b8',6.5,9.4,4.8,[8.7,11.9,-2.8],[9.1,8.7,-5.5]);

  for(let floorIndex=0;floorIndex<3;floorIndex++){
    const y=floorIndex*FLOOR_HEIGHT;
    const floor=new T.Group();
    floor.name=`Level_${floorIndex+1}`;
    floors.push(floor);
    root.add(floor);

    if(floorIndex>0){
      const westSlab=box(floor,'West_Gallery_Slab',[11.2,.16,23.4],[-9.1,y-.08,0],materials.stone,.025);
      const eastSlab=box(floor,'East_Gallery_Slab',[11.2,.16,23.4],[9.1,y-.08,0],materials.stone,.025);
      const rearSlab=box(floor,'Rear_Gallery_Bridge',[7,.16,4.2],[0,y-.08,-9.55],materials.stone,.025);
      occluders.push(westSlab,eastSlab,rearSlab);
      box(floor,'West_Gallery_Oak_Fascia',[.11,.22,23.2],[-3.47,y-.02,0],materials.oak,.018);
      box(floor,'East_Gallery_Oak_Fascia',[.11,.22,23.2],[3.47,y-.02,0],materials.oak,.018);
      box(floor,'Rear_Bridge_Oak_Fascia',[7,.22,.11],[0,y-.02,-7.42],materials.oak,.018);
      for(const x of [-14.68,-3.55,3.55,14.68]){
        box(floor,'Gallery_Stone_Edge',[.18,.08,23.2],[x,y+.01,0],materials.floorTint,.01);
      }
      for(const x of [-3.5,3.5]){
        railRun(floor,'Upper_Atrium_Rail_Rear',[x,y,-7.35],[x,y,-3.35]);
        railRun(floor,'Upper_Atrium_Rail_Front',[x,y,-3.35],[x,y,11.65]);
        box(floor,'Upper_Atrium_Warm_Cove',[.025,.018,14.8],[x*1.008,y+.08,2.15],materials.lightSoft,.006);
      }
      railRun(floor,'Upper_Bridge_Rail',[-3.5,y,-7.35],[3.5,y,-7.35]);
      box(floor,'Upper_Fascia_Light_West',[10.85,.018,.025],[-9.1,y+.08,-3.47],materials.lightSoft,.006);
      box(floor,'Upper_Fascia_Light_East',[10.85,.018,.025],[9.1,y+.08,-3.47],materials.lightSoft,.006);
      box(floor,'West_Floor_Wood_Runner',[7.8,.022,22.2],[-9.2,y+.012,0],materials.floorTint,.035);
      box(floor,'East_Floor_Wood_Runner',[7.8,.022,22.2],[9.2,y+.012,0],materials.floorTint,.035);
    }

    const rearWall=box(floor,'Rear_Stone_Wall',[30,3.96,.18],[0,y+1.98,-12],materials.plaster);
    occluders.push(rearWall);
    box(floor,'Rear_Oak_Band',[30,.25,.14],[0,y+3.86,-11.9],materials.oak);
    box(floor,'Rear_Cove_Light',[28.7,.018,.026],[0,y+3.62,-11.8],materials.lightSoft);
    const rearSlats:Vec3[]=[];
    for(let x=-14.25;x<=-4.1;x+=.14)rearSlats.push([x,y+1.8,-11.91]);
    for(let x=4.1;x<=14.26;x+=.14)rearSlats.push([x,y+1.8,-11.91]);
    instances(floor,'Rear_Wood_Acoustic_Slats',[.055,3.42,.055],rearSlats,materials.oakDark);
    box(floor,'West_Rear_Wood_Backing',[10.4,3.48,.05],[-9.2,y+1.77,-11.97],materials.plasterWarm,.01);
    box(floor,'East_Rear_Wood_Backing',[10.4,3.48,.05],[9.2,y+1.77,-11.97],materials.plasterWarm,.01);
    for(const x of [-14.72,14.72]){
      box(floor,'Side_Window_Sill',[.15,.28,23.8],[x,y+.14,0],materials.oak);
      box(floor,'Side_Curtain_Wall',[.035,3.22,23.4],[x,y+2.04,0],materials.glass);
      for(let z=-11.6;z<=11.6;z+=2.9){
        box(floor,'Side_Window_Mullion',[.11,3.45,.075],[x,y+2.12,z],materials.charcoal,.006);
      }
      box(floor,'Side_Window_Head',[.14,.10,24],[x,y+3.86,0],materials.charcoal,.006);
    }
    for(const side of [-1,1]){
      const centerX=side*9.1;
      box(floor,'Front_Glass_Sill',[11.3,.19,.16],[centerX,y+.18,11.72],materials.oak,.025);
      box(floor,'Front_Glass_Head',[11.3,.11,.15],[centerX,y+3.78,11.72],materials.charcoal,.02);
      box(floor,'Front_Curtain_Wall',[11.18,3.38,.035],[centerX,y+1.98,11.74],materials.glass);
      for(let x=side<0?-14:-3.5;x<= (side<0?-3.5:14.01);x+=2.1){
        if(side<0?x<-3.49:x>3.49)box(floor,'Front_Window_Mullion',[.06,3.5,.08],[x,y+1.99,11.72],materials.charcoal,.007);
      }
      box(floor,'Front_Transom',[11.18,.065,.07],[centerX,y+2.72,11.70],materials.charcoal,.006);
    }
    for(const x of [-14.7,-3.5,3.5,14.7]){
      for(const z of [-11.7,11.7]){
        box(floor,'Structural_Oak_Column',[.22,4.14,.22],[x,y+2.07,z],materials.oakDark,.012);
      }
    }

    if(floorIndex===1){
      const skylight=new T.Group();
      skylight.name='Two_Story_Atrium_Skylight';
      floor.add(skylight);
      const skyMaterial=new T.MeshPhysicalMaterial({
        color:'#d9e8eb',
        roughness:.16,
        transmission:0,
        transparent:true,
        opacity:.74,
        thickness:.03,
        envMapIntensity:.72,
        side:T.DoubleSide,
      });
      box(skylight,'Skylight_Glass',[7.08,.035,10.4],[0,CEILING_HEIGHT,1.9],skyMaterial);
      for(const x of [-3.5,-1.17,1.17,3.5])box(skylight,'Skylight_Long_Mullion',[.055,.10,10.4],[x,CEILING_HEIGHT+.025,1.9],materials.charcoal,.004);
      for(let z=-3.3;z<=7.1;z+=2.08)box(skylight,'Skylight_Cross_Mullion',[7.1,.10,.055],[0,CEILING_HEIGHT+.025,z],materials.charcoal,.004);
      for(const x of [-3.58,3.58]){
        box(skylight,'Skylight_Warm_Cove',[.025,.018,10.25],[x,CEILING_HEIGHT-.055,1.9],materials.lightSoft);
      }
      box(skylight,'Skylight_Front_Warm_Cove',[7.04,.018,.025],[0,CEILING_HEIGHT-.055,7.12],materials.lightSoft);
      box(skylight,'Skylight_Rear_Warm_Cove',[7.04,.018,.025],[0,CEILING_HEIGHT-.055,-3.32],materials.lightSoft);
    }

    if(floorIndex>0){
      for(const x of [-10,-6.5,6.5,10]){
        for(const z of [-.3,6.5]){
          const joinery=new T.Group();joinery.name='Workstation_Joinery_Fallback';floor.add(joinery);workstationFallbacks.push(joinery);
          box(joinery,'Staff_Desk_Top',[2.8,.12,1.35],[x,y+.78,z],materials.stone,.04);
          for(const dx of [-1.15,1.15])box(joinery,'Staff_Desk_Leg',[.07,.72,1.12],[x+dx,y+.36,z],materials.charcoal,.01);
          box(floor,'Staff_Monitor',[.98,.58,.05],[x,y+1.19,z-.2],materials.charcoal,.025);
          box(floor,'Staff_Keyboard',[.6,.025,.22],[x,y+.86,z+.54],materials.charcoal,.012);
          box(floor,'Staff_Monitor_Light',[.89,.48,.01],[x,y+1.19,z-.172],materials.screen);
          if(!furniture(floor,'taskchair',x,y,z+.96,1.09,Math.PI))officeChair(floor,x,y,z+.96,Math.PI);
          box(floor,'Desk_Privacy_Panel',[1.18,.52,.055],[x+.55,y+1.13,z-.08],materials.sageFabric,.025);
          box(floor,'Desk_Personal_Light',[.32,.025,.03],[x-.9,y+1.04,z+.38],materials.lightSoft,.008);
          furniture(floor,'plantsmall1',x-.96,y+.86,z+.24,.3,(x+z)*.03);
          box(floor,'Linear_Ceiling_Light_Housing',[3.15,.08,.19],[x,y+3.55,z+.12],materials.charcoal,.025);
          box(floor,'Linear_Ceiling_Light_Glow',[2.84,.018,.095],[x,y+3.5,z+.12],materials.lightSoft,.007);
        }
      }
      for(const x of [-4.25,4.25])for(const z of [-8,2,9.8])plant(floor,x,y,z,.82,floorIndex+Math.round(z));
      signPlane(
        floor,
        'Floor_Identity',
        floorIndex===1?'02 / 创作与项目':'03 / 管理与协作',
        floorIndex===1?'职员、产品与内容工作区 · 从项目进入真实工作面板':'数据、经营与私密协作 · 行为由公司服务记录',
        [5.6,1.0],
        [-8.8,y+2.42,-11.84],
      );
      if(floorIndex===1){
        box(floor,'Content_Room_Frame',[5.8,2.45,.18],[1.25,y+1.9,-11.82],materials.charcoal,.04);
        signPlane(
          floor,
          'Content_Room_Dashboard',
          '内容房 / NEWSROOM',
          '公告栏、投稿审核与真实阅读数据',
          [5.38,2.06],
          [1.25,y+1.92,-11.7],
        );
        box(floor,'Content_Room_Counter',[4.8,.16,.72],[1.25,y+.78,-10.55],materials.oakDark,.05);
        for(const x of [-.85,3.35])box(floor,'Content_Room_Counter_Leg',[.09,.7,.62],[x,y+.36,-10.55],materials.charcoal,.02);
        signPlane(
          floor,
          'West_Team_Identity',
          '创意与内容中心',
          '内容策划 · 产品表达 · 视觉交付',
          [5.1,.72],
          [-9.2,y+2.72,-11.84],
        );
        signPlane(
          floor,
          'East_Team_Identity',
          '项目与交付中心',
          '项目推进 · 版本验收 · 客户成功',
          [5.1,.72],
          [9.15,y+2.72,-11.84],
        );
        const projectWall=box(floor,'Project_War_Room_Back',[7.2,3.36,.14],[-9.15,y+1.74,-11.96],materials.plasterWarm,.025);
        occluders.push(projectWall);
        box(floor,'Project_War_Room_Led',[4.9,1.55,.055],[-9.15,y+2.03,-11.82],materials.screen,.035);
        monitorScreen(floor,'Project_War_Room_Data',[-9.15,y+2.04,-11.78],0,[4.72,1.36]);
        box(floor,'Project_War_Room_Counter',[5.4,.88,.82],[-9.15,y+.45,-10.85],materials.oakDark,.05);
        for(const x of [-11.75,-6.55])box(floor,'Project_War_Room_Counter_Leg',[.1,.76,.7],[x,y+.38,-10.85],materials.charcoal,.02);
        for(const x of [-11.2,-8.9,-6.6])officeChair(floor,x,y,-10.2,Math.PI);
        box(floor,'Collaboration_Rug',[5.8,.025,2.1],[-9.2,y+.017,-4.8],materials.rug,.04);
        box(floor,'Collaboration_Table_Top',[4.3,.13,1.35],[-9.2,y+.79,-4.8],materials.oakLight,.06);
        for(const x of [-10.9,-7.5])for(const z of [-5.25,-4.35])box(floor,'Collaboration_Table_Leg',[.09,.72,.09],[x,y+.36,z],materials.charcoal,.015);
        for(const [x,z,r] of [[-9.2,-3.65,0],[-9.2,-5.95,Math.PI],[-11.4,-4.8,Math.PI/2],[-7.0,-4.8,-Math.PI/2]])officeChair(floor,x,y,z,r);
      }
      if(floorIndex===2){
        signPlane(
          floor,
          'Upper_West_Identity',
          '管理协作中心',
          '经营复盘 · 资源协调 · 长期决策',
          [5.2,.72],
          [-9.15,y+2.72,-11.84],
        );
        box(floor,'Management_Rug',[6.1,.026,2.2],[-9.2,y+.018,-4.7],materials.rug,.04);
        box(floor,'Management_Table_Top',[4.4,.13,1.42],[-9.2,y+.79,-4.7],materials.oakLight,.06);
        for(const x of [-10.95,-7.45])for(const z of [-5.16,-4.24])box(floor,'Management_Table_Leg',[.09,.72,.09],[x,y+.36,z],materials.charcoal,.015);
        for(const [x,z,r] of [[-9.2,-3.55,0],[-9.2,-5.85,Math.PI],[-11.45,-4.7,Math.PI/2],[-6.95,-4.7,-Math.PI/2]])officeChair(floor,x,y,z,r);
        box(floor,'Management_Wall_Board',[4.9,1.42,.06],[-12.2,y+2.15,-11.8],materials.charcoal,.025);
        monitorScreen(floor,'Management_Live_Board',[-12.2,y+2.16,-11.76],0,[4.68,1.24]);
      }
    }

    if(floorIndex<2){
      const stairs=new T.Group();
      stairs.name=`Continuous_Scissor_Stair_${floorIndex+1}_to_${floorIndex+2}`;
      floor.add(stairs);
      const steps=STAIR.steps;
      const run=4.8/steps;
      const rise=FLOOR_HEIGHT/2/steps;
      const left=STAIR.left[0]+1.25;
      const right=STAIR.right[0]+1.25;
      const startZ=STAIR.maxZ;
      for(let i=0;i<steps;i++){
        box(stairs,'Oak_Stair_Tread_Up',[2.46,.13,run+.025],[left,y+(i+1)*rise-.065,startZ-(i+.5)*run],materials.oakLight,.018);
        box(stairs,'Stone_Stair_Riser_Up',[2.46,rise,.025],[left,y+(i+.5)*rise,startZ-i*run],materials.stone,.004);
        box(stairs,'Oak_Stair_Tread_Return',[2.46,.13,run+.025],[right,y+FLOOR_HEIGHT/2+(i+1)*rise-.065,STAIR.minZ+(i+.5)*run],materials.oakLight,.018);
        box(stairs,'Stone_Stair_Riser_Return',[2.46,rise,.025],[right,y+FLOOR_HEIGHT/2+(i+.5)*rise,STAIR.minZ+i*run],materials.stone,.004);
        if(i%2===0){
          box(stairs,'Stair_Tread_Light_Up',[2.22,.014,.024],[left,y+(i+1)*rise+.006,startZ-i*run-.05],materials.lightSoft,.003);
          box(stairs,'Stair_Tread_Light_Return',[2.22,.014,.024],[right,y+FLOOR_HEIGHT/2+(i+1)*rise+.006,STAIR.minZ+i*run+.05],materials.lightSoft,.003);
        }
      }
      box(stairs,'Half_Landing',[5.82,.16,2.0],[8.0,y+FLOOR_HEIGHT/2-.08,-2.4],materials.oakLight,.035);
      for(const x of [STAIR.left[0],STAIR.left[1]])line(
        stairs,
        'Up_Stair_Stringer',
        [x,y+.12,STAIR.maxZ],
        [x,y+FLOOR_HEIGHT/2+.12,STAIR.minZ],
        .07,
        materials.charcoal,
        12,
      );
      for(const x of [STAIR.right[0],STAIR.right[1]])line(
        stairs,
        'Return_Stair_Stringer',
        [x,y+FLOOR_HEIGHT/2+.12,STAIR.minZ],
        [x,y+FLOOR_HEIGHT+.12,STAIR.maxZ],
        .07,
        materials.charcoal,
        12,
      );
      railRun(stairs,'Up_Outer_Rail',[STAIR.left[0]+.03,y,STAIR.maxZ],[STAIR.left[0]+.03,y+FLOOR_HEIGHT/2,STAIR.minZ]);
      railRun(stairs,'Up_Inner_Rail',[STAIR.left[1]-.03,y,STAIR.maxZ],[STAIR.left[1]-.03,y+FLOOR_HEIGHT/2,STAIR.minZ]);
      railRun(stairs,'Return_Inner_Rail',[STAIR.right[0]+.03,y+FLOOR_HEIGHT/2,STAIR.minZ],[STAIR.right[0]+.03,y+FLOOR_HEIGHT,STAIR.maxZ]);
      railRun(stairs,'Return_Outer_Rail',[STAIR.right[1]-.03,y+FLOOR_HEIGHT/2,STAIR.minZ],[STAIR.right[1]-.03,y+FLOOR_HEIGHT,STAIR.maxZ]);
      railRun(stairs,'Landing_Back_Rail',[STAIR.left[0]+.03,y+FLOOR_HEIGHT/2,STAIR.landingBack],[STAIR.right[1]-.03,y+FLOOR_HEIGHT/2,STAIR.landingBack]);
      box(stairs,'Under_Stair_Warm_Light',[5.45,.028,.04],[8.0,y+2.0,STAIR.minZ-.06],materials.light);
    }

    if(floorIndex===0){
      // Continuous feature walls and ceiling, kept outside the central walking channel.
      box(floor,'West_Feature_Backing',[.18,3.73,22.8],[-14.48,1.88,0],materials.plasterWarm);
      slatWallZ(floor,'West_Timber_Ribs',-14.37,1.92,0,22.8,3.7);
      box(floor,'West_Wall_Light_Bottom',[.035,.025,22.0],[-14.28,.13,0],materials.lightSoft);
      box(floor,'West_Wall_Light_Top',[.035,.025,22.0],[-14.28,3.65,0],materials.lightSoft);
      box(floor,'East_Lobby_Backing',[.18,3.73,10.8],[14.48,1.88,6.2],materials.plasterWarm);
      slatWallZ(floor,'East_Timber_Ribs',14.37,1.92,6.2,10.8,3.7);
      box(floor,'East_Wall_Light_Bottom',[.035,.025,10.4],[14.28,.13,6.2],materials.lightSoft);
      box(floor,'East_Wall_Light_Top',[.035,.025,10.4],[14.28,3.65,6.2],materials.lightSoft);
      box(floor,'East_Lobby_Display_Frame',[.13,1.74,3.7],[14.25,2.05,7.2],materials.charcoal,.04);
      signPlane(
        floor,
        'East_Lobby_Display',
        'AI × MEDICINE',
        '把临床经验、设计与智能体能力做成真实可用的产品',
        [3.42,1.46],
        [14.18,2.05,7.2],
        -Math.PI/2,
        'dark',
      );
      box(floor,'Front_Vertical_Brand_Frame',[1.16,3.12,.11],[10.9,2.08,11.82],materials.charcoal,.07);
      verticalBrandSign(
        floor,
        'Front_Vertical_Company_Brand',
        ['童','医','魔','盒'],
        [.92,2.86],
        [10.9,2.08,11.89],
      );

      // A-zone public real-time dashboard: the rear wall centre is free of slats.
      box(floor,'Public_Dashboard_Frame',[7.9,2.42,.07],[0,2.36,-11.93],materials.charcoal,.03);
      const dashboardTexture=canvasTexture(1600,440,(c)=>{
        c.fillStyle='#0b1416';c.fillRect(0,0,1600,440);
        c.fillStyle='#7fd8c2';c.font=`500 26px ${FONT}`;c.fillText('总部实时数据 · 公开视图',56,58);
        c.fillStyle='#58806f';c.font=`19px ${FONT}`;c.fillText('等待服务端实时数据…',56,92);
      });
      const dashboardMesh=new T.Mesh(new T.PlaneGeometry(7.6,2.09),new T.MeshBasicMaterial({map:dashboardTexture,toneMapped:false}));
      dashboardMesh.name='Public_Realtime_Dashboard';
      dashboardMesh.position.set(0,2.36,-11.885);
      dashboardMesh.userData.lobbyExhibit='dashboard';
      targets.push(dashboardMesh);floor.add(dashboardMesh);
      dashboardScreen=dashboardTexture;

      // Visitor message board on the west feature wall by the entrance.
      box(floor,'Lobby_Message_Board_Frame',[.09,2.62,4.72],[-14.24,2.02,6.8],materials.charcoal,.03);
      const messageTexture=canvasTexture(880,460,(c)=>{
        c.fillStyle='#12211c';c.fillRect(0,0,880,460);
        c.fillStyle='#e9dcae';c.font=`bold 30px ${FONT}`;c.fillText('访客留言板',44,62);
        c.fillStyle='#9fb8a6';c.font=`19px ${FONT}`;c.fillText('按 E 留言 · 经负责人审核后公开',44,94);
      });
      const messageMesh=new T.Mesh(new T.PlaneGeometry(4.4,2.3),new T.MeshBasicMaterial({map:messageTexture,toneMapped:false}));
      messageMesh.name='Lobby_Message_Board';
      messageMesh.position.set(-14.19,2.02,6.8);
      messageMesh.rotation.y=Math.PI/2;
      messageMesh.userData.lobbyExhibit='messages';
      targets.push(messageMesh);floor.add(messageMesh);
      messageScreen=messageTexture;

      // A thin perimeter ceiling frames the two-storey void without turning it
      // into the stacked, open-section model language of the previous pass.
      box(floor,'Ceiling_West_Band',[11.18,.11,23.5],[-9.11,CEILING_HEIGHT,0],materials.plaster,.02);
      box(floor,'Ceiling_East_Band',[11.18,.11,23.5],[9.11,CEILING_HEIGHT,0],materials.plaster,.02);
      box(floor,'Ceiling_Rear_Band',[7,.11,4.2],[0,CEILING_HEIGHT,-9.55],materials.plaster,.02);
      box(floor,'Ceiling_Atrium_Cove_Left',[.022,.018,10.35],[-3.53,CEILING_HEIGHT-.075,1.9],materials.lightSoft);
      box(floor,'Ceiling_Atrium_Cove_Right',[.022,.018,10.35],[3.53,CEILING_HEIGHT-.075,1.9],materials.lightSoft);
      box(floor,'Ceiling_Atrium_Cove_Front',[7.04,.018,.022],[0,CEILING_HEIGHT-.075,7.08],materials.lightSoft);
      box(floor,'Ceiling_Entry_Cross_Beam',[7.0,.16,.18],[0,3.98,8.95],materials.oakDark,.035);
      box(floor,'Ceiling_Entry_Warm_Line',[3.7,.025,.035],[0,3.92,8.86],materials.light);
      for(const x of [-12.75,-6.75,6.75,12.75]){
        box(floor,'Ceiling_Linear_Soffit',[.16,.20,8.6],[x,3.95,4.9],materials.plasterWarm,.04);
        box(floor,'Ceiling_Linear_Glow',[.035,.018,8.2],[x,3.88,4.9],materials.lightSoft);
      }
      for(let z=8;z>=-2;z-=2.1){
        box(floor,'Track_Light_Rail',[.06,.06,.75],[-9.2,3.9,z],materials.charcoal,.01);
        for(const dz of [-.22,.22]){
          cylinder(floor,'Track_Spot',.085,.11,.24,[-9.2,3.79,z+dz],materials.charcoal,18);
          cylinder(floor,'Track_Light_Glow',.055,.055,.015,[-9.2,3.7,z+dz],materials.lightSoft,18);
        }
      }

      // Gallery: a large hero screen plus five distinct frames on the timber wall.
      projectScreen(
        floor,
        'Project_Hero_Screen',
        projects[0],
        0,
        [4.15,2.35],
        [-10.65,2.15,3.83],
      );
      box(floor,'Project_Hero_Frame_Top',[4.38,.12,.16],[-10.65,3.38,3.72],materials.charcoal,.025);
      box(floor,'Project_Hero_Frame_Bottom',[4.38,.12,.16],[-10.65,.91,3.72],materials.charcoal,.025);
      box(floor,'Project_Hero_Frame_Left',[.12,2.55,.16],[-12.88,2.15,3.72],materials.charcoal,.025);
      box(floor,'Project_Hero_Frame_Right',[.12,2.55,.16],[-8.42,2.15,3.72],materials.charcoal,.025);
      for(let i=1;i<projects.length;i++){
        const z=7.8-(i-1)*2.65;
        box(floor,'Project_Wall_Frame',[.12,2.12,2.28],[-14.26,1.98,z],materials.charcoal,.025);
        projectScreen(
          floor,
          `Project_Wall_${i}`,
          projects[i],
          i,
          [1.88,1.72],
          [-14.18,1.98,z],
          Math.PI/2,
        );
      }
      signPlane(
        floor,
        'Gallery_Title',
        '公开作品 / PROJECTS',
        '五个来自个人官网的公开项目 · 收进公司世界',
        [4.5,.72],
        [-11.25,3.56,3.8],
      );

      // Reception is a complete wood-and-stone assembly, now on the left as designed.
      const reception=new T.Group();
      reception.name='Reception_Cabinet_5_6m';
      reception.position.set(-5.8,0,7.2);
      floor.add(reception);
      box(reception,'Recessed_Platform',[5.65,.10,1.11],[0,.05,0],materials.charcoal,.045);
      box(reception,'Reception_Oak_Core',[5.45,.78,1.0],[0,.53,0],materials.oakDark,.045);
      const receptionSlats:Vec3[]=[];
      for(let x=-2.66;x<=2.66;x+=.085)receptionSlats.push([x,.55,.525]);
      instances(reception,'Reception_Fluted_Front',[.052,.71,.045],receptionSlats,materials.oak);
      box(reception,'Reception_Black_Reveal',[5.65,.028,1.15],[0,.95,0],materials.charcoal,.04);
      box(reception,'Reception_Marble_Top',[5.76,.09,1.2],[0,1.01,0],materials.stone,.055);
      box(reception,'Reception_Marble_Front',[4.18,.54,.09],[0,.67,.55],materials.stone,.03);
      box(reception,'Reception_Toe_Light',[5.25,.014,.018],[0,.13,.56],materials.lightSoft);
      box(reception,'Reception_Oak_Side_Left',[.38,.92,1.23],[-2.94,.48,0],materials.oak,.035);
      box(reception,'Reception_Oak_Side_Right',[.38,.92,1.23],[2.94,.48,0],materials.oak,.035);
      box(reception,'Reception_Rear_Worktop',[5.15,.06,.5],[0,.86,-.77],materials.oakLight,.022);
      box(reception,'Reception_Monitor',[.88,.53,.045],[1.82,1.30,-.18],materials.charcoal,.018);
      monitorScreen(reception,'Reception_Operations_Screen',[1.82,1.31,-.15],0);
      box(reception,'Reception_Keyboard',[.70,.028,.25],[1.82,1.07,.08],materials.charcoal,.01);
      cylinder(reception,'Reception_Orchid_Pot',.21,.17,.24,[-2.06,1.20,-.18],materials.stone,24);
      for(let i=0;i<7;i++){
        const angle=i/7*Math.PI*2;
        line(
          reception,
          'Orchid_Stem',
          [-2.06,1.28,-.18],
          [-2.06+Math.cos(angle)*.25,1.69+Math.sin(i*2)*.07,-.18+Math.sin(angle)*.18],
          .009,
          materials.leafDeep,
          6,
        );
        cylinder(
          reception,
          'Orchid_Bloom',
          .075,
          .06,
          .035,
          [-2.06+Math.cos(angle)*.26,1.72+Math.sin(i*2)*.07,-.18+Math.sin(angle)*.19],
          materials.white,
          18,
        );
      }
      box(reception,'Reception_Contract_Tray',[.62,.03,.38],[-.18,1.08,.06],materials.brass,.01);
      signPlane(
        reception,
        'Reception_Sign',
        '童医魔盒 / TONGYI MOHE',
        '接待 · 合作 · 预约',
        [3.2,.48],
        [0,.69,.607],
      );

      // The reception wall becomes the first uninterrupted oak backdrop in the room.
      box(floor,'Reception_Backdrop',[6.4,3.66,.18],[-5.8,1.83,6.0],materials.oakDark,.025);
      slatWallX(floor,'Reception_Backdrop_Flutes',-5.8,1.83,6.11,6.25,3.55);
      box(floor,'Reception_Backdrop_Sign',[5.76,.88,.075],[-5.8,2.56,6.2],materials.stone,.03);
      signPlane(
        floor,
        'Company_Identity',
        '北京童医魔盒科技服务有限公司',
        'TONGYI MOHE TECHNOLOGY · 把真实问题做成真实作品',
        [5.54,.72],
        [-5.8,2.56,6.248],
      );
      const companyTarget=floor.getObjectByName('Company_Identity')!;companyTarget.userData.lobbyExhibit='company';targets.push(companyTarget as T.Mesh);
      box(floor,'Reception_Backdrop_Cove_Top',[5.98,.016,.022],[-5.8,3.08,6.24],materials.lightSoft);
      box(floor,'Reception_Backdrop_Cove_Bottom',[5.98,.016,.022],[-5.8,2.08,6.24],materials.lightSoft);
      plant(floor,-9.25,0,5.82,1.2,3);
      plant(floor,-2.55,0,5.82,1.2,7);

      // Central glass corridor and the real, usable-looking rooms behind it.
      box(floor,'Corridor_Left_Glass',[.035,3.1,7.4],[-3.25,1.55,-7.4],materials.glassDark);
      box(floor,'Corridor_Right_Glass',[.035,3.1,7.4],[3.25,1.55,-7.4],materials.glassDark);
      for(const x of [-3.25,3.25]){
        for(let z=-11;z<=-3.7;z+=2.4){
          box(floor,'Corridor_Mullion',[.065,3.15,.065],[x,1.58,z],materials.charcoal,.008);
        }
      }
      box(floor,'Corridor_Black_Head',[6.5,.13,.12],[0,3.16,-7.4],materials.charcoal,.012);
      windowBackdrop(floor,'Rear_Workspace_Garden_View',[6.2,2.55],[0,1.48,-11.87]);
      box(floor,'Rear_Window_Glass',[6.2,2.55,.035],[0,1.48,-11.83],materials.glass);
      for(let x=-3;x<=3.01;x+=1.5)box(floor,'Rear_Window_Mullion',[.065,2.7,.07],[x,1.55,-11.72],materials.charcoal,.008);
      meetingRoom(floor,0);

      // Lounge furniture sits clear of the walkable central aisle and stairs.
      const rugGroup=new T.Group();
      rugGroup.name='Circular_Lobby_Rug';
      floor.add(rugGroup);
      const rug=new T.Mesh(new T.CylinderGeometry(3.1,3.1,.035,72),materials.rug);
      rug.position.set(11.0,.032,7.5);
      rug.receiveShadow=true;
      rugGroup.add(rug);
      for(let r=1.3;r<2.85;r+=.38){
        const ring=new T.Mesh(new T.TorusGeometry(r,.012,8,96),materials.oakDark);
        ring.rotation.x=Math.PI/2;
        ring.position.set(11.0,.055,7.5);
        rugGroup.add(ring);
      }
      furniture(floor,'loungedesignsofa',11.2,0,6.05,1.02,Math.PI);
      furniture(floor,'tablecoffee',11.2,0,8.9,.47);
      furniture(floor,'loungedesignchair',8.25,0,9.35,.94,-.88);
      furniture(floor,'loungedesignchair',13.55,0,9.05,.94,.9);
      furniture(floor,'bookcaseopen',14.16,0,1.8,2.7,-Math.PI/2);
      furniture(floor,'lamproundfloor',13.72,0,5.82,1.72);
      for(const [x,z]of [[7.72,2.68],[9.15,2.68],[10.58,2.68],[12.0,2.68]]){
        furniture(floor,'pottedplant',x,0,z,1.18,(x*z)%1);
      }
      furniture(floor,'pottedplant',13.75,0,10.75,1.45,Math.PI*.1);
      furniture(floor,'pottedplant',2.85,0,10.35,1.32,-Math.PI*.12);
      furniture(floor,'plantsmall1',-9.9,0,3.9,.54);
      furniture(floor,'books',11.3,.49,8.9,.18,.22);

      // A light portal and paired planter plinths establish the threshold from
      // the public lobby into the working company without closing the aisle.
      for(const x of [-3.08,3.08]){
        box(floor,'Corridor_Oak_Portal_Post',[.18,3.08,.26],[x,1.54,-3.66],materials.oakDark,.025);
        box(floor,'Corridor_Portal_Cove',[.025,.025,.22],[x,2.85,-3.5],materials.lightSoft);
      }
      box(floor,'Corridor_Oak_Portal_Head',[6.34,.18,.28],[0,3.03,-3.66],materials.oakDark,.03);
      box(floor,'Corridor_Portal_Linear_Light',[5.96,.025,.035],[0,2.91,-3.5],materials.lightSoft);
      box(floor,'Central_Aisle_Rug_Base',[5.4,.026,3.4],[0,.022,2.65],materials.rug,.03);
      box(floor,'Central_Aisle_Rug_Inlay',[4.9,.012,2.9],[0,.038,2.65],materials.floorTint,.02);
      signPlane(
        floor,
        'Lobby_Business_Ribbon',
        '专业医疗内容  ×  AI 生产力  ×  创意落地  ×  客户价值',
        '从真实问题进入，以可验收成果交付',
        [12.2,.72],
        [0,3.42,-3.39],
        0,
        'dark',
      );
      box(floor,'Lobby_Ribbon_Glow',[11.9,.018,.025],[0,3.04,-3.31],materials.lightSoft,.006);
      for(const x of [-12.2,-9.65,-7.1,7.1,9.65,12.2]){
        box(floor,'Lobby_Ceiling_Beam',[.16,.13,18.6],[x,3.92,2.6],materials.oakDark,.025);
        box(floor,'Lobby_Ceiling_Glow',[.025,.018,18.0],[x,3.86,2.6],materials.lightSoft,.006);
      }
      for(const [x,z] of [[-4.2,6.9],[-4.2,3.7],[4.25,6.6],[4.25,10.0]]){
        furniture(floor,'pottedplant',x,0,z,1.62,Math.PI*(x+z)*.07);
      }
      furniture(floor,'loungedesignsofa',-10.8,0,10.1,1.02,0);
      furniture(floor,'tablecoffee',-10.8,0,8.25,.47,0);
      furniture(floor,'loungedesignchair',-13.0,0,7.8,.94,-1.1);
    }

    if(floorIndex===2){
      const ceo=new T.Group();
      ceo.name='CEO_Private_Office';
      floor.add(ceo);

      const frontWall=box(ceo,'CEO_Front_Wall',[11.7,3.88,.18],[8.85,y+1.94,-3.35],materials.plasterWarm,.025);
      const westWallBack=box(ceo,'CEO_West_Wall_Back',[.18,3.88,6.1],[3,y+1.94,-8.65],materials.plasterWarm,.025);
      const westWallFront=box(ceo,'CEO_West_Wall_Front',[.18,3.88,1.05],[3,y+1.94,-3.875],materials.plasterWarm,.025);
      const doorLintel=box(ceo,'CEO_Door_Lintel',[.18,.88,1.2],[3,y+3.44,-5],materials.oakDark,.025);
      officeWalls.push(frontWall,westWallBack,westWallFront,doorLintel);
      occluders.push(frontWall,westWallBack,westWallFront,doorLintel);

      box(ceo,'CEO_Front_Oak_Band',[11.5,.22,.12],[8.85,y+3.73,-3.23],materials.oak,.02);
      box(ceo,'CEO_Front_Cove',[10.9,.02,.04],[8.85,y+3.52,-3.2],materials.lightSoft,.006);
      box(ceo,'CEO_West_Oak_Band_Back',[.12,.22,5.95],[3.11,y+3.73,-8.68],materials.oak,.02);
      box(ceo,'CEO_West_Cove_Back',[.04,.02,5.65],[3.14,y+3.52,-8.68],materials.lightSoft,.006);

      officeDoor.position.set(3,y+1.25,-5.6);
      ceo.add(officeDoor);
      box(officeDoor,'CEO_Oak_Door',[.09,2.5,1.18],[0,0,.59],materials.oakDark,.025);
      box(officeDoor,'CEO_Door_Inlay',[.025,1.74,.82],[.066,0,.6],materials.oakLight,.02);
      const doorHandle=new T.Mesh(new T.SphereGeometry(.055,18,12),materials.brass);
      doorHandle.name='CEO_Door_Handle';
      doorHandle.position.set(.105,0,.98);
      officeDoor.add(doorHandle);
      occluders.push(officeDoor);

      signPlane(ceo,'CEO_Front_Sign','帅帅 · 老板办公室','私人空间 · 仅老板身份可进入',[4.2,.68],[8.8,y+2.82,-3.22]);
      signPlane(ceo,'CEO_Door_Sign','OWNER','老板私室',[1.02,.54],[3.12,y+2.7,-5],-Math.PI/2,'dark');

      const ceiling=box(ceo,'CEO_Acoustic_Ceiling',[11.55,.12,8.28],[8.85,y+3.84,-7.52],materials.oakDark,.025);
      officeWalls.push(ceiling);
      occluders.push(ceiling);

      box(ceo,'CEO_Dark_Rug',[7.2,.028,4.9],[9.6,y+.015,-7.3],materials.rug,.04);
      box(ceo,'CEO_Wood_Panelled_Back',[7.8,2.9,.12],[8.9,y+1.59,-11.56],materials.oakDark,.025);
      slatWallX(ceo,'CEO_Acoustic_Oak_Slats',8.9,y+1.65,-11.45,7.5,2.75);
      box(ceo,'CEO_Back_Light_Top',[7.2,.018,.035],[8.9,y+3.02,-11.36],materials.lightSoft,.006);

      const joinery=new T.Group();joinery.name='Executive_Joinery_Fallback';ceo.add(joinery);
      box(joinery,'CEO_Desk_Top',[3.8,.16,1.35],[10,y+.8,-7.0],materials.oakDark,.08);
      box(joinery,'CEO_Desk_Front',[3.6,.72,.13],[10,y+.44,-6.42],materials.oak,.035);
      for(const dx of [-1.5,1.5])box(joinery,'CEO_Desk_Leg',[.12,.72,.92],[10+dx,y+.38,-7.0],materials.charcoal,.02);
      box(ceo,'CEO_Monitor',[1.05,.62,.05],[10,y+1.22,-7.35],materials.charcoal,.025);
      monitorScreen(ceo,'CEO_Operations_Screen',[10,y+1.23,-7.31]);
      box(ceo,'CEO_Keyboard',[.78,.026,.27],[10,y+.902,-6.85],materials.charcoal,.012);
      officeChair(ceo,10,y,-5.65,Math.PI);

      bookcase(ceo,3.55,y,-9.55,3.25,2.72,Math.PI/2);
      sofa(ceo,11.7,y,-4.65,-Math.PI/2);
      furniture(ceo,'tablecoffee',9.4,y,-4.75,.44);
      furniture(ceo,'loungedesignchair',8.2,y,-4.65,.91,Math.PI*.52);
      plant(ceo,13.55,y,-9.85,.92,7);
      furniture(ceo,'lamproundfloor',13.6,y,-3.95,1.7);

      const ceoLight=new T.PointLight('#ffc779',3.4,12,2);
      ceoLight.position.set(9,y+2.8,-6.3);
      ceo.add(ceoLight);
    }
  }

  try{
    const stairAsset=await furnitureLoader.loadAsync(asset('/models/headquarters-stair-system-v1.glb?rev=blender-20261021'));
    const stair=stairAsset.scene;
    stair.name='Blender_Authored_Stair_System';
    stair.position.set(8,0,0);
    stair.rotation.y=Math.PI;
    stair.traverse((object)=>{
      if(!(object instanceof T.Mesh))return;
      object.castShadow=true;
      object.receiveShadow=true;
      for(const material of [object.material].flat()){
        if(material instanceof T.MeshStandardMaterial&&material.userData)material.needsUpdate=true;
      }
    });
    root.add(stair);
    for(const name of ['Continuous_Scissor_Stair_1_to_2','Continuous_Scissor_Stair_2_to_3']){
      const fallback=root.getObjectByName(name);
      if(fallback)fallback.visible=false;
    }
  }catch(error){
    furnitureFailures.push(`楼梯资产: ${(error as Error).message}`);
  }

  try{
    const receptionAsset=(await furnitureLoader.loadAsync(asset('/models/hq-reception-v2.glb'))).scene;
    receptionAsset.name='Blender_Authored_Reception_Desk';
    receptionAsset.position.set(-5.8,0,7.2);
    receptionAsset.rotation.y=0;
    receptionAsset.traverse((object)=>{
      if(!(object instanceof T.Mesh))return;
      object.castShadow=true;
      object.receiveShadow=true;
      for(const material of [object.material].flat()){
        if(material.name?.includes('LED')&&material instanceof T.MeshStandardMaterial){
          material.color.set('#ffe2b0');
          material.emissive.set('#ff8b2d');
          material.emissiveIntensity=7;
          material.toneMapped=false;
          material.needsUpdate=true;
        }
      }
    });
    floors[0].add(receptionAsset);
    const fallbackReception=root.getObjectByName('Reception_Cabinet_5_6m');
    if(fallbackReception)fallbackReception.visible=false;
  }catch(error){
    furnitureFailures.push(`接待台资产: ${(error as Error).message}`);
  }

  // Leave the countertop monitor to the right; the wall display is unobstructed.
  monitorScreen(floors[0],'Public_Business_Terminal',[-6.55,1.65,6.29],0,[3.25,.65]);

  function instanceJoinery(source:T.Group,parent:T.Object3D,positions:Vec3[],name:string){
    source.updateMatrixWorld(true);
    source.traverse(object=>{
      if(!(object instanceof T.Mesh))return;
      const mesh=new T.InstancedMesh(object.geometry,object.material,positions.length);mesh.name=name+'_'+object.name;
      mesh.castShadow=mesh.receiveShadow=true;
      positions.forEach((p,i)=>mesh.setMatrixAt(i,new T.Matrix4().makeTranslation(...p).multiply(object.matrixWorld)));
      mesh.computeBoundingSphere();parent.add(mesh);
    });
  }
  await Promise.all([
    (async()=>{try{
      const source=(await furnitureLoader.loadAsync(asset('/models/hq-workstation-joinery.glb'))).scene;
      for(const floorIndex of [1,2]){
        const positions:Vec3[]=[];for(const x of [-10,-6.5,6.5,10])for(const z of [-.3,6.5])positions.push([x,floorIndex*FLOOR_HEIGHT,z]);
        instanceJoinery(source,floors[floorIndex],positions,'Blender_Workstation_Joinery');
      }
      workstationFallbacks.forEach(group=>group.visible=false);
    }catch(error){furnitureFailures.push(`共享木作资产: ${(error as Error).message}`);}})(),
    (async()=>{try{
      const source=(await furnitureLoader.loadAsync(asset('/models/hq-executive-joinery.glb'))).scene;
      instanceJoinery(source,floors[2],[[10,2*FLOOR_HEIGHT,-7]],'Blender_Executive_Joinery');
      const fallback=root.getObjectByName('Executive_Joinery_Fallback');if(fallback)fallback.visible=false;
    }catch(error){furnitureFailures.push(`老板木作资产: ${(error as Error).message}`);}})(),
  ]);

  try{
    const kit=(await furnitureLoader.loadAsync(asset('/models/hq-building-v2.glb'))).scene;
    kit.name='Blender_Building_Kit_v2';
    kit.traverse((object)=>{
      if(!(object instanceof T.Mesh))return;
      object.castShadow=object.receiveShadow=true;
      for(const material of [object.material].flat()){
        if(material.name?.includes('LED')&&material instanceof T.MeshStandardMaterial){
          material.color.set('#ffe2b0');
          material.emissive.set('#ff8b2d');
          material.emissiveIntensity=6;
          material.toneMapped=false;
          material.needsUpdate=true;
        }
      }
    });
    // Ground-floor lounge from concept 09: sofa grouping right of the entrance.
    const place=(name:string,x:number,y:number,z:number)=>{
      const object=kit.getObjectByName(name);
      if(!object)throw new Error(`建筑套件缺少 ${name}`);
      object.position.set(x,y,z);
    };
    place('Lounge_Sofa_Unit',7.6,0,8.2);
    place('Coffee_Table_Round',7.6,0,6.9);
    place('Coffee_Table_Leg',7.6,0,6.9);
    place('Lounge_Rug',7.6,0,7.4);
    place('Planter_Box_L',-9.2,0,10.2);
    place('Planter_Plant_L',-9.2,0,10.2);
    root.add(kit);
  }catch(error){
    furnitureFailures.push(`建筑外观套件: ${(error as Error).message}`);
  }

  const resources=()=>{
    const geometries=new Set<T.BufferGeometry>();
    const instances=new Set<T.InstancedMesh>();
    const textureSet=new Set<T.Texture>();
    const materialSet=new Set<T.Material>();
    root.traverse((object)=>{
      if(!(object instanceof T.Mesh))return;
      if(object instanceof T.InstancedMesh)instances.add(object);
      geometries.add(object.geometry);
      for(const material of [object.material].flat()){
        materialSet.add(material);
        for(const value of Object.values(material))if(value instanceof T.Texture)textureSet.add(value);
      }
    });
    return {geometries,instances,textures:textureSet,materials:materialSet};
  };

  return {
    root,
    floors,
    reception:floors[0].getObjectByName('Reception_Cabinet_5_6m')!,
    targets,
    officeDoor,
    officeWalls,
    occluders,
    furnitureFailures,
    updateCases(data:{publishedCases:number;items:{title:string;serviceType:string;image?:string}[];updatedAt:string|null}|null){
      if(!caseScreen)return;const fingerprint=JSON.stringify(data);if(fingerprint===caseFingerprint)return;caseFingerprint=fingerprint;
      const canvas=caseScreen.image as HTMLCanvasElement;
      const draw=(image?:HTMLImageElement)=>{
        const c=canvas.getContext('2d')!,wide=canvas.height<=240;
        c.fillStyle=wide?'#0d1b20':'#1f342b';c.fillRect(0,0,canvas.width,canvas.height);
        let textX=40,textWidth=canvas.width-80;
        if(image&&wide){
          c.save();c.beginPath();c.rect(0,0,210,canvas.height);c.clip();
          const scale=Math.max(210/image.naturalWidth,canvas.height/image.naturalHeight);
          const dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;
          c.drawImage(image,(210-dw)/2,(canvas.height-dh)/2,dw,dh);c.restore();
          c.fillStyle='#0d1b20';c.fillRect(206,0,8,canvas.height);
          textX=246;textWidth=canvas.width-textX-40;
        }else if(image){
          c.save();c.globalAlpha=.16;c.beginPath();c.rect(0,0,canvas.width,canvas.height);c.clip();
          const scale=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
          c.drawImage(image,(canvas.width-image.naturalWidth*scale)/2,(canvas.height-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);c.restore();
        }
        const clip=(v:string,max:number)=>v.length>max?v.slice(0,max-1)+'…':v;
        c.fillStyle='#f8edce';c.font=`bold ${wide?24:25}px ${FONT}`;
        const title=data?.items[0]?.title;
        c.fillText(data?(title?clip(title,wide?16:31):'目前还没有获准公开的案例'):'案例数据暂不可用 · 可打开列表重试',textX,wide?42:96);
        c.fillStyle='#b8cfb4';c.font=`${wide?17:19}px ${FONT}`;
        c.fillText(data?`已公开 ${data.publishedCases} 项 · 来源：公司案例库 · REAL`:'来源：公司案例库 · 连接中断',textX,wide?76:139);
        c.font=`${wide?15:18}px ${FONT}`;
        c.fillText('点击查看全部案例与证据口径 · 我要类似项目',textX,wide?106:179);
        caseScreen!.needsUpdate=true;
      };
      draw();
      // Cases without an approved screenshot have no image field: never create
      // an Image request (and its 404) for them; the text placeholder above stays.
      const sourceImage=data?.items[0]?.image;
      const src=typeof sourceImage==='string'&&sourceImage.trim()?sourceImage.trim():'';
      if(src){const img=new Image();img.crossOrigin='anonymous';img.src=src;img.decode().then(()=>{if(img.naturalWidth>0)draw(img);}).catch(()=>{});}
    },
    updateDashboard(data:{visitors:number;publishedCases:number;publicProjects:number;confirmedDeliveries:number;updatedAt:string}|null){
      if(!dashboardScreen)return;const fingerprint=JSON.stringify(data);if(fingerprint===dashboardFingerprint)return;dashboardFingerprint=fingerprint;
      const canvas=dashboardScreen.image as HTMLCanvasElement,c=canvas.getContext('2d')!;
      c.fillStyle='#0b1416';c.fillRect(0,0,1600,440);
      c.fillStyle='#7fd8c2';c.font=`500 26px ${FONT}`;c.fillText('总部实时数据 · 公开视图',56,58);
      c.fillStyle='#58806f';c.font=`19px ${FONT}`;
      c.fillText(data?`来源：公司服务端实时统计 · REAL · 更新 ${new Date(data.updatedAt).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}`:'连接中断 · 等待服务端实时数据',56,92);
      const stats:[string,string][]=data
        ?[['当前在线访客',String(data.visitors)],['已公开案例',String(data.publishedCases)],['授权公开项目',String(data.publicProjects)],['确认交付',String(data.confirmedDeliveries)]]
        :[];
      stats.forEach(([label,value],i)=>{
        const x=56+i*386;
        c.fillStyle='#123227';c.fillRect(x,130,356,236);
        c.fillStyle='#58806f';c.font=`21px ${FONT}`;c.fillText(label,x+24,172);
        c.fillStyle='#e9f5ee';c.font=`bold 92px ${FONT}`;c.fillText(value,x+24,286);
        c.fillStyle='#3f5f52';c.font=`17px ${FONT}`;c.fillText('服务端真实计数',x+24,330);
      });
      if(!data){c.fillStyle='#8aa396';c.font=`26px ${FONT}`;c.fillText('实时数据暂不可用，可点击查看公开口径说明',56,230);}
      dashboardScreen.needsUpdate=true;
    },
    updateMessages(data:{approvedCount:number;items:{name:string;body:string;createdAt:string}[]}|null){
      if(!messageScreen)return;const fingerprint=JSON.stringify(data);if(fingerprint===messageFingerprint)return;messageFingerprint=fingerprint;
      const canvas=messageScreen.image as HTMLCanvasElement,c=canvas.getContext('2d')!;
      c.fillStyle='#12211c';c.fillRect(0,0,880,460);
      c.fillStyle='#e9dcae';c.font=`bold 30px ${FONT}`;c.fillText('访客留言板',44,62);
      c.fillStyle='#9fb8a6';c.font=`19px ${FONT}`;c.fillText(`按 E 留言 · 审核后公开 · 已公开 ${data?data.approvedCount:0} 条`,44,94);
      if(!data){c.fillStyle='#c7d6c9';c.font=`21px ${FONT}`;c.fillText('留言数据暂不可用，可刷新重试',44,160);messageScreen.needsUpdate=true;return;}
      if(!data.items.length){c.fillStyle='#c7d6c9';c.font=`21px ${FONT}`;c.fillText('还没有公开留言，欢迎留下第一句。',44,160);messageScreen.needsUpdate=true;return;}
      data.items.forEach((m,i)=>{
        const y=150+i*92;
        c.fillStyle='#1b2f27';c.fillRect(36,y-34,808,80);
        c.fillStyle='#e9dcae';c.font=`bold 21px ${FONT}`;c.fillText(m.name.length>12?m.name.slice(0,11)+'…':m.name,54,y-4);
        c.fillStyle='#c7d6c9';c.font=`20px ${FONT}`;
        const body=m.body.length>34?m.body.slice(0,33)+'…':m.body;
        c.fillText(body,150,y-4);
        c.fillStyle='#6c8577';c.font=`15px ${FONT}`;c.fillText(new Date(m.createdAt).toLocaleDateString('zh-CN'),54,y+30);
      });
      messageScreen.needsUpdate=true;
    },
    updateBusiness(data:{publicProjects:number;confirmedDeliveries:number}|null){
      for(const texture of businessScreens){
        const canvas=texture.image as HTMLCanvasElement,c=canvas.getContext('2d')!;
        if(canvas.height===200){
          c.fillStyle='#0d1b20';c.fillRect(36,48,928,112);
          c.fillStyle='#e6dbc4';c.font=`28px ${FONT}`;
          c.fillText(data?`授权公开项目 ${data.publicProjects}  ·  确认交付 ${data.confirmedDeliveries}`:'经营数据暂不可用 · 请刷新后重试',60,103);
          c.font=`18px ${FONT}`;c.fillStyle='#a6bbb0';c.fillText('人工收款核验 · AI成本未接入',60,143);
          texture.needsUpdate=true;continue;
        }
        c.fillStyle='#0d1b20';c.fillRect(36,120,928,320);
        c.fillStyle='#e6dbc4';c.font=`42px ${FONT}`;
        c.fillText(data?'客户授权公开项目  '+data.publicProjects:'经营数据暂不可用',70,218);
        c.fillText(data?'客户确认交付  '+data.confirmedDeliveries:'请刷新连接后重试',70,316);
        c.font=`24px ${FONT}`;c.fillStyle='#a6bbb0';c.fillText('人工收款核验 · AI成本未接入',70,398);
        texture.needsUpdate=true;
      }
    },
    setSection(level:number|null){
      floors.forEach((floor,index)=>floor.visible=level===null||index<=level);
      // Upper-floor fill must not light the lobby through hidden slabs.
      sectionLights.forEach(light=>light.visible=level===null||Math.floor(light.position.y/FLOOR_HEIGHT)===level);
    },
    dispose(){
      const owned=resources();
      owned.instances.forEach(instance=>instance.dispose());
      owned.geometries.forEach((geometry)=>geometry.dispose());
      owned.textures.forEach((texture)=>texture.dispose());
      owned.materials.forEach((material)=>material.dispose());
      root.removeFromParent();
    },
  };
}
