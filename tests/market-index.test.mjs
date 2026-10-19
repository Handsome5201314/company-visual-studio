import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {THEMES} from '../src/theme.js';
import {
 buildMarketDetailUrl,
 buildMarketDownloadUrl,
 buildMarketFileUrl,
 filterMarketItems,
 sortMarketItems,
 validateMarketDetail,
 validateMarketEntry,
 validateMarketIndex
} from '../src/market-index.js';
import officialIndex from '../apps/showroom/market-index.json' with {type:'json'};

const REPO='https://github.com/Handsome5201314/company-visual-studio';
const COMMIT='09da94cbb618b454e29897bcced3de51d4241a40';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const sha256=value=>createHash('sha256').update(value).digest('hex');

function validScene(){
 return {
  schemaVersion:1,
  compatibleContract:'hq-fixed-layout-v1',
  objects:[{id:'desk-a',model:'desk',position:[0,0,0],rotationY:0,scale:[1,1,1]}],
  lights:[{id:'lamp-a',position:[0,2,0],color:'#ffcc88',intensity:1.5,distance:4}]
 };
}

function filesFixture(){
 return {
  'theme.json':Buffer.from(JSON.stringify({...THEMES[0],version:'1.0.0',models:{},assets:[]})),
  'scene.json':Buffer.from(JSON.stringify(validScene())),
  'preview.png':Buffer.from(PNG),
  'assets/screenshot.png':Buffer.from(PNG),
  'README.md':Buffer.from('# 测试市场主题\n'),
  'LICENSE.txt':Buffer.from('MIT License\n')
 };
}

function manifestFixture(overrides={}){
 const files=filesFixture();
 const entries=Object.entries(files).map(([path,data])=>({
  path,bytes:data.length,sha256:sha256(data),license:'MIT',source:REPO
 }));
 return {
  schemaVersion:1,id:'default',name:'暖阳测试主题',author:'测试作者',version:'1.0.0',
  description:'用于市场目录数据测试的示例。',styles:['warm-wood'],compatibleContract:'hq-fixed-layout-v1',
  license:'MIT',source:{repository:REPO,commit:COMMIT},themePath:'theme.json',scenePath:'scene.json',
  previewPath:'preview.png',files:entries,...overrides
 };
}

function entryFixture(overrides={}){
 const manifest=overrides.manifest??manifestFixture();
 const totalBytes=manifest.files.reduce((sum,file)=>sum+file.bytes,0);
 return {
  id:'market-default',themeId:manifest.id,version:manifest.version,manifest,
  packageHash:`sha256:${'a'.repeat(64)}`,totalBytes,state:'LISTED',revision:3,
  createdAt:'2026-10-01T10:00:00.000Z',updatedAt:'2026-10-02T11:30:00.000Z',...overrides
 };
}

test('official static index is a real empty catalog with data-driven categories',()=>{
 const catalog=validateMarketIndex(officialIndex);
 assert.deepEqual(catalog.items,[]);
 assert.equal(catalog.categories.length,6);
 assert.deepEqual(catalog.categories[0],{id:'warm-wood',label:'温馨木质'});
});

test('LISTED entries are narrowed to public fields and private metadata does not leak',()=>{
 const entry=entryFixture({
  internalNotes:'只给审核员看的私有备注',
  reviewerId:'reviewer-secret',
  draftOwner:'owner-secret',
  permissions:['admin'],
  submittedBy:'employee-secret'
 });
 const catalog=validateMarketIndex({schemaVersion:1,items:[entry],categories:[{id:'warm-wood',label:'温馨木质'}],privateIndexNote:'secret'});
 const safe=catalog.items[0];
 assert.equal(safe.state,'LISTED');
 assert.equal(safe.title,'暖阳测试主题');
 assert.equal(safe.author,'测试作者');
 assert.equal(safe.license,'MIT');
 assert.equal(safe.compatibleContract,'hq-fixed-layout-v1');
 assert.equal(safe.totalBytes,entry.totalBytes);
 assert.deepEqual(safe.images,['assets/screenshot.png','preview.png']);
 assert.deepEqual(safe.source,{repository:REPO,commit:COMMIT});
 for(const key of ['internalNotes','reviewerId','draftOwner','permissions','submittedBy'])assert.equal(key in safe,false);
 assert.ok(!JSON.stringify(catalog).includes('secret'));
 assert.deepEqual(Object.keys(catalog).sort(),['categories','items','schemaVersion']);
});

test('unlisted, delisted and malformed entries are rejected rather than silently filtered',()=>{
 for(const state of ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','DELISTED','listed']){
  assert.throws(()=>validateMarketEntry(entryFixture({state})),/未上架/);
 }
 assert.throws(()=>validateMarketEntry({...entryFixture(),state:undefined}),/未上架/);
 const duplicate=entryFixture();
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[duplicate,{...duplicate}]}),/重复条目ID/);
 assert.throws(()=>validateMarketIndex({schemaVersion:2,items:[]}),/schemaVersion/);
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[entryFixture({id:'../escape'})]}),/id/);
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[entryFixture({themeId:'a/b'})]}),/themeId/);
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[entryFixture({packageHash:'sha256:abc'})]}),/packageHash/);
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[entryFixture({totalBytes:entryFixture().totalBytes+1})]}),/totalBytes/);
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[entryFixture({state:'LISTED',manifest:manifestFixture({previewPath:'../x.png'})})]}),/manifest/);
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[entryFixture({manifest:manifestFixture({source:{repository:'http://github.com/a/b',commit:COMMIT}})})]}),/manifest/);
 assert.equal(validateMarketEntry(entryFixture({id:'market_default'})).id,'market_default');
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[],categories:[{id:'warm-wood',label:'木质'},{id:'warm-wood',label:'重复'}]}),/重复分类ID/);
 assert.throws(()=>validateMarketIndex({schemaVersion:1,items:[],categories:[{id:'../x',label:'注入'}]}),/id/);
});

test('malicious titles remain plain data and search/category/author filters read fields only',()=>{
 const malicious='<img src=x onerror=alert(1)> 暖阳';
 const manifest=manifestFixture({name:malicious,author:'甲作者',styles:['warm-wood']});
 const first=entryFixture({id:'market-a',manifest,updatedAt:'2026-10-03T00:00:00.000Z'});
 const second=entryFixture({id:'market-b',manifest:manifestFixture({id:'cyber',name:'冷蓝实验室',author:'乙作者',styles:['sci-fi-lab']}),themeId:'cyber',updatedAt:'2026-10-04T00:00:00.000Z'});
 const catalog=validateMarketIndex({schemaVersion:1,items:[first,second],categories:[{id:'warm-wood',label:'温馨木质'},{id:'sci-fi-lab',label:'科幻实验室'}]});
 assert.equal(catalog.items[0].title,malicious);
 assert.equal(filterMarketItems(catalog.items,{query:'暖阳'}).length,1);
 assert.equal(filterMarketItems(catalog.items,{query:'甲作者'}).length,1);
 assert.equal(filterMarketItems(catalog.items,{styles:['warm-wood']}).length,1);
 assert.equal(filterMarketItems(catalog.items,{styles:['warm-wood','温馨木质']}).length,1);
 assert.equal(filterMarketItems(catalog.items,{styles:['sci-fi-lab']})[0].id,'market-b');
 assert.equal(filterMarketItems(catalog.items,{author:'乙作者'}).length,1);
 assert.equal(filterMarketItems(catalog.items,{query:'不存在'}).length,0);
 assert.deepEqual(sortMarketItems(catalog.items).map(item=>item.id),['market-b','market-a']);
 assert.equal(catalog.items.length,2);
});

test('detail validation binds the listed revision and rejects foreign or unsafe asset bases',()=>{
 const entry=validateMarketEntry(entryFixture());
 const detail={...entryFixture(),theme:{...THEMES[0],version:'1.0.0',models:{},assets:[]},scene:validScene(),assetBase:'/api/market/themes/market-default/files/'};
 const validated=validateMarketDetail(detail,entry);
 assert.equal(validated.assetBase,'/api/market/themes/market-default/files/');
 assert.equal(validated.theme.id,'default');
 assert.equal(validated.scene.objects.length,1);

 const foreignBase={...detail,assetBase:'https://evil.example/files/'};
 assert.throws(()=>validateMarketDetail(foreignBase,entry),/assetBase/);
 const wrongIdBase={...detail,assetBase:'/api/market/themes/other/files/'};
 assert.throws(()=>validateMarketDetail(wrongIdBase,entry),/assetBase/);
 const wrongRevision={...detail,revision:99};
 assert.throws(()=>validateMarketDetail(wrongRevision,entry),/revision/);
 const wrongTheme={...detail,theme:{...THEMES[0],id:'other'}};
 assert.throws(()=>validateMarketDetail(wrongTheme,entry),/theme\.id/);
 const wrongScene={...detail,scene:{...validScene(),compatibleContract:'hq-fixed-layout-v2'}};
 assert.throws(()=>validateMarketDetail(wrongScene,entry),/scene/);
 assert.throws(()=>validateMarketDetail({...detail,state:'DELISTED'},entry),/未上架/);
});

test('URL builders only construct fixed same-origin API paths and reject traversal',()=>{
 assert.equal(buildMarketDetailUrl('market-default'),'/api/market/themes/market-default');
 assert.equal(buildMarketDownloadUrl('market-default'),'/api/market/themes/market-default/download');
 assert.equal(buildMarketFileUrl('market-default','assets/screenshot.png'),'/api/market/themes/market-default/files/assets/screenshot.png');
 for(const path of ['../secret','assets/../../secret','https://evil.example/x.png','assets\\x.png','assets/%2e%2e/x.png','/absolute.png']){
  assert.throws(()=>buildMarketFileUrl('market-default',path),/路径/);
 }
 assert.throws(()=>buildMarketFileUrl('../escape','x.png'),/id/);
 assert.throws(()=>buildMarketFileUrl('market-default','x.png?download=1'),/路径/);
});

test('two source themes are not auto-converted into public market entries',()=>{
 assert.equal(THEMES.length,2);
 const catalog=validateMarketIndex(officialIndex);
 assert.equal(catalog.items.length,0);
 for(const theme of THEMES)assert.equal(catalog.items.some(item=>item.themeId===theme.id),false);
});
