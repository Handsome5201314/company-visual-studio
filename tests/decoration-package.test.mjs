import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {mkdir,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {THEMES,validateTheme} from '../src/theme.js';
import {PACKAGE_VERSION,validatePackageManifest,validateScene} from '../src/decoration-package.js';
import {verifyPackage} from '../tools/theme-package.mjs';
import {validateAssets} from '../tools/validate-assets.mjs';

const REPO='https://github.com/Handsome5201314/company-visual-studio';
const COMMIT='09da94cbb618b454e29897bcced3de51d4241a40';
const SUFFIX='.company-theme.json.gz';
const TOOL=fileURLToPath(new URL('../tools/theme-package.mjs',import.meta.url));
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');

const sha256=value=>createHash('sha256').update(value).digest('hex');

function makeGLB(json){
 let text=JSON.stringify(json);
 text+=' '.repeat((4-text.length%4)%4);
 const bytes=Buffer.alloc(20+Buffer.byteLength(text));
 bytes.writeUInt32LE(0x46546c67,0);
 bytes.writeUInt32LE(2,4);
 bytes.writeUInt32LE(bytes.length,8);
 bytes.writeUInt32LE(bytes.length-20,12);
 bytes.writeUInt32LE(0x4e4f534a,16);
 bytes.write(text,20);
 return bytes;
}

function validScene(){
 return {
  schemaVersion:1,
  compatibleContract:'hq-fixed-layout-v1',
  objects:[{id:'desk-a',model:'desk',position:[0,0,0],rotationY:0,scale:[1,1,1]}],
  lights:[{id:'lamp-a',position:[0,2,0],color:'#ffcc88',intensity:1.5,distance:4}]
 };
}

function defaultFiles(){
 return {
  'theme.json':Buffer.from(JSON.stringify({...THEMES[0],version:'1.0.0',models:{},assets:[]},null,1)),
  'scene.json':Buffer.from(JSON.stringify(validScene(),null,1)),
  'preview.png':Buffer.from(PNG),
  'README.md':Buffer.from('# 测试主题包\n\n仅用于协议测试。\n'),
  'LICENSE.txt':Buffer.from('MIT License\n'),
  'assets/chair.glb':makeGLB({asset:{version:'2.0'},nodes:[],meshes:[]})
 };
}

function makeManifest(files,overrides={}){
 const entries=Object.entries(files).map(([path,data])=>({
  path,
  bytes:data.length,
  sha256:sha256(data),
  license:path==='preview.png'?'CC0-1.0':'MIT',
  source:REPO
 }));
 return {
  schemaVersion:1,
  id:'default',
  name:'暖阳测试主题',
  author:'测试作者',
  version:'1.0.0',
  description:'用于主题包协议测试的示例主题。',
  styles:['warm-wood'],
  compatibleContract:'hq-fixed-layout-v1',
  license:'MIT',
  source:{repository:REPO,commit:COMMIT},
  themePath:'theme.json',
  scenePath:'scene.json',
  previewPath:'preview.png',
  files:entries,
  ...overrides
 };
}

async function writeTree(dir,files){
 for(const [path,data] of Object.entries(files)){
  const target=join(dir,...path.split('/'));
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,data);
 }
}

async function makePackage(t,options={}){
 const dir=await mkdtemp(join(tmpdir(),'company-theme-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const files=defaultFiles();
 options.files?.(files);
 const manifest=makeManifest(files);
 options.manifest?.(manifest,files);
 await writeTree(dir,files);
 await writeFile(join(dir,'theme-package.json'),JSON.stringify(manifest,null,2));
 await options.after?.({dir,files,manifest});
 return {dir,files,manifest};
}

test('scene validation accepts the fixed-layout envelope and rejects unsafe or unknown data',()=>{
 const scene=validScene();
 assert.deepEqual(validateScene(scene),scene);
 const returned=validateScene(scene);
 returned.objects[0].id='mutated';
 assert.equal(scene.objects[0].id,'desk-a');
 assert.doesNotThrow(()=>validateScene({schemaVersion:1,compatibleContract:'hq-fixed-layout-v1',objects:[],lights:[]}));
 const bounds=validScene();
 bounds.objects[0].position=[-9.55,0,-7.5];
 bounds.objects[0].scale=[0.05,0.05,0.05];
 bounds.objects[0].rotationY=-Math.PI*2;
 bounds.lights[0].position=[9.55,7.5,7.5];
 bounds.lights[0].color='#AABBCC';
 bounds.lights[0].intensity=3;
 bounds.lights[0].distance=12;
 assert.doesNotThrow(()=>validateScene(bounds));
 const maximum=validScene();
 maximum.objects=Array.from({length:60},(_,index)=>({id:`object-${index}`,model:'desk',position:[0,0,0],rotationY:0,scale:[1,1,1]}));
 maximum.lights=Array.from({length:4},(_,index)=>({id:`light-${index}`,position:[0,2,0],color:'#ffcc88',intensity:1,distance:4}));
 assert.doesNotThrow(()=>validateScene(maximum));

 const reject=(mutate,pattern)=>{
  const value=structuredClone(scene);
  mutate(value);
  assert.throws(()=>validateScene(value),pattern);
 };
 reject(value=>{value.schemaVersion=2;},/schemaVersion/);
 reject(value=>{value.compatibleContract='hq-fixed-layout-v2';},/契约/);
 reject(value=>{value.script='alert(1)';},/字段/);
 reject(value=>{value.navigation={};},/字段/);
 reject(value=>{value.url='https://example.com/x';},/字段/);
 reject(value=>{value.collision={};},/字段/);
 reject(value=>{value.employee={};},/字段/);
 reject(value=>{value.permission={};},/字段/);
 reject(value=>{delete value.lights;},/缺少/);
 reject(value=>{delete value.objects;},/缺少/);
 reject(value=>{value.objects='x';},/数组/);
 reject(value=>{value.lights='x';},/数组/);
 reject(value=>{value.objects[0].script='alert(1)';},/字段/);
 reject(value=>{value.objects[0].navigation={};},/字段/);
 reject(value=>{value.objects[0].url='https://example.com/x';},/字段/);
 reject(value=>{value.objects[0].collision={};},/字段/);
 reject(value=>{value.objects[0].employee='boss';},/字段/);
 reject(value=>{value.objects[0].permission='admin';},/字段/);
 reject(value=>{value.objects[0].code='x';},/字段/);
 reject(value=>{delete value.objects[0].rotationY;},/缺少/);
 reject(value=>{value.objects[0].model='unknown';},/model/);
 reject(value=>{value.objects[0].id='Bad';},/id/);
 reject(value=>{value.objects[0].id='bad_id';},/id/);
 reject(value=>{value.objects.push(structuredClone(value.objects[0]));},/重复/);
 reject(value=>{value.lights[0].id='desk-a';},/重复/);
 reject(value=>{value.objects[0].position=[0,0];},/position/);
 reject(value=>{value.objects[0].position=[0,0,0,0];},/position/);
 reject(value=>{value.objects[0].position[0]=NaN;},/position/);
 reject(value=>{value.objects[0].position[0]=Infinity;},/position/);
 reject(value=>{value.objects[0].position[0]=-9.56;},/position/);
 reject(value=>{value.objects[0].position[0]=9.56;},/position/);
 reject(value=>{value.objects[0].position[1]=-0.01;},/position/);
 reject(value=>{value.objects[0].position[1]=7.51;},/position/);
 reject(value=>{value.objects[0].position[2]=-7.51;},/position/);
 reject(value=>{value.objects[0].position[2]=7.51;},/position/);
 reject(value=>{value.objects[0].rotationY=NaN;},/rotationY/);
 reject(value=>{value.objects[0].rotationY=Infinity;},/rotationY/);
 reject(value=>{value.objects[0].scale=[1,1];},/scale/);
 reject(value=>{value.objects[0].scale=[0.049,1,1];},/scale/);
 reject(value=>{value.objects[0].scale=[1,2.01,1];},/scale/);
 reject(value=>{value.objects[0].scale=[1,1,NaN];},/scale/);
 reject(value=>{value.lights[0].color='#fff';},/color/);
 reject(value=>{value.lights[0].color='red';},/color/);
 reject(value=>{value.lights[0].intensity=-0.1;},/intensity/);
 reject(value=>{value.lights[0].intensity=3.1;},/intensity/);
 reject(value=>{value.lights[0].distance=0.09;},/distance/);
 reject(value=>{value.lights[0].distance=12.1;},/distance/);
 reject(value=>{value.lights[0].position=[0,8,0];},/position/);
 reject(value=>{value.lights[0].script='alert(1)';},/字段/);
 reject(value=>{value.objects=Array.from({length:61},(_,index)=>({id:`object-${index}`,model:'desk',position:[0,0,0],rotationY:0,scale:[1,1,1]}));},/最多60/);
 reject(value=>{value.lights=Array.from({length:5},(_,index)=>({id:`light-${index}`,position:[0,2,0],color:'#ffcc88',intensity:1,distance:4}));},/最多4/);
});

test('package manifest accepts complete v1 data and rejects unsafe paths, files, licenses and budgets',()=>{
 assert.equal(PACKAGE_VERSION,1);
 const base=makeManifest(defaultFiles());
 assert.equal(validatePackageManifest(base).id,'default');
 const returned=validatePackageManifest(base);
 returned.name='changed';
 assert.equal(base.name,'暖阳测试主题');

 const reject=(mutate,pattern)=>{
  const value=structuredClone(base);
  mutate(value);
  assert.throws(()=>validatePackageManifest(value),pattern);
 };
 reject(value=>{value.schemaVersion=2;},/schemaVersion/);
 reject(value=>{value.id='Bad';},/id/);
 reject(value=>{value.id='';},/id/);
 reject(value=>{value.id='a'.repeat(42);},/id/);
 reject(value=>{value.version='1.0';},/version/);
 reject(value=>{value.version='1.0.0-beta';},/version/);
 reject(value=>{value.version='v1.0.0';},/version/);
 reject(value=>{value.name='';},/name/);
 reject(value=>{value.name='   ';},/name/);
 reject(value=>{value.author='\u0001';},/author/);
 reject(value=>{value.description='   ';},/description/);
 reject(value=>{value.styles=[];},/styles/);
 reject(value=>{value.styles=Array.from({length:13},(_,index)=>`style-${index}`);},/styles/);
 reject(value=>{value.styles=['warm-wood','WARM-WOOD'];},/重复/);
 reject(value=>{value.styles=['\u0001'];},/styles/);
 reject(value=>{value.compatibleContract='hq-fixed-layout-v2';},/契约/);
 reject(value=>{value.license='GPL-3.0';},/SPDX/);
 reject(value=>{value.source={repository:REPO};},/缺少/);
 reject(value=>{value.source.repository='http://github.com/a/b';},/github/);
 reject(value=>{value.source.repository='https://token@github.com/a/b';},/github/);
 reject(value=>{value.source.repository='https://github.com/a/b?x=1';},/github/);
 reject(value=>{value.source.repository='https://gitlab.com/a/b';},/github/);
 reject(value=>{value.source.repository='https://github.com/a';},/github/);
 reject(value=>{value.source.repository='https://github.com/a/b/';},/github/);
 reject(value=>{value.source.commit='a'.repeat(39);},/commit/);
 reject(value=>{value.source.commit='A'.repeat(40);},/commit/);
 reject(value=>{value.source.commit='g'.repeat(40);},/commit/);
 reject(value=>{value.themePath='other.json';},/themePath/);
 reject(value=>{value.scenePath='other.json';},/scenePath/);
 reject(value=>{value.previewPath='preview.json';},/PNG|WEBP|JPG/);
 reject(value=>{value.previewPath='../preview.png';},/previewPath/);
 reject(value=>{value.previewPath='/preview.png';},/previewPath/);
 reject(value=>{value.scripts={};},/字段/);
 reject(value=>{value.files=[];},/files/);
 reject(value=>{value.files='x';},/files/);
 reject(value=>{delete value.files[0].source;},/缺少/);
 reject(value=>{value.files[0].source='';},/source/);
 reject(value=>{value.files[0].url='https://example.com/x';},/字段/);
 reject(value=>{value.files[0].bytes=0;},/bytes/);
 reject(value=>{value.files[0].bytes=1.5;},/bytes/);
 reject(value=>{value.files[0].bytes='1';},/bytes/);
 reject(value=>{value.files[0].bytes=10*1024*1024+1;},/10MiB/);
 reject(value=>{value.files[0].sha256='A'.repeat(64);},/sha256/);
 reject(value=>{value.files[0].sha256='a'.repeat(63);},/sha256/);
 reject(value=>{value.files[0].license='GPL-3.0';},/SPDX/);
 reject(value=>{value.files[0].path='../evil.json';},/path/);
 reject(value=>{value.files[0].path='assets/../../evil.json';},/path/);
 reject(value=>{value.files[0].path='/etc/passwd';},/path/);
 reject(value=>{value.files[0].path='https://example.com/x.json';},/path/);
 reject(value=>{value.files[0].path='C:\\x.json';},/path/);
 reject(value=>{value.files[0].path='assets\\x.json';},/path/);
 reject(value=>{value.files[0].path='assets:x.json';},/path/);
 reject(value=>{value.files[0].path='assets/%2e%2e/x.json';},/path/);
 reject(value=>{value.files[0].path='assets//x.json';},/path/);
 reject(value=>{value.files[0].path='assets/./x.json';},/path/);
 reject(value=>{value.files[0].path='assets/.hidden';},/path/);
 reject(value=>{value.files[0].path='CON.json';},/path/);
 reject(value=>{value.files[0].path='assets/foo.';},/path/);
 reject(value=>{value.files[0].path='';},/path/);
 reject(value=>{value.files[0].path=123;},/path/);
 for(const extension of ['js','html','svg','wasm']){
  reject(value=>{value.files[0].path=`evil.${extension}`;},/扩展名/);
 }
 reject(value=>{value.files.push(structuredClone(value.files[1]));},/重复/);
 reject(value=>{value.files.push({...structuredClone(value.files[1]),path:'assets/Chair.glb'});},/大小写/);
 reject(value=>{value.files.push({...structuredClone(value.files[1]),path:'theme-package.json'});},/清单自身/);
 reject(value=>{value.files=value.files.filter(file=>file.path!=='theme.json');},/theme/);
 reject(value=>{value.files=value.files.filter(file=>file.path!=='scene.json');},/scene/);
 reject(value=>{value.files=value.files.filter(file=>file.path!=='preview.png');},/previewPath/);
 reject(value=>{value.files=value.files.filter(file=>file.path!=='README.md');},/README/);
 reject(value=>{value.files=value.files.map(file=>file.path==='README.md'?{...file,path:'readme.md'}:file);},/README/);
 reject(value=>{value.files=value.files.filter(file=>!file.path.startsWith('LICENSE'));},/LICENSE/);
 reject(value=>{value.previewPath='preview2.png';},/previewPath/);
 reject(value=>{
  for(let index=0;index<4;index++)value.files.push({path:`assets/big${index}.txt`,bytes:8*1024*1024,sha256:'0'.repeat(64),license:'MIT',source:REPO});
 },/30MiB/);
 reject(value=>{
  while(value.files.length<101)value.files.push({path:`assets/extra${value.files.length}.txt`,bytes:1,sha256:'0'.repeat(64),license:'MIT',source:REPO});
 },/1到100/);

 const hundred=structuredClone(base);
 while(hundred.files.length<100)hundred.files.push({path:`assets/f${hundred.files.length}.txt`,bytes:1,sha256:'0'.repeat(64),license:'MIT',source:REPO});
 assert.equal(hundred.files.length,100);
 assert.doesNotThrow(()=>validatePackageManifest(hundred));
 for(const license of ['MIT','Apache-2.0','CC0-1.0','CC-BY-4.0']){
  const value=structuredClone(base);
  value.license=license;
  assert.doesNotThrow(()=>validatePackageManifest(value));
 }
});

test('verifyPackage returns verified manifest, theme, scene, digest and total bytes',async t=>{
 const {dir,manifest}=await makePackage(t);
 const result=await verifyPackage(dir);
 assert.deepEqual(result.manifest,manifest);
 assert.equal(result.theme.id,'default');
 assert.equal(result.theme.version,'1.0.0');
 assert.equal(result.theme.compatibleContract,'hq-fixed-layout-v1');
 assert.equal(result.scene.compatibleContract,'hq-fixed-layout-v1');
 assert.equal(result.scene.objects.length,1);
 assert.equal(result.totalBytes,manifest.files.reduce((sum,file)=>sum+file.bytes,0));
 assert.match(result.digest,/^sha256:[0-9a-f]{64}$/);
 await assert.rejects(()=>verifyPackage(join(dir,'missing')),/不存在/);
});

test('verifyPackage rejects tampered bytes, mismatched metadata, missing and extra files',async t=>{
 const tampered=await makePackage(t,{after:async({dir})=>writeFile(join(dir,'preview.png'),Buffer.concat([PNG,Buffer.from([0])]))});
 await assert.rejects(()=>verifyPackage(tampered.dir),/字节数/);

 const flippedBytes=Buffer.from(PNG);
 flippedBytes[flippedBytes.length-20]^=0xff;
 const flipped=await makePackage(t,{after:async({dir})=>writeFile(join(dir,'preview.png'),flippedBytes)});
 await assert.rejects(()=>verifyPackage(flipped.dir),/SHA256/);

 const wrongSha=await makePackage(t,{manifest:manifest=>{manifest.files.find(file=>file.path==='preview.png').sha256='0'.repeat(64);}});
 await assert.rejects(()=>verifyPackage(wrongSha.dir),/SHA256/);

 const wrongBytes=await makePackage(t,{manifest:manifest=>{manifest.files.find(file=>file.path==='preview.png').bytes+=1;}});
 await assert.rejects(()=>verifyPackage(wrongBytes.dir),/字节数/);

 const missing=await makePackage(t,{after:async({dir})=>rm(join(dir,'README.md'))});
 await assert.rejects(()=>verifyPackage(missing.dir),/缺少清单登记/);

 const extra=await makePackage(t,{after:async({dir})=>writeFile(join(dir,'extra.txt'),'extra')});
 await assert.rejects(()=>verifyPackage(extra.dir),/未登记/);
});

test('verifyPackage rejects external GLB resources and spoofed file headers',async t=>{
 const externalBuffer=await makePackage(t,{files:files=>{files['assets/chair.glb']=makeGLB({asset:{version:'2.0'},buffers:[{uri:'https://example.com/x.bin'}],nodes:[]});}});
 await assert.rejects(()=>verifyPackage(externalBuffer.dir),/GLB|外部/);

 const externalImage=await makePackage(t,{files:files=>{files['assets/chair.glb']=makeGLB({asset:{version:'2.0'},images:[{uri:'file:///private/x.png'}],nodes:[]});}});
 await assert.rejects(()=>verifyPackage(externalImage.dir),/GLB|外部/);

 const truncatedGLB=await makePackage(t,{files:files=>{files['assets/chair.glb']=Buffer.alloc(10);}});
 await assert.rejects(()=>verifyPackage(truncatedGLB.dir),/GLB/);

 const badPNG=await makePackage(t,{files:files=>{files['preview.png']=Buffer.from('<html>not a png</html>');}});
 await assert.rejects(()=>verifyPackage(badPNG.dir),/PNG/);

 const badWEBP=await makePackage(t,{files:files=>{files['assets/texture.webp']=Buffer.from('not a webp');}});
 await assert.rejects(()=>verifyPackage(badWEBP.dir),/WEBP/);

 const badJPG=await makePackage(t,{files:files=>{files['assets/photo.jpg']=Buffer.from('not a jpg');}});
 await assert.rejects(()=>verifyPackage(badJPG.dir),/JPG/);

 const badJSON=await makePackage(t,{files:files=>{files['assets/bad.json']=Buffer.from('{');}});
 await assert.rejects(()=>verifyPackage(badJSON.dir),/JSON/);

 const badREADME=await makePackage(t,{files:files=>{files['README.md']=Buffer.from([0xff,0xfe]);}});
 await assert.rejects(()=>verifyPackage(badREADME.dir),/UTF-8/);
});

test('verifyPackage enforces package, theme and scene consistency',async t=>{
 const themeId=await makePackage(t,{files:files=>{
  const theme=JSON.parse(files['theme.json'].toString());
  theme.id='other';
  files['theme.json']=Buffer.from(JSON.stringify(theme));
 }});
 await assert.rejects(()=>verifyPackage(themeId.dir),/包id/);

 const themeVersion=await makePackage(t,{files:files=>{
  const theme=JSON.parse(files['theme.json'].toString());
  theme.version='2.0.0';
  files['theme.json']=Buffer.from(JSON.stringify(theme));
 }});
 await assert.rejects(()=>verifyPackage(themeVersion.dir),/包version/);

 const invalidTheme=await makePackage(t,{files:files=>{
  const theme=JSON.parse(files['theme.json'].toString());
  delete theme.ui;
  files['theme.json']=Buffer.from(JSON.stringify(theme));
 }});
 await assert.rejects(()=>verifyPackage(invalidTheme.dir),/界面|主题/);

 const sceneContract=await makePackage(t,{files:files=>{
  const scene=JSON.parse(files['scene.json'].toString());
  scene.compatibleContract='hq-fixed-layout-v2';
  files['scene.json']=Buffer.from(JSON.stringify(scene));
 }});
 await assert.rejects(()=>verifyPackage(sceneContract.dir),/契约/);

 const manifestContract=await makePackage(t,{manifest:manifest=>{manifest.compatibleContract='hq-fixed-layout-v2';}});
 await assert.rejects(()=>verifyPackage(manifestContract.dir),/契约/);
});

test('digest is stable across manifest key/file order and binds actual file hashes',async t=>{
 const {dir,manifest}=await makePackage(t);
 const first=await verifyPackage(dir);

 const reordered={};
 for(const key of Object.keys(manifest).reverse())reordered[key]=manifest[key];
 reordered.files=[...manifest.files].reverse();
 await writeFile(join(dir,'theme-package.json'),JSON.stringify(reordered));
 const second=await verifyPackage(dir);
 assert.equal(second.digest,first.digest);

 const changed=Buffer.from('# 变更后的说明\n');
 const changedManifest=structuredClone(manifest);
 const readme=changedManifest.files.find(file=>file.path==='README.md');
 readme.bytes=changed.length;
 readme.sha256=sha256(changed);
 await writeFile(join(dir,'README.md'),changed);
 await writeFile(join(dir,'theme-package.json'),JSON.stringify(changedManifest));
 const third=await verifyPackage(dir);
 assert.notEqual(third.digest,first.digest);

 const renamed=structuredClone(changedManifest);
 renamed.name='另一个主题名称';
 await writeFile(join(dir,'theme-package.json'),JSON.stringify(renamed));
 const fourth=await verifyPackage(dir);
 assert.notEqual(fourth.digest,third.digest);
});

test('CLI verify and pack produce a portable gzip archive and refuse unsafe outputs',async t=>{
 const {dir,manifest}=await makePackage(t);
 const verify=spawnSync(process.execPath,[TOOL,'verify',dir],{encoding:'utf8'});
 assert.equal(verify.status,0,verify.stderr);
 const summary=JSON.parse(verify.stdout);
 assert.equal(summary.id,'default');
 assert.match(summary.digest,/^sha256:[0-9a-f]{64}$/);

 const output=join(tmpdir(),`theme-${randomUUID()}${SUFFIX}`);
 t.after(()=>rm(output,{force:true}));
 const pack=spawnSync(process.execPath,[TOOL,'pack',dir,output],{encoding:'utf8'});
 assert.equal(pack.status,0,pack.stderr);
 const archive=JSON.parse(gunzipSync(await readFile(output)).toString('utf8'));
 assert.deepEqual(Object.keys(archive).sort(),['files','manifest']);
 assert.equal(archive.manifest.id,'default');
 const preview=archive.files.find(file=>file.path==='preview.png');
 assert.equal(sha256(Buffer.from(preview.base64,'base64')),manifest.files.find(file=>file.path==='preview.png').sha256);
 assert.ok(!archive.files.some(file=>file.path==='theme-package.json'));

 const again=spawnSync(process.execPath,[TOOL,'pack',dir,output],{encoding:'utf8'});
 assert.equal(again.status,1);
 assert.match(again.stderr,/已存在/);

 const wrongSuffix=spawnSync(process.execPath,[TOOL,'pack',dir,join(tmpdir(),`${randomUUID()}.json`)],{encoding:'utf8'});
 assert.equal(wrongSuffix.status,1);
 assert.match(wrongSuffix.stderr,/company-theme\.json\.gz/);
});

test('verifyPackage rejects file and directory symlinks',async t=>{
 let tested=false;
 const outside=await mkdtemp(join(tmpdir(),'theme-outside-'));
 t.after(()=>rm(outside,{recursive:true,force:true}));
 await writeFile(join(outside,'x.txt'),'x');

 const directoryLink=await makePackage(t);
 await rm(join(directoryLink.dir,'assets'),{recursive:true,force:true});
 try{
  await symlink(outside,join(directoryLink.dir,'assets'),'junction');
  await assert.rejects(()=>verifyPackage(directoryLink.dir),/符号链接/);
  tested=true;
 }catch(error){
  if(!['EPERM','EACCES','EINVAL','ENOSYS'].includes(error.code))throw error;
 }

 const fileLink=await makePackage(t);
 await rm(join(fileLink.dir,'README.md'));
 try{
  await symlink(join(fileLink.dir,'theme.json'),join(fileLink.dir,'README.md'),'file');
  await assert.rejects(()=>verifyPackage(fileLink.dir),/符号链接/);
  tested=true;
 }catch(error){
  if(!['EPERM','EACCES','EINVAL','ENOSYS'].includes(error.code))throw error;
 }
 if(!tested)t.skip('当前平台不允许创建符号链接，无法执行该拒绝用例');
});

test('existing shipped themes still validate and the asset catalog remains intact',()=>{
 assert.equal(THEMES.length,2);
 for(const theme of THEMES)assert.equal(validateTheme(theme).compatibleContract,'hq-fixed-layout-v1');
 assert.ok(validateAssets()>=13);
});
