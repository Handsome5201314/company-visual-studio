import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,validateTheme,assetPath} from '../src/theme.js';
import {validateAssets} from '../tools/validate-assets.mjs';
import {inspectGLB} from '../src/glb.js';
import {previewAPI} from '../apps/showroom/fixtures.ts';
test('both shipped themes validate, differ in rendering, and preserve the layout contract',()=>{assert.equal(THEMES.length,2);for(const t of THEMES)assert.equal(validateTheme(t).compatibleContract,'hq-fixed-layout-v1');assert.notEqual(THEMES[0].environment.background,THEMES[1].environment.background);assert.notEqual(THEMES[0].ui.paper,THEMES[1].ui.paper);assert.ok(validateAssets()>=13);});
test('themes cannot change layout, load scripts/remote paths, smuggle CSS or declare unknown models',()=>{
 const change=mutate=>{const t=structuredClone(THEMES[0]);mutate(t);assert.throws(()=>validateTheme(t));};
 change(t=>t.layout={});change(t=>t.compatibleContract='new-map');change(t=>t.ui.paper='url(https://example.com)');change(t=>t.environment.sun=Infinity);change(t=>t.models.unknown='furniture/x.glb');change(t=>t.models.desk='https://example.com/x.glb');change(t=>t.models.desk='furniture/custom.glb');
 for(const p of ['../x.glb','furniture/../x.glb','//host/x.glb','furniture/%2e%2e/x.glb','data:abc'])assert.throws(()=>assetPath(p));
});
test('self-contained GLB admission rejects external resources and truncated files',()=>{
 function glb(json){let text=JSON.stringify(json);text+=' '.repeat((4-text.length%4)%4);const bytes=Buffer.alloc(20+Buffer.byteLength(text));bytes.writeUInt32LE(0x46546c67);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(bytes.length-20,12);bytes.writeUInt32LE(0x4e4f534a,16);bytes.write(text,20);return bytes;}
 assert.equal(inspectGLB(glb({asset:{version:'2.0'},nodes:[]})).nodes,0);
 for(const json of [{buffers:[{uri:'https://example.com/private'}]},{images:[{uri:'file:///private'}]}])assert.throws(()=>inspectGLB(glb(json)),/外部/);
 assert.throws(()=>inspectGLB(Buffer.alloc(100)));assert.throws(()=>inspectGLB(glb({}).subarray(0,19)));
});
test('showroom data stays synthetic and all account, publication and payment writes are rejected',async()=>{
 const api=previewAPI('author');assert.equal((await api('/auth/me')).account.id,'demo-author');
 for(const path of ['/auth/login','/articles','/employee/control','/payments'])await assert.rejects(api(path,'POST',{}),/展厅演示/);
 await assert.rejects(api('/private-company-data'),/未实现/);
});
