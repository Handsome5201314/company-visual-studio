import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildThemePackage,createZip,effectiveModelPaths,readZipEntries} from '../src/theme-package-export.js';
import {preparePrPreview,verifyPackage,verifyPackageArchive} from '../tools/theme-package.mjs';
import {THEMES,MODEL_IDS} from '../src/theme.js';
import assetCatalog from '../asset-catalog.json' with {type:'json'};

const REPO='https://github.com/Handsome5201314/company-visual-studio';
const COMMIT='31e6f7a087c5be5943c2e329d2c9a34e2644bab7';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const LICENSE='MIT License\n\nCopyright (c) 2026 北京童医魔盒科技服务有限公司\n';
const CC0='CC0 1.0 Universal\n';

function makeGLB(json){
 let text=JSON.stringify(json);
 text+=' '.repeat((4-text.length%4)%4);
 const bytes=Buffer.alloc(20+Buffer.byteLength(text));
 bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(bytes.length-20,12);bytes.writeUInt32LE(0x4e4f534a,16);bytes.write(text,20);
 return new Uint8Array(bytes);
}

function validScene(){
 return {schemaVersion:1,compatibleContract:'hq-fixed-layout-v1',objects:[{id:'desk-a',model:'desk',position:[0,0,0],rotationY:0,scale:[1,1,1]}],lights:[{id:'lamp-a',position:[0,2,0],color:'#ffcc88',intensity:1.5,distance:4}]};
}

function packageInput(overrides={}){
 const theme=overrides.theme??THEMES[0];
 const paths=[...new Set(Object.values(effectiveModelPaths(theme)))];
 const model=makeGLB({asset:{version:'2.0'},nodes:[],meshes:[]});
 return {
  theme,scene:validScene(),preview:new Uint8Array(PNG),licenseText:LICENSE,
  modelLicense:{path:'licenses/Kenney-CC0.txt',bytes:CC0,license:'CC0-1.0',source:'https://kenney.nl/assets/furniture-kit'},
  models:paths.map(path=>({path,bytes:model,license:'CC0-1.0',source:'https://kenney.nl/assets/furniture-kit'})),
  metadata:{id:'editor-test',name:'编辑器完整包测试',author:'测试作者',version:theme.version,description:'包含真实模型、许可与预览截图的完整主题包。',styles:['warm-wood'],repository:REPO,commit:COMMIT},
  ...overrides
 };
}

async function writePackage(directory,result){
 for(const file of result.files){const target=join(directory,...file.path.split('/'));await mkdir(dirname(target),{recursive:true});await writeFile(target,file.bytes);}
 await writeFile(join(directory,'theme-package.json'),JSON.stringify(result.manifest,null,2));
}

test('editor helper builds a complete package that the host verifier accepts',async t=>{
 const result=await buildThemePackage(packageInput());
 assert.equal(result.manifest.id,'editor-test');
 assert.equal(result.manifest.themePath,'theme.json');
 assert.equal(result.manifest.scenePath,'scene.json');
 assert.equal(result.manifest.previewPath,'preview.png');
 assert.equal(result.manifest.license,'MIT');
 assert.equal(result.theme.assets.length,MODEL_IDS.length);
 assert.equal(Object.keys(result.theme.models).length,MODEL_IDS.length);
 assert.equal(result.scene.objects.length,1);
 assert.ok(result.files.some(file=>file.path==='LICENSE.txt'));
 assert.ok(result.files.some(file=>file.path==='licenses/Kenney-CC0.txt'));
 assert.ok(result.files.some(file=>file.path==='README.md'));
 assert.ok(result.files.some(file=>file.path==='preview.png'));
 for(const path of result.theme.assets)assert.ok(result.files.some(file=>file.path===path));
 assert.ok(result.manifest.files.find(file=>file.path==='README.md').bytes>100);
 assert.match(result.digest,/^sha256:[a-f0-9]{64}$/);

 const dir=await mkdtemp(join(tmpdir(),'editor-package-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await writePackage(dir,result);
 const verified=await verifyPackage(dir);
 assert.equal(verified.digest,result.digest);
 assert.equal(verified.totalBytes,result.totalBytes);
 assert.equal(verified.manifest.id,result.manifest.id);
 assert.equal(verified.theme.assets.length,MODEL_IDS.length);
});

test('editor export of a real shipped theme includes real models, licenses and the real cover',async t=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const theme=THEMES.find(item=>item.id==='default');assert.ok(theme);
 const paths=[...new Set(Object.values(effectiveModelPaths(theme)))];
 const catalog=assetCatalog;
 const models=[];
 for(const path of paths){const entry=catalog.find(item=>item.path===path);assert.ok(entry,path);models.push({path,bytes:await readFile(join(root,'public',path)),license:entry.license,source:entry.source});}
 const licensePath='licenses/Kenney-CC0.txt',licenseEntry=catalog.find(item=>item.path===licensePath);assert.ok(licenseEntry);
 const result=await buildThemePackage({
  theme,scene:validScene(),preview:await readFile(join(root,'docs/images/warm-showroom.png')),licenseText:await readFile(join(root,'LICENSE.md'),'utf8'),
  modelLicense:{path:licensePath,bytes:await readFile(join(root,'public',licensePath)),license:licenseEntry.license,source:licenseEntry.source},
  models,
  metadata:{id:'warm-real-export',name:theme.name,author:theme.author,version:theme.version,description:theme.description,styles:['warm-wood'],repository:REPO,commit:COMMIT}
 });
 assert.equal(result.theme.assets.length,paths.length);
 assert.ok(result.files.some(file=>file.path===effectiveModelPaths(theme).desk));
 assert.ok(result.files.some(file=>file.path==='LICENSE.txt'));
 assert.ok(result.files.some(file=>file.path==='licenses/Kenney-CC0.txt'));
 const dir=await mkdtemp(join(tmpdir(),'warm-real-package-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await writePackage(dir,result);
 const verified=await verifyPackage(dir);
 assert.equal(verified.digest,result.digest);
 assert.equal(verified.manifest.id,'warm-real-export');
 assert.ok(verified.totalBytes>100000);
 assert.ok(verified.totalBytes<30*1024*1024);
});

test('editor ZIP is deterministic, round-trips, and the archive helper verifies it',async t=>{
 const result=await buildThemePackage(packageInput());
 const zip=createZip(result.archiveFiles);
 const zipAgain=createZip([...result.archiveFiles].reverse());
 assert.deepEqual(zip,zipAgain);
 const entries=readZipEntries(zip);
 assert.deepEqual(entries.map(entry=>entry.path).sort(),result.archiveFiles.map(file=>file.path).sort());
 assert.deepEqual(Array.from(entries.find(entry=>entry.path==='theme.json').bytes),Array.from(result.files.find(file=>file.path==='theme.json').bytes));
 const verified=await verifyPackageArchive(zip);
 assert.equal(verified.digest,result.digest);
 assert.equal(verified.manifest.id,'editor-test');
 assert.throws(()=>createZip([{path:'../escape.txt',bytes:Buffer.from('x')}]),/路径不安全/);
});

test('complete package preserves custom model paths and adds all missing defaults',async()=>{
 const custom={...structuredClone(THEMES[0]),id:'custom-model-test',models:{desk:'furniture/cyber/desk.glb'},assets:['furniture/cyber/desk.glb']};
 const model=makeGLB({asset:{version:'2.0'},nodes:[],meshes:[]});
 const paths=[...new Set(Object.values(effectiveModelPaths(custom)))];
 const result=await buildThemePackage(packageInput({theme:custom,models:paths.map(path=>({path,bytes:model,license:'CC0-1.0',source:'https://kenney.nl/assets/furniture-kit'}))}));
 assert.equal(result.theme.models.desk,'furniture/cyber/desk.glb');
 assert.ok(result.theme.assets.includes('furniture/cyber/desk.glb'));
 assert.ok(result.theme.assets.includes('furniture/laptop.glb'));
 assert.ok(result.files.some(file=>file.path==='furniture/cyber/desk.glb'));
 assert.ok(result.files.some(file=>file.path==='furniture/laptop.glb'));
 assert.ok(paths.length<=MODEL_IDS.length);
});

test('editor helper rejects an unsafe source repository/commit and missing license',async()=>{
 const badRepo=packageInput();badRepo.metadata={...badRepo.metadata,repository:'http://github.com/a/b'};
 await assert.rejects(buildThemePackage(badRepo),/repository|github/i);
 const badModelLicense=packageInput();badModelLicense.modelLicense={...badModelLicense.modelLicense,bytes:''};
 await assert.rejects(buildThemePackage(badModelLicense),/许可证/);
});

test('complete package rejects missing models, bad previews, bad commit, and malformed assets',async()=>{
 const missing=packageInput();missing.models=missing.models.slice(1);
 await assert.rejects(buildThemePackage(missing),/缺少模型/);
 const badPreview=packageInput();badPreview.preview=Buffer.from('<html>');
 await assert.rejects(buildThemePackage(badPreview),/PNG/);
 const badCommit=packageInput();badCommit.metadata={...badCommit.metadata,commit:'not-a-commit'};
 await assert.rejects(buildThemePackage(badCommit),/commit/);
 const badModel=packageInput();badModel.models=badModel.models.map((model,index)=>index===0?{...model,bytes:Buffer.from('not glb')}:model);
 await assert.rejects(buildThemePackage(badModel),/GLB/);
 const badLicense=packageInput();badLicense.licenseText='';
 await assert.rejects(buildThemePackage(badLicense),/LICENSE/);
});

test('PR preview helper reports an explicit zero-package result without fabricating listings',async t=>{
 const root=await mkdtemp(join(tmpdir(),'editor-empty-pr-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const output=await mkdtemp(join(tmpdir(),'editor-empty-out-'));t.after(()=>rm(output,{recursive:true,force:true}));
 const summary=await preparePrPreview(join(root,'themes'),output);
 assert.equal(summary.items.length,0);
 assert.equal(summary.approved,false);
 assert.equal(summary.listed,false);
 const markdown=await readFile(join(output,'summary.md'),'utf8');
 assert.match(markdown,/未发现带 `theme-package\.json` 的投稿包/);
 assert.match(markdown,/没有自动审批或上架/);
});

test('trusted PR preview artifact is human-readable, escaped, and explicitly not approved/listed',async t=>{
 const result=await buildThemePackage(packageInput({metadata:{...packageInput().metadata,name:'<script>alert(1)</script> 主题',description:'<img src=x onerror=alert(1)>'}}));
 const output=await mkdtemp(join(tmpdir(),'editor-preview-out-'));t.after(()=>rm(output,{recursive:true,force:true}));
 const root=await mkdtemp(join(tmpdir(),'editor-pr-root-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'themes'),{recursive:true});
 await writePackage(join(root,'themes',result.manifest.id),result);
 const preview=await preparePrPreview(join(root,'themes'),output);
 assert.equal(preview.items.length,1);
 assert.equal(preview.items[0].approved,false);
 assert.equal(preview.items[0].listed,false);
 const html=await readFile(join(output,'editor-test','index.html'),'utf8');
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/技术检查与预览 artifact/);
 assert.match(html,/APPROVED|LISTED/);
 const metadata=JSON.parse(await readFile(join(output,'editor-test','metadata.json'),'utf8'));
 assert.equal(metadata.approved,false);assert.equal(metadata.listed,false);
});
