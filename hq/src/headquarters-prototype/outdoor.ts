import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {BUILDING_BOUNDS,WORLD_BOUNDS} from '../shared/world.js';

const FONT='"Microsoft YaHei","PingFang SC",sans-serif';
type Vec3=[number,number,number];

export interface OutdoorVisuals {
  root:T.Group;
  occluders:T.Object3D[];
  dispose():void;
}

export function createOutdoor():OutdoorVisuals {
  const root=new T.Group();
  root.name='Warm_Wood_Headquarters_Outdoor';
  const occluders:T.Object3D[]=[];
  const physical=(color:string,roughness:number,metalness=0,extra:T.MeshStandardMaterialParameters={})=>
    new T.MeshStandardMaterial({color,roughness,metalness,...extra});
  const materials={
    grass:physical('#6f8d57',.96,0,{envMapIntensity:.34}),
    grassLight:physical('#86a568',.93,0,{envMapIntensity:.36}),
    grassDeep:physical('#476b3e',.98,0,{envMapIntensity:.28}),
    soil:physical('#6c5741',1,0),
    stone:physical('#c9c2b4',.7,0,{envMapIntensity:.75}),
    stoneLight:physical('#e3dccd',.55,0,{envMapIntensity:.9}),
    stoneDark:physical('#817d74',.72,0,{envMapIntensity:.66}),
    asphalt:physical('#313735',.84,0,{envMapIntensity:.42}),
    roadLine:new T.MeshBasicMaterial({color:'#e7d8a4'}),
    oak:physical('#a6754c',.38,0,{envMapIntensity:.88}),
    oakDark:physical('#614530',.46,0,{envMapIntensity:.72}),
    charcoal:physical('#202725',.38,.35,{envMapIntensity:1.0}),
    brass:physical('#bd9451',.32,.64,{envMapIntensity:1.12}),
    leaf:physical('#395f39',.82,0,{envMapIntensity:.52}),
    leafLight:physical('#64834f',.82,0,{envMapIntensity:.54}),
    leafDeep:physical('#203f2b',.88,0,{envMapIntensity:.46}),
    flower:physical('#b96d4f',.78,0),
    glass:physical('#c9dfdd',.18,0,{transparent:true,opacity:.25,depthWrite:false,side:T.DoubleSide,envMapIntensity:.9}),
    glow:new T.MeshStandardMaterial({color:'#ffe4b0',emissive:'#ffc36a',emissiveIntensity:5.1,toneMapped:false}),
    sign:new T.MeshBasicMaterial({color:'#efe7d5',toneMapped:false}),
  };

  const box=(parent:T.Object3D,name:string,size:Vec3,position:Vec3,material:T.Material,radius=0)=>{
    const mesh=new T.Mesh(radius?new RoundedBoxGeometry(...size,4,Math.min(radius,...size.map(v=>v/3))):new T.BoxGeometry(...size),material);
    mesh.name=name;
    mesh.position.fromArray(position);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  };
  const cylinder=(parent:T.Object3D,name:string,radiusTop:number,radiusBottom:number,height:number,position:Vec3,material:T.Material,segments=24)=>{
    const mesh=new T.Mesh(new T.CylinderGeometry(radiusTop,radiusBottom,height,segments),material);
    mesh.name=name;
    mesh.position.fromArray(position);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  };
  const plane=(parent:T.Object3D,name:string,width:number,depth:number,position:Vec3,material:T.Material)=>{
    const mesh=new T.Mesh(new T.PlaneGeometry(width,depth),material);
    mesh.name=name;
    mesh.rotation.x=-Math.PI/2;
    mesh.position.fromArray(position);
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  };
  const instanced=(parent:T.Object3D,name:string,geometry:T.BufferGeometry,material:T.Material,matrices:T.Matrix4[])=>{
    const mesh=new T.InstancedMesh(geometry,material,matrices.length);
    mesh.name=name;
    matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  };
  const canvasSign=(parent:T.Object3D,name:string,title:string,subtitle:string,size:[number,number],position:Vec3,rotationY=0)=>{
    const canvas=document.createElement('canvas');
    canvas.width=1800;
    canvas.height=Math.round(1800*size[1]/size[0]);
    const context=canvas.getContext('2d');
    if(!context)throw new Error('无法创建户外公司标识');
    const gradient=context.createLinearGradient(0,0,canvas.width,0);
    gradient.addColorStop(0,'#14251d');
    gradient.addColorStop(.62,'#263b2e');
    gradient.addColorStop(1,'#1a2b22');
    context.fillStyle=gradient;
    context.fillRect(0,0,canvas.width,canvas.height);
    context.fillStyle='#d4b06e';
    context.fillRect(84,84,92,7);
    context.fillStyle='#ffffff';
    context.font=`700 ${Math.min(102,canvas.height*.27)}px ${FONT}`;
    context.fillText(title,84,canvas.height*.48);
    context.fillStyle='#c5d1c4';
    context.font=`${Math.min(48,canvas.height*.13)}px ${FONT}`;
    context.fillText(subtitle,84,canvas.height*.77);
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;
    texture.anisotropy=8;
    const face=new T.Mesh(new T.PlaneGeometry(size[0],size[1]),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
    face.name=name;
    face.position.fromArray(position);
    face.rotation.y=rotationY;
    parent.add(face);
    return {face,texture};
  };

  const terrain=new T.Group();
  terrain.name='Landscape_And_Approach';
  root.add(terrain);
  plane(
    terrain,
    'Ground_Grass',
    WORLD_BOUNDS.maxX-WORLD_BOUNDS.minX,
    WORLD_BOUNDS.maxZ-WORLD_BOUNDS.minZ,
    [0,-.085,(WORLD_BOUNDS.minZ+WORLD_BOUNDS.maxZ)/2],
    materials.grass,
  );
  plane(terrain,'Road_Asphalt',56,6,[0,.012,31],materials.asphalt);
  plane(terrain,'Near_Pavement',56,1.7,[0,.035,27.15],materials.stoneLight);
  plane(terrain,'Far_Pavement',56,1.7,[0,.035,34.85],materials.stone);
  plane(terrain,'Main_Stone_Walk',5.4,11.1,[0,.028,20.75],materials.stoneLight);
  plane(terrain,'Entrance_Plaza',12.8,3.3,[0,.031,13.55],materials.stone);
  plane(terrain,'Entry_Runner',4.4,.65,[0,.053,(ENTRANCE_Z-0.2)],materials.stoneLight);
  plane(terrain,'Crosswalk',4.5,5.8,[0,.04,31],materials.stoneLight);

  const laneMatrices:T.Matrix4[]=[];
  const laneMatrix=new T.Matrix4();
  for(let x=-26;x<=26;x+=5.2){
    laneMatrix.makeTranslation(x,.041,31);
    laneMatrices.push(laneMatrix.clone());
  }
  instanced(terrain,'Road_Lane_Markings',new T.BoxGeometry(2.7,.016,.14),materials.roadLine,laneMatrices);
  const crosswalkMatrices:T.Matrix4[]=[];
  for(let z=28.6;z<=33.4;z+=.72){
    laneMatrix.makeTranslation(0,.046,z);
    crosswalkMatrices.push(laneMatrix.clone());
  }
  instanced(terrain,'Crosswalk_Stripes',new T.BoxGeometry(4.45,.014,.34),materials.stoneLight,crosswalkMatrices);

  const buildingFront=BUILDING_BOUNDS.maxZ;
  const stepMatrices:T.Matrix4[]=[];
  for(let index=0;index<3;index++){
    laneMatrix.compose(
      new T.Vector3(0,.055+index*.055,buildingFront+.25+index*.24),
      new T.Quaternion(),
      new T.Vector3(1,1,1),
    );
    stepMatrices.push(laneMatrix.clone());
  }
  instanced(terrain,'Entrance_Stone_Steps',new T.BoxGeometry(5.3,.11,.25),materials.stone,stepMatrices);

  const canopy=new T.Group();
  canopy.name='Entrance_Glass_Canopy';
  root.add(canopy);
  box(canopy,'Canopy_Shadow_Reveal',[12.2,.16,3.5],[0,4.12,14.05],materials.charcoal,.05);
  box(canopy,'Canopy_Glass',[11.9,.075,3.3],[0,4.23,14.02],materials.glass,.04);
  for(const x of [-5.65,5.65]){
    box(canopy,'Canopy_Oak_Post',[.24,4.16,.28],[x,2.08,14.85],materials.oakDark,.035);
    box(canopy,'Canopy_Post_Light',[.055,3.62,.035],[x,2.04,15.02],materials.glow,.01);
    occluders.push(cylinder(canopy,'Canopy_Bracing',.07,.07,4.8,[x,2.12,13.15],materials.charcoal,12));
  }
  box(canopy,'Canopy_Header',[12,.34,.24],[0,4,.45+buildingFront],materials.oakDark,.045);
  canvasSign(canopy,'Company_Entrance_Sign','童医魔盒 / TONGYI MOHE','AI × MEDICINE · 北京童医魔盒科技服务有限公司',[7.6,.7],[0,4.02,buildingFront+.59]);

  const monolith=new T.Group();
  monolith.name='Entrance_Wayfinding_Monolith';
  root.add(monolith);
  box(monolith,'Monolith_Core',[5.1,2.3,.42],[8.5,1.15,22.2],materials.charcoal,.09);
  box(monolith,'Monolith_Oak_Side',[.18,2.11,.45],[6.05,1.15,22.2],materials.oak,.035);
  const monolithSign=canvasSign(monolith,'Monolith_Sign','北京童医魔盒科技服务有限公司','接待 · 项目合作 · 内容共创 · 招聘',[4.75,1.92],[8.5,1.2,22.42]);
  occluders.push(...[monolith.getObjectByName('Monolith_Core')!]);

  const treeMaterialSets=[materials.leaf,materials.leafLight,materials.leafDeep];
  const tree=(x:number,z:number,scale:number,variant:number)=>{
    const group=new T.Group();
    group.name='Layered_Outdoor_Tree';
    group.position.set(x,0,z);
    group.scale.setScalar(scale);
    root.add(group);
    cylinder(group,'Tree_Trunk',.16,.25,2.2,[0,1.1,0],materials.oakDark,10);
    const crownMatrices:T.Matrix4[]=[];
    for(let index=0;index<9;index++){
      const angle=index*2.399+variant*.27;
      const radius=.62+(index%3)*.25;
      const matrix=new T.Matrix4().compose(
        new T.Vector3(Math.cos(angle)*radius,2.15+(index%4)*.38,Math.sin(angle)*radius),
        new T.Quaternion().setFromEuler(new T.Euler(index*.17,angle,index*.11)),
        new T.Vector3(1.15+(index%2)*.32,.8+(index%3)*.2,1.05+(index%3)*.22),
      );
      crownMatrices.push(matrix);
    }
    instanced(group,'Tree_Crown_Lobes',new T.IcosahedronGeometry(.72,2),treeMaterialSets[variant%3],crownMatrices);
  };
  for(const [x,z,scale,variant] of [
    [-19,21,1.18,0],[-24,12,1.45,1],[-20,-4,1.2,2],[-24,-14,1.4,0],
    [20,22,1.22,1],[24,13,1.35,2],[21,-2,1.18,0],[24,-14,1.44,1],
  ] as const)tree(x,z,scale,variant);

  const hedgeMatrices:T.Matrix4[]=[];
  for(let x=-25;x<=25;x+=1.55){
    if(Math.abs(x)<5.8)continue;
    hedgeMatrices.push(new T.Matrix4().makeTranslation(x,.43,25.0));
  }
  instanced(root,'Roadside_Hedge',new T.IcosahedronGeometry(.56,2),materials.leafDeep,hedgeMatrices);

  const shrubMatrices:T.Matrix4[]=[];
  for(let index=0;index<46;index++){
    const side=index%2?1:-1;
    const x=side*(7.4+(index%6)*2.5);
    const z=14.5+(Math.floor(index/2)%9)*1.25;
    shrubMatrices.push(new T.Matrix4().compose(
      new T.Vector3(x,.31,z),
      new T.Quaternion(),
      new T.Vector3(.62+(index%3)*.16,.58+(index%2)*.2,.62+(index%4)*.11),
    ));
  }
  instanced(root,'Entrance_Landscape_Shrubs',new T.IcosahedronGeometry(.58,1),materials.leaf,shrubMatrices);

  const flowerMatrices:T.Matrix4[]=[];
  for(let index=0;index<64;index++){
    const side=index%2?1:-1;
    const x=side*(5.2+(index%8)*.55);
    const z=13.1+Math.floor(index/16)*.54;
    flowerMatrices.push(new T.Matrix4().makeTranslation(x,.34,z));
  }
  instanced(root,'Entrance_Flower_Bed',new T.IcosahedronGeometry(.075,1),materials.flower,flowerMatrices);

  const lamp=(x:number,z:number)=>{
    const group=new T.Group();
    group.name='Street_Lamp';
    group.position.set(x,0,z);
    root.add(group);
    cylinder(group,'Lamp_Post',.055,.08,4.25,[0,2.125,0],materials.charcoal,12);
    box(group,'Lamp_Arm',[.78,.07,.07],[.34,4.12,0],materials.charcoal,.025);
    box(group,'Lamp_Head',[.34,.11,.24],[.72,4.02,0],materials.charcoal,.055);
    box(group,'Lamp_Glow',[.25,.025,.15],[.72,3.945,0],materials.glow,.018);
    occluders.push(group.children[0]);
  };
  for(const [x,z] of [[-9,27.5],[-22,27.5],[9,27.5],[22,27.5],[-16,18.5],[16,18.5]] as const)lamp(x,z);

  for(const [x,z,rotation] of [[-13.8,18.7,Math.PI/2],[13.8,18.7,-Math.PI/2]] as const){
    const bench=new T.Group();
    bench.name='Outdoor_Oak_Bench';
    bench.position.set(x,0,z);
    bench.rotation.y=rotation;
    root.add(bench);
    for(const dx of [-.74,.74]){
      box(bench,'Bench_Stone_Leg',[.18,.48,.62],[dx,.24,0],materials.stoneDark,.04);
      occluders.push(bench.children.at(-1)!);
    }
    for(let index=0;index<4;index++)box(bench,'Bench_Oak_Slat',[1.9,.08,.11],[0,.56,-.24+index*.16],materials.oak,.025);
    for(let index=0;index<3;index++)box(bench,'Bench_Back_Slat',[1.9,.09,.09],[0,.86+index*.2,.28],materials.oak,.025);
  }

  const pathLightMatrices:T.Matrix4[]=[];
  for(let index=0;index<12;index++){
    pathLightMatrices.push(new T.Matrix4().makeTranslation(index%2?1.9:-1.9,.11,13.5+index*1.2));
  }
  instanced(root,'Path_Bollards',new T.CylinderGeometry(.055,.075,.22,12),materials.glow,pathLightMatrices);

  const allGeometry=new Set<T.BufferGeometry>();
  const allMaterials=new Set<T.Material>();
  const allTextures=new Set<T.Texture>();
  root.traverse((object)=>{
    if(!(object instanceof T.Mesh))return;
    allGeometry.add(object.geometry);
    for(const material of [object.material].flat()){
      allMaterials.add(material);
      for(const value of Object.values(material))if(value instanceof T.Texture)allTextures.add(value);
    }
  });
  allTextures.add(monolithSign.texture);
  return {
    root,
    occluders,
    dispose(){
      root.traverse(object=>{if(object instanceof T.InstancedMesh)object.dispose();});
      allGeometry.forEach(geometry=>geometry.dispose());
      allTextures.forEach(texture=>texture.dispose());
      allMaterials.forEach(material=>material.dispose());
      root.removeFromParent();
    },
  };
}

const ENTRANCE_Z=11.7;
