// Authored meshes, not recolored copies of the CC0 library. Source is MIT.
// Two independent collections are generated from this file:
//   cyber/ - starport shells: cantilevered steel frames, modular bays, integrated light bars.
//   warm/  - warm-wood HQ: turned oak legs, upholstered shells, rattan panels, terracotta.
// Every prop is normalized to a 1 m height and must fit the per-id envelope in
// src/model-budgets.json. Hard product budget: <=8 draw primitives and <=3000
// triangles; this builder fails above 1800 triangles per prop.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {inspectGLB} from '../src/glb.js';
import budgets from '../src/model-budgets.json' with {type:'json'};
const root=fileURLToPath(new URL('..',import.meta.url));
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}};

const palette={shell:'#d5e7ed',dark:'#183247',seat:'#335c71',metal:'#819eab',light:'#71e4e3',glass:'#173f5b',gold:'#dbb375',clay:'#b3674a'};
const material=(key)=>new T.MeshStandardMaterial({color:palette[key],roughness:{metal:.28,glass:.18,light:.4,clay:.82}[key]??.5,metalness:{metal:.7,glass:.08,light:.1,clay:0}[key]??.12,...(key==='light'?{emissive:palette.light,emissiveIntensity:.7}:{})});
const mats=Object.fromEntries(Object.keys(palette).map(k=>[k,material(k)]));

// These authored props are static. Bake their normalized transforms and merge
// only parts sharing the exact same material; each furniture instance remains
// separately editable in the host. No collision/navigation geometry is changed.
function batchModel(source){
 source.updateMatrixWorld(true);const groups=new Map();
 source.traverse(o=>{if(!o.isMesh)return;const rows=groups.get(o.material)||[];let geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}rows.push(geometry);groups.set(o.material,rows);});
 const result=new T.Group();result.name=source.name;
 for(const [mat,geometries]of groups){const merged=mergeGeometries(geometries,false);if(!merged)throw new Error('Incompatible authored geometry: '+source.name);result.add(new T.Mesh(merged,mat));geometries.forEach(g=>g.dispose());}
 return result;
}

// --- primitive library -----------------------------------------------------
// Rounded boxes are reserved for soft shells and carcasses (108 tris each).
// Hard panels, shelves and book blocks use plain boxes (12 tris) so detail does
// not turn into stacks of beveled cubes.
function box(g,w,h,d,x,y,z,key='shell',r=.04){const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)),mats[key]);m.position.set(x,y,z);g.add(m);return m;}
function slab(g,w,h,d,x,y,z,key='dark',rx=0,ry=0,rz=0){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mats[key]);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m;}
function cyl(g,r1,r2,h,x,y,z,key='metal',seg=16,rx=0,ry=0,rz=0){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,seg),mats[key]);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m;}
function lathe(g,profile,x,y,z,key='shell',seg=16){const m=new T.Mesh(new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),seg),mats[key]);m.position.set(x,y,z);g.add(m);return m;}
function tube(g,points,r,key='light',segments=12,radial=4){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const m=new T.Mesh(new T.TubeGeometry(curve,segments,r,radial,false),mats[key]);g.add(m);return m;}
function ring(g,radius,pipes,key='light',rseg=4,tseg=24,x=0,y=0,z=0,rx=Math.PI/2){const m=new T.Mesh(new T.TorusGeometry(radius,pipes,rseg,tseg),mats[key]);m.rotation.x=rx;m.position.set(x,y,z);g.add(m);return m;}
// A side profile in (depth,height) extruded across the model's width, giving
// chairs, machine bodies and laptop wedges an intentional contour in one pass.
function profile(g,draw,width,key,x=0,y=0,z=0,bevel=.01,curve=8){
 const shape=new T.Shape();draw(shape);
 const geometry=new T.ExtrudeGeometry(shape,{depth:width,steps:1,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:curve});
 geometry.translate(0,0,-width/2);
 const m=new T.Mesh(geometry,mats[key]);m.rotation.y=Math.PI/2;m.position.set(x,y,z);g.add(m);return m;
}
function roundedRectPath(path,w,h,r){const x=-w/2,y=-h/2;path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);path.lineTo(x+r,y+h);path.quadraticCurveTo(x,y+h,x,y+h-r);path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);path.closePath();return path;}
function frame(g,outerW,outerH,innerW,innerH,r,depth,key,x,y,z){
 const shape=roundedRectPath(new T.Shape(),outerW,outerH,r);shape.holes.push(roundedRectPath(new T.Path(),innerW,innerH,Math.max(.008,r*.7)));
 const geometry=new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:1,curveSegments:5});
 const m=new T.Mesh(geometry,mats[key]);m.position.set(x,y,z-depth/2);g.add(m);return m;
}
function worldBounds(g){
 g.updateMatrixWorld(true);const bounds=new T.Box3(),vertex=new T.Vector3();
 g.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;for(let i=0;i<positions.count;i++){vertex.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);bounds.expandByPoint(vertex);}});
 return bounds;
}
function normalize(g,id){
 // Exact vertex bounds, not transformed AABBs: rotated leaves and cushions must
 // not inflate the measured envelope and shrink the prop below the 0.95 floor.
 const b=worldBounds(g),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
 const limit=budgets[id];if(!limit)throw new Error('缺少家具包围盒预算：'+id);
 const sy=1/size.y,sx=Math.min(sy,limit.widthPerHeight*.99/size.x),sz=Math.min(sy,limit.depthPerHeight*.99/size.z);
 g.scale.set(sx,sy,sz);g.position.set(-c.x*sx,-b.min.y*sy,-c.z*sz);return g;
}

// --- starport collection ----------------------------------------------------
// A wide console with a floating display and an exposed cable spine.
function cyberComputerscreen(g){
 box(g,.62,.045,.3,0,.025,0,'dark');cyl(g,.04,.065,.36,0,.22,-.035);box(g,1.33,.56,.08,0,.70,-.06,'dark',.06);
 box(g,1.23,.46,.015,0,.70,-.012,'glass',.035);
 for(let i=0;i<7;i++)box(g,.46-i*.023,.012,.006,-.25,.86-i*.046,0,i===0?'light':'metal',.002);
 for(let i=0;i<4;i++)box(g,.045,.09+i*.045,.008,.29+i*.08,.57+i*.022,0,'light',.004);
 box(g,1.12,.012,.016,0,.44,-.005,'light');
}
// Cantilevered task chair: one bent shell on a cross-foot, no chair legs.
function cyberChairdesk(g){
 cyl(g,.22,.25,.045,0,.03,0,'dark');cyl(g,.034,.06,.31,0,.20,0);
 box(g,.51,.13,.48,0,.43,0,'seat',.06);const back=box(g,.48,.51,.12,0,.72,-.19,'shell',.05);back.rotation.x=-.12;
 box(g,.38,.30,.035,0,.73,-.112,'seat',.025);for(const x of [-.255,.255]){box(g,.05,.06,.32,x,.62,0,'dark');box(g,.03,.23,.035,x,.52,-.03);}
 for(let i=0;i<5;i++){const a=i*Math.PI*.4;box(g,.055,.04,.19,Math.cos(a)*.15,.065,Math.sin(a)*.15,'metal').rotation.y=-a+Math.PI/2;}
}
// Bridge desk: a single machined slab on two splayed blade legs with a cable tray.
function cyberDesk(g){
 box(g,1.88,.09,1.0,0,.95,0,'shell',.045);box(g,1.72,.04,.85,0,.885,0,'dark');
 for(const x of [-.7,.7]){const leg=box(g,.14,.82,.7,x,.45,0,'dark',.05);leg.rotation.z=x>0?-.13:.13;box(g,.22,.035,.76,x,.035,0,'metal');}
 box(g,1.65,.018,.018,0,.94,.505,'light');box(g,.38,.50,.65,.61,.61,-.06,'shell');for(const y of [.49,.65,.8])box(g,.27,.012,.02,.61,y,.272,'metal');
}
// Modular lounge sofa: one continuous plinth, floating seat cushions, light skirt.
function cyberLoungedesignsofa(g){
 box(g,2.69,.19,.94,0,.22,0,'dark',.08);box(g,2.75,.49,.18,0,.72,-.41,'shell',.07);
 for(const x of [-1.26,1.26])box(g,.18,.62,.94,x,.53,0,'shell',.08);
 for(const x of [-.79,0,.79]){box(g,.76,.19,.72,x,.43,.055,'seat',.075);const p=box(g,.74,.42,.17,x,.72,-.28,'seat',.07);p.rotation.x=-.1;}
 for(const x of [-1.08,1.08])for(const z of [-.32,.32])cyl(g,.028,.042,.15,x,.075,z);
 tube(g,[[-1.22,.23,.48],[0,.23,.49],[1.22,.23,.48]],.012);
}
// Cantilevered lounge chair: bent upholstered J-shell on two steel rails with a
// rear counterweight, instead of four legs. Cyan strip lights the underside.
function cyberLoungedesignchair(g){
 profile(g,s=>{
  s.moveTo(-.46,.36);s.lineTo(-.45,.29);
  s.bezierCurveTo(-.22,.26,.04,.26,.18,.33);
  s.bezierCurveTo(.34,.44,.44,.74,.38,.94);
  s.quadraticCurveTo(.35,1.02,.26,1.00);s.quadraticCurveTo(.16,.98,.15,.86);
  s.bezierCurveTo(.14,.66,.02,.48,-.42,.46);s.closePath();
 },.90,'shell',0,0,0,.014);
 box(g,.74,.13,.54,0,.49,.10,'seat',.06);
 const pad=box(g,.70,.40,.11,0,.72,-.16,'seat',.05);pad.rotation.x=-.16;
 for(const x of [-.43,.43])slab(g,.04,.05,.82,x,.14,.02,'metal');
 box(g,.20,.16,.16,0,.16,-.37,'dark',.03);
 cyl(g,.025,.025,.78,0,.09,.42,'metal',10,0,0,Math.PI/2);
 slab(g,.68,.012,.018,0,.285,.43,'light');
 for(const x of [-.43,.43])slab(g,.10,.024,.14,x,.045,.34,'dark');
}
// Modular kitchen bay: lower carcass, cantilevered counter, asymmetric open
// hutch that hangs off one machined side plate.
function cyberKitchencabinet(g){
 box(g,.88,.50,.52,0,.28,0,'shell',.035);box(g,.78,.08,.44,0,.04,0,'dark',.02);
 slab(g,.98,.055,.62,0,.585,0,'metal');
 box(g,.86,.34,.03,0,.80,-.20,'shell',.012);
 for(const y of [.72,.90])slab(g,.86,.022,.30,0,y,-.20,'metal');
 slab(g,.03,.36,.30,.43,.81,-.20,'shell');
 for(const x of [-.22,.22]){box(g,.40,.38,.025,x,.31,.265,'dark',.012);slab(g,.18,.016,.016,x,.44,.284,'light');}
 slab(g,.012,.38,.006,0,.31,.286,'dark');
 slab(g,.80,.012,.02,0,.548,.30,'light');
 slab(g,.34,.19,.24,-.24,.735,.03,'dark');
 slab(g,.30,.012,.012,-.24,.815,.152,'light');
 for(const x of [-.36,.36])slab(g,.08,.03,.44,x,.015,0,'metal');
}
// Capsule machine: angled body, cantilevered group head with a light ring,
// glass reservoir and a slatted drip tray.
function cyberKitchencoffeemachine(g){
 box(g,.82,.06,.62,0,.03,0,'dark',.02);
 profile(g,s=>{s.moveTo(.28,.06);s.lineTo(-.26,.06);s.lineTo(-.26,.40);s.lineTo(-.10,.51);s.lineTo(.19,.47);s.lineTo(.28,.12);s.closePath();},.58,'shell',0,0,0,.012);
 box(g,.50,.15,.36,0,.585,-.02,'shell',.035);
 slab(g,.30,.014,.012,0,.652,-.115,'light');
 cyl(g,.075,.075,.14,0,.42,.34,'metal',14);
 slab(g,.13,.028,.13,0,.335,.35,'dark');
 slab(g,.16,.026,.028,0,.335,.44,'metal');
 ring(g,.098,.009,'light',4,24,0,.315,.34);
 slab(g,.50,.035,.34,0,.075,.30,'metal');
 for(let i=0;i<4;i++)slab(g,.46,.008,.02,0,.098,.18+i*.07,'dark');
 box(g,.16,.30,.11,.22,.20,-.18,'glass',.02);
 lathe(g,[[0,0],[.055,0],[.05,.11],[0,.11]],0,.10,.34,'shell',12);
 cyl(g,.018,.018,.34,-.30,.28,-.02,'metal',8);
}
// Data folios: a stack of hard-backed volumes with lit spines and one open
// reference book, on a shallow machined tray.
function cyberBooks(g){
 box(g,.95,.055,.68,0,.028,0,'dark',.02);
 const tones=['seat','shell','dark','metal','seat','shell'];
 for(let i=0;i<6;i++){const y=.075+i*.112,a=(i%2?-.06:.05);slab(g,.86,.105,.56,-.01,y,0,tones[i],0,a);slab(g,.79,.075,.50,-.005,y+.006,-.01,'shell',0,a);slab(g,.80,.012,.012,-.01,y+.028,.283,'light');}
 slab(g,.40,.022,.50,-.13,.745,.03,'seat',-.22,0);
 slab(g,.40,.022,.50,.13,.745,.03,'seat',.22,0);
 slab(g,.38,.014,.46,-.13,.765,.03,'shell',-.22,0);
 slab(g,.38,.014,.46,.13,.765,.03,'shell',.22,0);
 slab(g,.035,.022,.46,0,.742,.03,'dark');
}
// Open laptop: extruded wedge base, floating lid, lit keyboard rows.
function cyberLaptop(g){
 profile(g,s=>{s.moveTo(-.36,.02);s.lineTo(.36,.02);s.lineTo(.36,.075);s.lineTo(.30,.10);s.lineTo(-.34,.09);s.closePath();},1.18,'dark',0,0,0,.012);
 slab(g,1.06,.012,.60,0,.098,.01,'metal');
 slab(g,.82,.012,.34,0,.108,-.01,'dark');
 for(let i=0;i<4;i++)slab(g,.72,.006,.012,-.03,.118+i*.055,.10-i*.035,'light');
 slab(g,.28,.008,.17,-.02,.104,.225,'metal');
 cyl(g,.026,.026,1.08,0,.10,-.30,'metal',10,0,0,Math.PI/2);
 const lid=box(g,1.14,.72,.028,0,.50,-.36,'shell',.025);lid.rotation.x=-.30;
 const screen=slab(g,1.02,.60,.010,0,.52,-.335,'glass');screen.rotation.x=-.30;
 slab(g,1.06,.010,.012,0,.215,-.335,'light',-0.30);
 for(const x of [-.40,.40])slab(g,.10,.018,.10,x,.015,.28,'dark');
}
// Hydroponic table planter: lathed vessel, glowing rim, blade leaves.
function cyberPlantSmall(g){
 lathe(g,[[0,0],[.13,0],[.15,.02],[.16,.20],[.15,.22],[0,.22]],0,0,0,'shell',12);
 ring(g,.155,.008,'light',4,24,0,.22,0);
 const leaves=[[.02,.22,.02,.1,.52,-.4],[.05,.22,-.03,.9,.48,.1],[-.04,.22,.04,2.1,.56,.2],[.01,.22,-.05,3.2,.44,-.2],[-.02,.22,.01,4.3,.54,.3],[.03,.22,.04,5.3,.50,-.1],[-.01,.22,-.01,0.7,.58,.15]];
 for(const [x,y,z,ry,h,tilt]of leaves){
  const top=y+h;
  const leaf=profile(g,s=>{s.moveTo(0,0);s.lineTo(.10,.22);s.lineTo(-.03,.26);s.closePath();},.014,'seat',x,top,z,0,2);
  leaf.rotation.set(tilt,ry,0);
  cyl(g,.007,.005,h,x,y+h/2,z,'dark',6,0,0,-tilt*.6);
 }
 for(let i=0;i<3;i++)slab(g,.05,.014,.03,-.09+i*.05,.012,.10,'dark');
}
// Vertical hydroponic column: three cantilevered growth trays on a machined
// spine, narrow enough for corridor corners.
function cyberPottedPlant(g){
 lathe(g,[[0,0],[.14,0],[.16,.02],[.12,.40],[.10,.42],[0,.42]],0,0,0,'shell',14);
 slab(g,.035,.86,.035,0,.50,-.105,'metal');
 for(let i=0;i<3;i++){const y=.46+i*.17;cyl(g,.12,.105,.022,0,y,0,'dark',12);ring(g,.115,.006,'light',4,20,0,y+.012,0);}
 ring(g,.155,.01,'light',4,24,0,.425,0);
 tube(g,[[.10,.08,.06],[.11,.36,.05],[.02,.74,.02],[0,.90,0]],.012,'metal',10,4);
 for(let i=0;i<9;i++){const a=i*1.4;const y=.48+(i%4)*.11;const leaf=profile(g,s=>{s.moveTo(0,0);s.lineTo(.075,.19);s.lineTo(-.035,.23);s.closePath();},.012,i%2?'seat':'shell',Math.cos(a)*.085,y,Math.sin(a)*.085,0,2);leaf.rotation.set(.45,a,0);}
}
// Open shelf wall: one machined spine with five cantilevered bays, lit undersides.
function cyberBookcaseopen(g){
 box(g,.085,1,.30,-.19,.50,0,'dark',.012);
 for(let i=0;i<5;i++){const y=.018+i*.243;slab(g,.44,.026,.30,-.015,y,0,'shell');slab(g,.40,.006,.012,-.02,y-.019,.138,'light');}
 slab(g,.024,.19,.28,-.055,.145,0,'metal');
 slab(g,.024,.19,.28,.075,.388,0,'metal');
 const books=[[.045,.15,'seat'],[.09,.13,'dark'],[.135,.17,'metal'],[.19,.14,'seat']];
 for(const shelfY of [.10,.35,.60]){
  for(const [dx,h,tone]of books)slab(g,.034,h,.15,-.10+dx,shelfY+h/2+.032,.02,tone);
 }
 slab(g,.44,.012,.30,-.015,.995,0,'metal');
 for(const x of [-.20,.16])slab(g,.07,.022,.08,x,.011,.06,'metal');
}
// Bridge coffee table: a dished top ringed by a light band on a tapered column.
function cyberTablecoffee(g){
 cyl(g,.64,.43,.12,0,.86,0,'shell');const ringMesh=new T.Mesh(new T.TorusGeometry(.58,.02,6,48),mats.light);ringMesh.rotation.x=Math.PI/2;ringMesh.position.y=.80;g.add(ringMesh);
 cyl(g,.22,.35,.7,0,.42,0,'dark');cyl(g,.55,.57,.065,0,.035,0,'metal');
}

function cyberModel(id){
 const g=new T.Group();g.name='atelier-cyber-'+id;
 if(id==='computerscreen')cyberComputerscreen(g);
 else if(id==='chairdesk')cyberChairdesk(g);
 else if(id==='desk')cyberDesk(g);
 else if(id==='loungedesignsofa')cyberLoungedesignsofa(g);
 else if(id==='loungedesignchair')cyberLoungedesignchair(g);
 else if(id==='tablecoffee')cyberTablecoffee(g);
 else if(id==='bookcaseopen')cyberBookcaseopen(g);
 else if(id==='books')cyberBooks(g);
 else if(id==='laptop')cyberLaptop(g);
 else if(id==='kitchencabinet')cyberKitchencabinet(g);
 else if(id==='kitchencoffeemachine')cyberKitchencoffeemachine(g);
 else if(id==='plantsmall1')cyberPlantSmall(g);
 else if(id==='pottedplant')cyberPottedPlant(g);
 else throw new Error('未知星港家具：'+id);
 return normalize(g,id);
}

// --- warm-wood collection ---------------------------------------------------
// Turned oak, upholstery, rattan, terracotta. Colors are reset after the cyber
// export so both collections share the same draw-reduction pipeline but never
// reuse the same geometry.
function useWarmPalette(){
 Object.assign(palette,{shell:'#c8a677',dark:'#6f5944',seat:'#899b78',metal:'#aa8c5d',light:'#d9bd87',glass:'#314b43',gold:'#b78558',clay:'#b3674a'});
 for(const [key,color]of Object.entries(palette)){mats[key].color.set(color);mats[key].metalness=key==='metal'?.35:0;mats[key].roughness=key==='clay'?.85:.7;mats[key].emissiveIntensity=key==='light'?.08:0;}
}
const leafMats=['#88a271','#5b7757'].map(color=>new T.MeshStandardMaterial({color,roughness:.85,side:T.DoubleSide}));

// Kidney-shaped writing table on four turned legs.
function warmDesk(g){
 const shape=new T.Shape();shape.moveTo(-.9,-.38);shape.bezierCurveTo(-1.0,.15,-.85,.49,-.45,.5);shape.bezierCurveTo(0,.52,.18,.27,.52,.42);shape.bezierCurveTo(.98,.58,1.03,-.2,.82,-.4);shape.bezierCurveTo(.4,-.6,-.5,-.5,-.9,-.38);
 const top=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.07,steps:1,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:3,curveSegments:16}),mats.shell);top.rotation.x=Math.PI/2;top.position.y=.98;g.add(top);
 for(const x of [-.7,.7])for(const z of [-.3,.28]){const leg=cyl(g,.045,.025,.85,x,.45,z,'dark',12);leg.rotation.z=x*.12;}
 box(g,.48,.15,.45,.5,.81,-.02,'shell');box(g,.2,.02,.02,.5,.81,.22,'metal');
}
// Upholstered desk chair on a swivel column with a five-star oak foot.
function warmChairdesk(g){
 cyl(g,.035,.06,.4,0,.23,0,'dark');for(let i=0;i<5;i++){const a=i*Math.PI*.4;box(g,.035,.035,.2,Math.cos(a)*.15,.04,Math.sin(a)*.15,'dark').rotation.y=-a+Math.PI/2;}
 box(g,.51,.13,.49,0,.46,0,'seat',.065);const back=box(g,.50,.5,.13,0,.73,-.19,'seat',.065);back.rotation.x=-.12;
 for(const x of [-.24,.24]){box(g,.04,.28,.035,x,.58,-.03,'metal');box(g,.065,.05,.28,x,.72,.02,'dark');}
 for(const y of [.60,.72,.84])box(g,.36,.006,.009,0,y,-.11,'shell',.001);
}
// Loose-cushion sofa on a wood plinth with turned front feet.
function warmLoungedesignsofa(g){
 box(g,2.7,.15,.94,0,.28,0,'dark');box(g,2.63,.5,.18,0,.73,-.38,'seat',.08);
 for(const x of [-1.27,1.27]){box(g,.18,.5,.97,x,.60,0,'seat',.08);}
 for(const x of [-.79,0,.79]){box(g,.76,.22,.73,x,.45,.08,'seat',.075);const cushion=box(g,.75,.43,.20,x,.73,-.23,'seat',.07);cushion.rotation.x=-.14;}
 for(const x of [-1.08,1.08])for(const z of [-.33,.33]){const leg=cyl(g,.03,.025,.19,x,.095,z,'metal');leg.rotation.z=x*.06;}
}
// Oval coffee table on splayed turned legs.
function warmTablecoffee(g){
 const top=cyl(g,.75,.75,.12,0,.9,0,'shell',20);top.scale.set(1.5,1,1);
 for(const x of [-.65,.65])for(const z of [-.38,.38]){const leg=cyl(g,.045,.025,.83,x,.44,z,'dark',10);leg.rotation.z=x*.2;}
}
// Tall sculptural plant in a glazed pot.
function warmPottedplant(g){
 cyl(g,.105,.08,.22,0,.11,0,'shell');cyl(g,.09,.09,.015,0,.225,0,'dark');
 for(let i=0;i<22;i++){const y=.3+i*.03,a=i*2.4;const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.06,.07,-.065,.13,0,.18);leafShape.bezierCurveTo(.07,.13,.06,.04,0,0);const leaf=new T.Mesh(new T.ShapeGeometry(leafShape,6),leafMats[i%2]);leaf.rotation.set(.45,a,(i%3-1)*.6);leaf.position.set(Math.cos(a)*.045,y,Math.sin(a)*.045);g.add(leaf);}
 cyl(g,.009,.012,.68,0,.56,0,'dark');
}
// Oak-framed monitor with a woven speaker panel, on two turned legs and a
// stretcher shelf. Deliberately not the starport console silhouette.
function warmComputerscreen(g){
 frame(g,1.14,.66,1.00,.52,.075,.06,'shell',0,.66,0);
 slab(g,1.00,.52,.012,0,.66,.028,'glass');
 slab(g,.92,.55,.035,0,.66,-.035,'dark');
 slab(g,.56,.075,.018,0,.30,.03,'dark');
 for(const x of [-.44,.44]){const leg=cyl(g,.032,.018,.30,x,.15,-.02,'dark',10);leg.rotation.z=x>0?-.16:.16;slab(g,.14,.022,.24,x,.011,-.02,'dark');}
 slab(g,.60,.035,.14,0,.17,-.06,'shell');
 for(const x of [-.50,.50])slab(g,.05,.05,.05,x,.70,.055,'gold');
}
// Tub lounge chair: a bent upholstered shell, rolled arms, piping, four turned
// oak legs. Not a recolored starport cantilever chair.
function warmLoungedesignchair(g){
 profile(g,s=>{
  s.moveTo(-.44,.32);s.lineTo(-.40,.27);
  s.bezierCurveTo(-.20,.25,.10,.25,.30,.30);
  s.bezierCurveTo(.44,.38,.48,.66,.44,.86);
  s.quadraticCurveTo(.41,.98,.32,.99);s.quadraticCurveTo(.22,.99,.19,.88);
  s.bezierCurveTo(.17,.68,.02,.47,-.40,.45);s.closePath();
 },.94,'seat',0,0,0,.016);
 box(g,.70,.13,.52,0,.42,.08,'seat',.06);
 const back=box(g,.66,.42,.12,0,.68,-.18,'seat',.06);back.rotation.x=-.18;
 for(const x of [-.45,.45])cyl(g,.065,.065,.56,x,.62,0,'seat',12,Math.PI/2,0,0);
 const piping=new T.CatmullRomCurve3([new T.Vector3(-.40,.90,-.05),new T.Vector3(-.10,.99,-.20),new T.Vector3(.22,.96,-.05)]);
 g.add(new T.Mesh(new T.TubeGeometry(piping,10,.010,4,false),mats.gold));
 for(const x of [-.34,.34])for(const z of [-.28,.30]){lathe(g,[[0,0],[.026,.02],[.030,.10],[.020,.24],[.026,.30]],x,.0,z,'dark',8);}
}
// Oak open shelving with a rattan back, five bays and a few cloth books.
function warmBookcaseopen(g){
 for(const x of [-.215,.215]){box(g,.036,.99,.30,x,.495,0,'shell',.012);slab(g,.05,.05,.32,x,.01,0,'dark');}
 for(const y of [.025,.27,.515,.76,.975])slab(g,.46,.028,.30,0,y,0,'shell');
 slab(g,.40,.015,.012,-.015,.60,.145,'gold');
 for(let r=0;r<4;r++)for(let c=0;c<5;c++)slab(g,.44,.014,.008,0,.045+r*.05,-.146,'gold');
 for(const x of [-.07,.07])slab(g,.018,.21,.28,x,.16,0,'dark');
 for(const row of [.08,.32,.57])for(let i=0;i<4;i++){const h=.11+((i+row*3)%3)*.02;slab(g,.032,h,.13,-.12+i*.075,row+h/2+.03,.03,i%2?'seat':'dark');}
 slab(g,.42,.02,.28,0,.99,0,'shell');
}
// Cloth-bound book stack with page blocks, brass corners and a ribbon.
function warmBooks(g){
 const tones=['seat','shell','dark','metal','seat','dark'];
 for(let i=0;i<6;i++){const y=.05+i*.125,a=(i%2?-.07:.05);slab(g,.80,.026,.56,0,y,0,tones[i],0,a);slab(g,.76,.088,.52,0,y+.058,.004,'light',0,a);slab(g,.80,.026,.56,0,y+.117,0,tones[i],0,a);}
 slab(g,.34,.018,.48,-.16,.82,.02,'seat',-.20,0);slab(g,.34,.018,.48,.16,.82,.02,'seat',.20,0);
 slab(g,.32,.012,.44,-.16,.837,.02,'shell',-.20,0);slab(g,.32,.012,.44,.16,.837,.02,'shell',.20,0);
 slab(g,.026,.018,.44,0,.816,.02,'dark');
 tube(g,[[.02,.76,.25],[.10,.72,.30],[.16,.62,.31]],.008,'clay',8,3);
}
// Walnut clamshell laptop: rounded lid, felt deck, brass hinge.
function warmLaptop(g){
 box(g,1.00,.07,.66,0,.045,0,'shell',.028);
 slab(g,.94,.012,.58,0,.083,.0,'dark');
 for(let i=0;i<5;i++)slab(g,.72,.008,.030,0,.092+i*.042,.09-i*.032,'shell');
 slab(g,.24,.008,.14,0,.09,.235,'metal');
 cyl(g,.024,.024,.96,0,.085,-.30,'gold',10,0,0,Math.PI/2);
 const lid=box(g,.98,.66,.038,0,.42,-.33,'shell',.03);lid.rotation.x=-.26;
 const screen=slab(g,.88,.55,.010,0,.43,-.305,'glass');screen.rotation.x=-.26;
 slab(g,.90,.008,.012,0,.16,-.305,'gold',-0.26);
 slab(g,.10,.014,.05,0,.02,.30,'gold');
 for(const x of [-.38,.38])slab(g,.10,.02,.10,x,.012,.24,'dark');
}
// Oak base cabinet: terracotta tile counter, rattan door panels, brass pulls,
// open hutch with two jars. Reads as joinery, not a recolored starport bay.
function warmKitchencabinet(g){
 box(g,.84,.52,.50,0,.30,0,'shell',.03);
 slab(g,.94,.06,.60,0,.60,0,'clay');
 for(const x of [-.22,.22]){box(g,.36,.42,.035,x,.33,.262,'shell',.018);
  for(let i=0;i<5;i++)slab(g,.30,.012,.010,x,.19+i*.065,.283,'gold');
  tube(g,[[x-.05,.44,.29],[x,.40,.30],[x+.05,.44,.29]],.010,'gold',8,3);
 }
 slab(g,.012,.42,.006,0,.33,.285,'dark');
 slab(g,.84,.05,.03,0,.585,.27,'clay');
 box(g,.78,.32,.026,0,.83,-.21,'shell',.012);
 for(const y of [.73,.915])slab(g,.78,.020,.24,0,y,-.21,'shell');
 slab(g,.78,.018,.26,0,1,-.20,'shell');
 for(const x of [-.36,.36])slab(g,.03,.34,.30,x,.83,-.20,'shell');
 lathe(g,[[0,0],[.045,0],[.05,.06],[.045,.11],[0,.11]],-.18,.755,-.21,'clay',10);
 lathe(g,[[0,0],[.038,0],[.042,.05],[.036,.09],[0,.09]],-.05,.755,-.21,'glass',10);
 for(const x of [-.30,.30]){const leg=lathe(g,[[0,0],[.022,.01],[.028,.10],[.020,.16],[.026,.19]],x,0,.20,'dark',8);leg.rotation.z=x>0?-.08:.08;}
 slab(g,.80,.04,.02,0,.10,.21,'dark');
}
// Retro lever espresso machine: copper tank, enamel body, portafilter, cup and
// steam wand, on a warm oak plinth.
function warmKitchencoffeemachine(g){
 box(g,.78,.06,.56,0,.03,0,'dark',.02);
 lathe(g,[[0,0],[.25,0],[.27,.08],[.25,.34],[.20,.42],[.20,.46],[0,.46]],0,.06,-.02,'gold',16);
 lathe(g,[[0,0],[.205,0],[.19,.10],[.10,.15],[0,.16]],0,.52,-.02,'shell',12);
 cyl(g,.07,.07,.14,0,.36,.32,'gold',14);
 slab(g,.12,.028,.12,0,.285,.33,'dark');
 slab(g,.17,.025,.026,0,.285,.42,'dark');
 slab(g,.028,.028,.46,0,.50,.30,'metal',.55,0,0);
 slab(g,.05,.05,.05,0,.60,.46,'gold');
 slab(g,.46,.03,.34,0,.075,.28,'metal');
 for(let i=0;i<4;i++)slab(g,.42,.008,.018,0,.096,.16+i*.07,'dark');
 lathe(g,[[0,0],[.052,0],[.047,.10],[0,.10]],0,.10,.34,'shell',12);
 tube(g,[[.28,.42,.10],[.38,.34,.22],[.44,.20,.14]],.010,'metal',8,3);
 cyl(g,.045,.045,.02,-.22,.38,.22,'gold',12,Math.PI/2,0,0);
 slab(g,.012,.05,.05,-.22,.38,.265,'glass');
 for(const x of [-.26,.26])for(const z of [-.18,.18])cyl(g,.024,.02,.05,x,.10,z,'dark',8);
}
// Terracotta herb pot with broad leaves and a saucer.
function warmPlantSmall(g){
 lathe(g,[[0,0],[.105,0],[.125,.02],[.14,.20],[.16,.22],[.16,.25],[.145,.26],[0,.26]],0,0,0,'clay',12);
 lathe(g,[[0,0],[.15,0],[.16,.02],[.16,.035],[0,.035]],0,0,0,'clay',12);
 cyl(g,.135,.135,.015,0,.25,0,'dark',12);
 for(let i=0;i<8;i++){const a=i*1.2,r=.02+(i%3)*.02;const y=.28+(i%4)*.045;const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.12,.10,-.14,.26,0,.36);leafShape.bezierCurveTo(.14,.25,.11,.09,0,0);const leaf=new T.Mesh(new T.ShapeGeometry(leafShape,5),leafMats[i%2]);leaf.rotation.set(.55,a,(i%3-1)*.5);leaf.position.set(Math.cos(a)*r,y,Math.sin(a)*r);g.add(leaf);cyl(g,.007,.005,.3,Math.cos(a)*r,y+.1,Math.sin(a)*r,'dark',6,0,0,0);}
 for(let i=0;i<3;i++)slab(g,.05,.012,.035,-.09+i*.06,.012,.11,'dark');
}

function warmModel(id){
 const g=new T.Group();g.name='atelier-warm-'+id;
 if(id==='desk')warmDesk(g);
 else if(id==='chairdesk')warmChairdesk(g);
 else if(id==='loungedesignsofa')warmLoungedesignsofa(g);
 else if(id==='computerscreen')warmComputerscreen(g);
 else if(id==='tablecoffee')warmTablecoffee(g);
 else if(id==='pottedplant')warmPottedplant(g);
 else if(id==='loungedesignchair')warmLoungedesignchair(g);
 else if(id==='bookcaseopen')warmBookcaseopen(g);
 else if(id==='books')warmBooks(g);
 else if(id==='laptop')warmLaptop(g);
 else if(id==='kitchencabinet')warmKitchencabinet(g);
 else if(id==='kitchencoffeemachine')warmKitchencoffeemachine(g);
 else if(id==='plantsmall1')warmPlantSmall(g);
 else throw new Error('未知暖木家具：'+id);
 return normalize(g,id);
}

// --- export -----------------------------------------------------------------
const IDS=['chairdesk','computerscreen','plantsmall1','pottedplant','loungedesignsofa','loungedesignchair','tablecoffee','bookcaseopen','books','desk','laptop','kitchencabinet','kitchencoffeemachine'];
const catalog=JSON.parse(await readFile(join(root,'asset-catalog.json'),'utf8'));
async function exportCollection(collection,buildModel,provenance){
 await mkdir(join(root,'public/furniture',collection),{recursive:true});
 const stats=[];
 for(const id of IDS){
  const object=batchModel(buildModel(id));
  const bytes=Buffer.from(await new GLTFExporter().parseAsync(object,{binary:true}));
  const {json}=inspectGLB(bytes);
  const primitives=json.meshes.flatMap(m=>m.primitives);
  const triangles=primitives.reduce((count,p)=>count+json.accessors[p.indices??p.attributes.POSITION].count/3,0);
  if(primitives.length>8)throw new Error(`${collection}/${id} 超过8个绘制批次`);
  if(triangles>1800)throw new Error(`${collection}/${id} 超过1800三角面上限：${triangles}`);
  const path='furniture/'+collection+'/'+id+'.glb';
  await writeFile(join(root,'public',path),bytes);
  const item={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),license:'MIT',source:'https://github.com/Handsome5201314/company-visual-studio',provenance};
  const i=catalog.findIndex(x=>x.path===path);if(i<0)catalog.push(item);else catalog[i]=item;
  stats.push({id,bytes:bytes.length,primitives:primitives.length,triangles});
  console.log(`${collection}/${id}`.padEnd(30),String(bytes.length).padStart(7),'B  draws',String(primitives.length).padStart(2),' tris',String(triangles).padStart(4));
 }
 return stats;
}
const cyberStats=await exportCollection('cyber',cyberModel,'Authored starport furniture: cantilevered steel frames, modular bays and integrated light bars; independently modeled, no copied third-party geometry.');
useWarmPalette();
const warmStats=await exportCollection('warm',warmModel,'Authored warm-wood furniture: turned oak, upholstered shells, rattan panels and terracotta; independently modeled, no copied third-party geometry.');
await writeFile(join(root,'asset-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
const all=[...cyberStats,...warmStats];
console.log(`\n${all.length} authored props written; max draws ${Math.max(...all.map(s=>s.primitives))}, max triangles ${Math.max(...all.map(s=>s.triangles))}, max bytes ${Math.max(...all.map(s=>s.bytes))}.`);
