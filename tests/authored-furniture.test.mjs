import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectGLB} from '../src/glb.js';
import budgets from '../src/model-budgets.json' with {type:'json'};

test('authored static props fit interaction envelopes and bounded material draw costs',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../asset-catalog.json',import.meta.url),'utf8'));
 const authored=catalog.filter(a=>/^furniture\/(warm|cyber)\//.test(a.path));
 assert.equal(authored.length,12);
 for(const asset of authored){
  const {json,skins,clips}=inspectGLB(await readFile(new URL('../public/'+asset.path,import.meta.url)));
  assert.equal(skins,0);assert.equal(clips.length,0);
  const primitives=json.meshes.flatMap(m=>m.primitives);
  assert.ok(primitives.length<=8,asset.path+' has too many static draw parts');
  const triangles=primitives.reduce((count,p)=>count+json.accessors[p.indices??p.attributes.POSITION].count/3,0);
  assert.ok(triangles<=3000,asset.path+' exceeds the authored furniture triangle budget');
  const positions=primitives.map(p=>json.accessors[p.attributes.POSITION]);
  const min=[0,1,2].map(i=>Math.min(...positions.map(p=>p.min[i])));
  const max=[0,1,2].map(i=>Math.max(...positions.map(p=>p.max[i])));
  const id=asset.path.split('/').pop().replace('.glb','');
  // Normalization uses a conservative rotated bounding box. The exact vertices
  // can occupy slightly less than 1m, but must never cross the admitted envelope.
  assert.ok(min[1]>=-1e-5&&max[1]<=1+1e-5&&max[1]-min[1]>=.95,asset.path+' normalized height envelope');
  assert.ok(max[0]-min[0]<=budgets[id].widthPerHeight+1e-5,asset.path+' width');
  assert.ok(max[2]-min[2]<=budgets[id].depthPerHeight+1e-5,asset.path+' depth');
 }
});
