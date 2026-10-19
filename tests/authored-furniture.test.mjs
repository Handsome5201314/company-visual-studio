import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inspectGLB} from '../src/glb.js';
import budgets from '../src/model-budgets.json' with {type:'json'};
import {MODEL_IDS,THEMES} from '../src/theme.js';

const COLLECTIONS=[
 {id:'warm',theme:'default',label:'暖木'},
 {id:'cyber',theme:'cyber',label:'星港'}
];

test('both authored collections ship all 13 model ids with independent meshes',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../asset-catalog.json',import.meta.url),'utf8'));
 const authored=catalog.filter(a=>/^furniture\/(warm|cyber)\/[a-z0-9]+\.glb$/.test(a.path));
 assert.equal(authored.length,MODEL_IDS.length*COLLECTIONS.length);
 const byPath=new Map(authored.map(a=>[a.path,a]));
 const signatures={};
 for(const {id:collection}of COLLECTIONS){
  signatures[collection]={};
  for(const id of MODEL_IDS){
   const assetPath=`furniture/${collection}/${id}.glb`;
   const asset=byPath.get(assetPath);
   assert.ok(asset,assetPath+' missing from asset-catalog');
   assert.equal(asset.license,'MIT');
   assert.match(asset.provenance,/Authored/);
   const bytes=await readFile(new URL('../public/'+assetPath,import.meta.url));
   assert.equal(asset.bytes,bytes.length,assetPath+' catalog byte count is stale');
   // Parse through the actual runtime loader so a valid container with broken
   // mesh data cannot pass as a shippable authored asset.
   const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
   let loadedMeshes=0;gltf.scene.traverse(object=>{if(object.isMesh)loadedMeshes++;});
   assert.ok(loadedMeshes>=1,assetPath+' must load at least one mesh');
   const {json,skins,clips}=inspectGLB(bytes);
   assert.equal(skins,0);assert.equal(clips.length,0);
   const primitives=json.meshes.flatMap(m=>m.primitives);
   assert.ok(primitives.length<=8,assetPath+' has too many static draw parts');
   const triangles=primitives.reduce((count,p)=>count+json.accessors[p.indices??p.attributes.POSITION].count/3,0);
   // The product hard cap is 3000; this suite holds the authored set to the
   // tighter 1800-triangle working target.
   assert.ok(triangles<=1800,assetPath+' exceeds the 1800 triangle authored target');
   const positions=primitives.map(p=>json.accessors[p.attributes.POSITION]);
   const min=[0,1,2].map(i=>Math.min(...positions.map(p=>p.min[i])));
   const max=[0,1,2].map(i=>Math.max(...positions.map(p=>p.max[i])));
   // Normalization measures exact vertex bounds, so the authored prop reaches
   // the 1m height and never crosses the admitted per-id envelope.
   assert.ok(min[1]>=-1e-5&&max[1]<=1+1e-5&&max[1]-min[1]>=.95,assetPath+' normalized height envelope');
   assert.ok(max[0]-min[0]<=budgets[id].widthPerHeight+1e-5,assetPath+' width');
   assert.ok(max[2]-min[2]<=budgets[id].depthPerHeight+1e-5,assetPath+' depth');
   signatures[collection][id]=[primitives.length,triangles,positions.reduce((count,p)=>count+p.count,0)];
  }
 }
 // Each collection is authored from its own profiles. A recolored duplicate
 // would share the exact primitive/triangle/vertex signature.
 for(const id of MODEL_IDS){
  assert.notDeepEqual(signatures.warm[id],signatures.cyber[id],id+' reuses the same mesh in both collections');
 }
});

test('shipped themes map every model id to a complete collection at version 1.2.0',()=>{
 for(const {id:collection,theme}of COLLECTIONS){
  const shipped=THEMES.find(t=>t.id===theme);
  assert.ok(shipped,theme+' theme is missing');
  assert.equal(shipped.version,'1.2.0');
  assert.equal(Object.keys(shipped.models).length,MODEL_IDS.length);
  for(const id of MODEL_IDS){
   assert.equal(shipped.models[id],`furniture/${collection}/${id}.glb`,theme+' must resolve '+id+' inside its own collection');
   assert.ok(shipped.assets.includes(`furniture/${collection}/${id}.glb`),theme+' assets must include '+id);
  }
  assert.equal(shipped.assets.length,MODEL_IDS.length);
  assert.equal(new Set(shipped.assets).size,MODEL_IDS.length);
 }
});
