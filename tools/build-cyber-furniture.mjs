// Authored meshes, not recolored copies of the CC0 library. Source is MIT.
// Each model stays inside the existing fixed furniture envelope (height = 1m).
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {inspectGLB} from '../src/glb.js';
import budgets from '../src/model-budgets.json' with {type:'json'};
const root=fileURLToPath(new URL('..',import.meta.url));
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}};
const palette={shell:'#d5e7ed',dark:'#183247',seat:'#335c71',metal:'#819eab',light:'#71e4e3',glass:'#173f5b',gold:'#dbb375'};
const material=(key)=>new T.MeshStandardMaterial({color:palette[key],roughness:key==='metal'?.28:.5,metalness:key==='metal'?.7:.12,...(key==='light'?{emissive:palette.light,emissiveIntensity:.7}:{})});
const mats=Object.fromEntries(Object.keys(palette).map(k=>[k,material(k)]));
function box(g,w,h,d,x,y,z,key='shell',r=.04){const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mats[key]);m.position.set(x,y,z);g.add(m);return m;}
function cyl(g,r1,r2,h,x,y,z,key='metal'){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,16),mats[key]);m.position.set(x,y,z);g.add(m);return m;}
function tube(g,points,r,key='light'){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const m=new T.Mesh(new T.TubeGeometry(curve,32,r,6,false),mats[key]);g.add(m);return m;}
function model(id){const g=new T.Group();g.name='atelier-cyber-'+id;
 if(id==='computerscreen'){
  box(g,.62,.045,.3,0,.025,0,'dark');cyl(g,.04,.065,.36,0,.22,-.035);box(g,1.33,.56,.08,0,.70,-.06,'dark',.06);
  box(g,1.23,.46,.015,0,.70,-.012,'glass',.035);
  for(let i=0;i<7;i++)box(g,.46-i*.023,.012,.006,-.25,.86-i*.046,0,i===0?'light':'metal',.002);
  for(let i=0;i<4;i++)box(g,.045,.09+i*.045,.008,.29+i*.08,.57+i*.022,0,'light',.004);
  box(g,1.12,.012,.016,0,.44,-.005,'light');
 }else if(id==='chairdesk'){
  cyl(g,.22,.25,.045,0,.03,0,'dark');cyl(g,.034,.06,.31,0,.20,0);
  box(g,.51,.13,.48,0,.43,0,'seat',.06);const back=box(g,.48,.51,.12,0,.72,-.19,'shell',.05);back.rotation.x=-.12;
  box(g,.38,.30,.035,0,.73,-.112,'seat',.025);for(const x of [-.255,.255]){box(g,.05,.06,.32,x,.62,0,'dark');box(g,.03,.23,.035,x,.52,-.03);}
  for(let i=0;i<5;i++){const a=i*Math.PI*.4;box(g,.055,.04,.19,Math.cos(a)*.15,.065,Math.sin(a)*.15,'metal').rotation.y=-a+Math.PI/2;}
 }else if(id==='desk'){
  box(g,1.88,.09,1.0,0,.95,0,'shell',.045);box(g,1.72,.04,.85,0,.885,0,'dark');
  for(const x of [-.7,.7]){const leg=box(g,.14,.82,.7,x,.45,0,'dark',.05);leg.rotation.z=x>0?-.13:.13;box(g,.22,.035,.76,x,.035,0,'metal');}
  box(g,1.65,.018,.018,0,.94,.505,'light');box(g,.38,.50,.65,.61,.61,-.06,'shell');for(const y of [.49,.65,.8])box(g,.27,.012,.02,.61,y,.272,'metal');
 }else if(id==='loungedesignsofa'){
  box(g,2.69,.19,.94,0,.22,0,'dark',.08);box(g,2.75,.49,.18,0,.72,-.41,'shell',.07);
  for(const x of [-1.26,1.26])box(g,.18,.62,.94,x,.53,0,'shell',.08);
  for(const x of [-.79,0,.79]){box(g,.76,.19,.72,x,.43,.055,'seat',.075);const p=box(g,.74,.42,.17,x,.72,-.28,'seat',.07);p.rotation.x=-.1;}
  for(const x of [-1.08,1.08])for(const z of [-.32,.32])cyl(g,.028,.042,.15,x,.075,z);
  tube(g,[[-1.22,.23,.48],[0,.23,.49],[1.22,.23,.48]],.012);
 }else if(id==='bookcaseopen'){
  for(const x of [-.215,.215])box(g,.045,1,.30,x,.5,0,'shell',.018);
  for(const y of [.025,.28,.52,.76,.975])box(g,.46,.035,.3,0,y,0,'metal',.01);
  for(let row=0;row<3;row++)for(let col=0;col<5;col++)box(g,.037,.13+col*.009,.15,-.14+col*.06,.36+row*.245,0,col%2?'dark':'seat',.008);
 }else if(id==='tablecoffee'){
  cyl(g,.64,.43,.12,0,.86,0,'shell');const ring=new T.Mesh(new T.TorusGeometry(.58,.02,6,48),mats.light);ring.rotation.x=Math.PI/2;ring.position.y=.80;g.add(ring);
  cyl(g,.22,.35,.7,0,.42,0,'dark');cyl(g,.55,.57,.065,0,.035,0,'metal');
 }
 const b=new T.Box3().setFromObject(g),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
 const limit=budgets[id],sy=1/size.y,sx=Math.min(sy,limit.widthPerHeight*.99/size.x),sz=Math.min(sy,limit.depthPerHeight*.99/size.z);
 g.scale.set(sx,sy,sz);g.position.set(-c.x*sx,-b.min.y*sy,-c.z*sz);return g;
}
await mkdir(join(root,'public/furniture/cyber'),{recursive:true});
const catalog=JSON.parse(await readFile(join(root,'asset-catalog.json'),'utf8'));
for(const id of ['computerscreen','chairdesk','desk','loungedesignsofa','bookcaseopen','tablecoffee']){
 const object=model(id),bytes=Buffer.from(await new GLTFExporter().parseAsync(object,{binary:true}));inspectGLB(bytes);
 const path='furniture/cyber/'+id+'.glb';await writeFile(join(root,'public',path),bytes);
 const item={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),license:'MIT',source:'https://github.com/Handsome5201314/company-visual-studio',provenance:'Authored rounded-shell furniture, reproducible from tools/build-cyber-furniture.mjs; no copied third-party geometry.'};
 const i=catalog.findIndex(x=>x.path===path);if(i<0)catalog.push(item);else catalog[i]=item;
 console.log(id,bytes.length);
}
// Warm collection: turned oak legs, upholstered shells and an asymmetric
// kidney-shaped writing table, independently authored from the starport set.
await mkdir(join(root,'public/furniture/warm'),{recursive:true});
for(const [key,color]of Object.entries({shell:'#c8a677',dark:'#6f5944',seat:'#899b78',metal:'#aa8c5d',light:'#d9bd87',glass:'#314b43',gold:'#b78558'})){mats[key].color.set(color);mats[key].metalness=key==='metal'?.35:0;mats[key].roughness=.7;if(key==='light')mats[key].emissiveIntensity=.08;}
function warmModel(id){
 const g=new T.Group();g.name='atelier-warm-'+id;
 if(id==='desk'){
  const shape=new T.Shape();shape.moveTo(-.9,-.38);shape.bezierCurveTo(-1.0,.15,-.85,.49,-.45,.5);shape.bezierCurveTo(0,.52,.18,.27,.52,.42);shape.bezierCurveTo(.98,.58,1.03,-.2,.82,-.4);shape.bezierCurveTo(.4,-.6,-.5,-.5,-.9,-.38);
  const top=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.07,steps:1,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:3,curveSegments:20}),mats.shell);top.rotation.x=Math.PI/2;top.position.y=.98;g.add(top);
  for(const x of [-.7,.7])for(const z of [-.3,.28]){const leg=cyl(g,.045,.025,.85,x,.45,z,'dark');leg.rotation.z=x*.12;}
  box(g,.48,.15,.45,.5,.81,-.02,'shell');box(g,.2,.02,.02,.5,.81,.22,'metal');
 }else if(id==='chairdesk'){
  cyl(g,.035,.06,.4,0,.23,0,'dark');for(let i=0;i<5;i++){const a=i*Math.PI*.4;box(g,.035,.035,.2,Math.cos(a)*.15,.04,Math.sin(a)*.15,'dark').rotation.y=-a+Math.PI/2;}
  box(g,.51,.13,.49,0,.46,0,'seat',.065);const back=box(g,.50,.5,.13,0,.73,-.19,'seat',.065);back.rotation.x=-.12;
  for(const x of [-.24,.24]){box(g,.04,.28,.035,x,.58,-.03,'metal');box(g,.065,.05,.28,x,.72,.02,'dark');}
  for(const y of [.60,.72,.84])box(g,.36,.006,.009,0,y,-.11,'shell',.001);
 }else if(id==='loungedesignsofa'){
  box(g,2.7,.15,.94,0,.28,0,'dark');box(g,2.63,.5,.18,0,.73,-.38,'seat',.08);
  for(const x of [-1.27,1.27]){box(g,.18,.5,.97,x,.60,0,'seat',.08);}
  for(const x of [-.79,0,.79]){box(g,.76,.22,.73,x,.45,.08,'seat',.075);const cushion=box(g,.75,.43,.20,x,.73,-.23,'seat',.07);cushion.rotation.x=-.14;}
  for(const x of [-1.08,1.08])for(const z of [-.33,.33]){const leg=cyl(g,.03,.025,.19,x,.095,z,'metal');leg.rotation.z=x*.06;}
 }else if(id==='tablecoffee'){
  const top=cyl(g,.75,.75,.12,0,.9,0,'shell');top.scale.set(1.5,1,1);
  for(const x of [-.65,.65])for(const z of [-.38,.38]){const leg=cyl(g,.045,.025,.83,x,.44,z,'dark');leg.rotation.z=x*.2;}
 }else if(id==='pottedplant'){
  cyl(g,.105,.08,.22,0,.11,0,'shell');cyl(g,.09,.09,.015,0,.225,0,'dark');
  for(let i=0;i<22;i++){const y=.3+i*.03,a=i*2.4;const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.06,.07,-.065,.13,0,.18);leafShape.bezierCurveTo(.07,.13,.06,.04,0,0);const leaf=new T.Mesh(new T.ShapeGeometry(leafShape,6),new T.MeshStandardMaterial({color:i%2?'#5b7757':'#88a271',roughness:.85,side:T.DoubleSide}));leaf.rotation.set(.45,a,(i%3-1)*.6);leaf.position.set(Math.cos(a)*.045,y,Math.sin(a)*.045);g.add(leaf);}
  cyl(g,.009,.012,.68,0,.56,0,'dark');
 }else return model(id);
 const b=new T.Box3().setFromObject(g),s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3()),limit=budgets[id],sy=1/s.y,sx=Math.min(sy,limit.widthPerHeight*.99/s.x),sz=Math.min(sy,limit.depthPerHeight*.99/s.z);g.scale.set(sx,sy,sz);g.position.set(-c.x*sx,-b.min.y*sy,-c.z*sz);return g;
}
for(const id of ['desk','chairdesk','loungedesignsofa','computerscreen','tablecoffee','pottedplant']){const bytes=Buffer.from(await new GLTFExporter().parseAsync(warmModel(id),{binary:true}));inspectGLB(bytes);const path='furniture/warm/'+id+'.glb';await writeFile(join(root,'public',path),bytes);const entry={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),license:'MIT',source:'https://github.com/Handsome5201314/company-visual-studio',provenance:'Authored upholstered/oak collection; reproducible modeling source in tools/build-cyber-furniture.mjs.'};const i=catalog.findIndex(x=>x.path===path);if(i<0)catalog.push(entry);else catalog[i]=entry;console.log('warm/'+id,bytes.length);}
await writeFile(join(root,'asset-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
