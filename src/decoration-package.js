import {CONTRACT,MODEL_IDS} from './theme.js';
import layout from './layout-contract.json' with {type:'json'};

// Phase 1 主题包协议版本；scene 与 theme-package.json 共用这个版本号。
export const PACKAGE_VERSION=1;

const SCENE_KEYS=['schemaVersion','compatibleContract','objects','lights'];
export const SURFACE_IDS=Object.freeze(['floor','mezzanine','back-wall','acoustic','reception-front','worktops','office-wall','railings']);
export const FIXTURE_SLOTS=Object.freeze([
 {id:'lounge-sofa',name:'一楼会谈沙发',model:'loungedesignsofa',position:[-7.7,0,-4.6],height:1.05,rotationY:Math.PI/2,models:['loungedesignsofa']},
 {id:'library-shelf',name:'一楼资料书架',model:'bookcaseopen',position:[8.6,0,5.5],height:2.1,rotationY:-Math.PI/2,models:['bookcaseopen']},
 {id:'owner-desk',name:'二楼老板办公桌',model:'desk',position:[6,3.4,-5.8],height:.85,rotationY:0,models:['desk','kitchencabinet']},
 ...[-.7,2.2].flatMap((z,row)=>[3,6].map((x,col)=>({id:`screen-${row}-${col}`,name:`工作电脑 ${row+1}-${col+1}`,model:'computerscreen',position:[x,.86,z-.42],height:.58,rotationY:0,models:['computerscreen','laptop']})))
]);
const OBJECT_KEYS=['id','model','position','rotationY','scale'];
const LIGHT_KEYS=['id','position','color','intensity','distance'];
const MANIFEST_KEYS=['schemaVersion','id','name','author','version','description','styles','compatibleContract','license','source','themePath','scenePath','previewPath','files'];
const FILE_KEYS=['path','bytes','sha256','license','source'];

const ALLOWED_LICENSES=Object.freeze(['MIT','Apache-2.0','CC0-1.0','CC-BY-4.0']);
const ALLOWED_EXTENSIONS=Object.freeze(['json','glb','png','webp','jpg','md','txt']);
const IMAGE_EXTENSIONS=Object.freeze(['png','webp','jpg']);

const MAX_OBJECTS=60;
const MAX_LIGHTS=4;
const MAX_FILES=100;
const MAX_FILE_BYTES=10*1024*1024;
const MAX_TOTAL_BYTES=30*1024*1024;
const MIN_SCALE=0.05;
const MAX_SCALE=2;
const MIN_INTENSITY=0;
const MAX_INTENSITY=3;
const MIN_DISTANCE=0.1;
const MAX_DISTANCE=12;
// 一楼地面为 0，夹层为 3.4 米，顶棚约 7 米；这里是视觉包围盒，不是碰撞体。
const MIN_Y=0;
const MAX_Y=7.5;

const THEME_ID=/^[a-z][a-z0-9-]{0,40}$/;
const SCENE_ID=/^[a-z][a-z0-9-]{0,63}$/;
const SEMVER=/^\d+\.\d+\.\d+$/;
const COMMIT=/^[0-9a-f]{40}$/;
const SHA256=/^[0-9a-f]{64}$/;
const COLOR=/^#[0-9a-f]{6}$/i;
const GITHUB_REPOSITORY=/^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/;
const WINDOWS_RESERVED=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const clonePlain=(value,label)=>{try{return structuredClone(value);}catch{throw new Error(`${label}必须是可复制的JSON纯数据`);}};
const exact=(object,keys,label)=>{
 if(!record(object))throw new Error(`${label}必须是普通JSON对象`);
 for(const key of Object.keys(object))if(!keys.includes(key))throw new Error(`${label}含不支持的字段：${key}`);
 for(const key of keys)if(!Object.hasOwn(object,key))throw new Error(`${label}缺少字段：${key}`);
};
const text=(value,label,min,max,{multiline=false}={})=>{
 if(typeof value!=='string')throw new Error(`${label}必须是字符串`);
 if(value.length<min||value.length>max)throw new Error(`${label}长度必须在${min}到${max}字符之间`);
 if(value.trim().length===0)throw new Error(`${label}不能是空白字符串`);
 const control=multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/;
 if(control.test(value))throw new Error(`${label}不能包含控制字符`);
 return value;
};
const finite=(value,label)=>{
 if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${label}必须是有限数字`);
 return value;
};
const bounded=(value,label,min,max)=>{
 finite(value,label);
 if(value<min||value>max)throw new Error(`${label}必须在${min}到${max}之间`);
 return value;
};
const vec3=(value,label)=>{
 if(!Array.isArray(value)||value.length!==3)throw new Error(`${label}必须是三个数字组成的数组`);
 value.forEach((item,index)=>finite(item,`${label}[${index}]`));
 return value;
};
const position=(value,label)=>{
 vec3(value,label);
 bounded(value[0],`${label}[0]`,layout.bounds.minX,layout.bounds.maxX);
 bounded(value[1],`${label}[1]`,MIN_Y,MAX_Y);
 bounded(value[2],`${label}[2]`,layout.bounds.minZ,layout.bounds.maxZ);
 return value;
};
const sceneId=(value,label,ids)=>{
 if(typeof value!=='string'||!SCENE_ID.test(value))throw new Error(`${label}.id必须是小写字母开头、仅含小写字母数字和短横线的标识`);
 if(ids.has(value))throw new Error(`${label}.id重复：${value}`);
 ids.add(value);
 return value;
};
const safePackagePath=(value,label)=>{
 if(typeof value!=='string'||value.length<1||value.length>200)throw new Error(`${label}必须是1到200字符的包内相对路径`);
 if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value))throw new Error(`${label}只允许ASCII字母、数字、点、下划线、短横线和斜杠`);
 if(value.includes('\\')||value.includes(':')||value.includes('%')||value.includes('//')||value.startsWith('/')||value.endsWith('/'))throw new Error(`${label}必须是安全的相对路径，不得包含反斜杠、冒号、百分号、绝对路径或空段`);
 for(const part of value.split('/')){
  if(part==='.'||part==='..'||part.length===0)throw new Error(`${label}不得包含点段或空段`);
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part))throw new Error(`${label}的每一段必须以ASCII字母或数字开头`);
  if(/[. ]$/.test(part))throw new Error(`${label}的路径段不得以点或空格结尾`);
  if(WINDOWS_RESERVED.test(part))throw new Error(`${label}不得使用Windows保留文件名：${part}`);
 }
 return value;
};
const assertExtension=(value,label)=>{
 const match=/\.([A-Za-z0-9]+)$/.exec(value);
 if(!match||!ALLOWED_EXTENSIONS.includes(match[1]))throw new Error(`${label}扩展名必须是小写的${ALLOWED_EXTENSIONS.join('、')}之一`);
 return match[1];
};
const assertImagePath=(value,label)=>{
 safePackagePath(value,label);
 const extension=assertExtension(value,label);
 if(!IMAGE_EXTENSIONS.includes(extension))throw new Error(`${label}必须是PNG、WEBP或JPG图片`);
 return value;
};
const assertLicense=(value,label)=>{
 if(typeof value!=='string'||!ALLOWED_LICENSES.includes(value))throw new Error(`${label}必须是明确允许的SPDX许可证：${ALLOWED_LICENSES.join('、')}`);
 return value;
};
const assertRepo=(value,label)=>{
 if(typeof value!=='string'||!GITHUB_REPOSITORY.test(value))throw new Error(`${label}必须是无query、无凭证的https://github.com/<owner>/<repo>地址`);
 return value;
};
const assertCommit=(value,label)=>{
 if(typeof value!=='string'||!COMMIT.test(value))throw new Error(`${label}必须是40位小写十六进制Git commit`);
 return value;
};

function validateObject(object,index,ids){
 const label=`装修物件[${index}]`;
 exact(object,OBJECT_KEYS,label);
 sceneId(object.id,label,ids);
 if(typeof object.model!=='string'||!MODEL_IDS.includes(object.model))throw new Error(`${label}.model必须是已知家具ID：${MODEL_IDS.join('、')}`);
 position(object.position,`${label}.position`);
 finite(object.rotationY,`${label}.rotationY`);
 if(!Array.isArray(object.scale)||object.scale.length!==3)throw new Error(`${label}.scale必须是三个数字组成的数组`);
 object.scale.forEach((value,scaleIndex)=>bounded(value,`${label}.scale[${scaleIndex}]`,MIN_SCALE,MAX_SCALE));
}

function validateLight(light,index,ids){
 const label=`装饰灯[${index}]`;
 exact(light,LIGHT_KEYS,label);
 sceneId(light.id,label,ids);
 position(light.position,`${label}.position`);
 if(typeof light.color!=='string'||!COLOR.test(light.color))throw new Error(`${label}.color必须是#rrggbb六位十六进制颜色`);
 bounded(light.intensity,`${label}.intensity`,MIN_INTENSITY,MAX_INTENSITY);
 bounded(light.distance,`${label}.distance`,MIN_DISTANCE,MAX_DISTANCE);
}

/**
 * 校验可编辑装修场景。只校验视觉数据；导航、碰撞、门禁与员工安全由宿主
 * 使用权威 world.js 另行校验，本函数不证明场景可安全行走。
 */
export function validateScene(input){
 const scene=clonePlain(input,'装修场景');
 exact(scene,[...SCENE_KEYS,...('surfaces' in scene?['surfaces']:[]),...('fixtures' in scene?['fixtures']:[])],'装修场景');
 if(scene.schemaVersion!==1)throw new Error('装修场景schemaVersion必须为1');
 if(scene.compatibleContract!==CONTRACT)throw new Error(`装修场景布局契约必须是${CONTRACT}`);
 if(!Array.isArray(scene.objects))throw new Error('装修场景objects必须是数组');
 if(!Array.isArray(scene.lights))throw new Error('装修场景lights必须是数组');
 if(scene.objects.length>MAX_OBJECTS)throw new Error(`装修物件最多${MAX_OBJECTS}个`);
 if(scene.lights.length>MAX_LIGHTS)throw new Error(`装饰灯最多${MAX_LIGHTS}盏`);
 const ids=new Set();
 scene.objects.forEach((object,index)=>validateObject(object,index,ids));
 scene.lights.forEach((light,index)=>validateLight(light,index,ids));
 if(scene.surfaces!==undefined){
  if(!Array.isArray(scene.surfaces)||scene.surfaces.length>SURFACE_IDS.length)throw Error('建筑饰面数量无效');
  const seen=new Set();for(const s of scene.surfaces){exact(s,['id','color','roughness','metalness'],'建筑饰面');if(!SURFACE_IDS.includes(s.id)||seen.has(s.id)||!COLOR.test(s.color))throw Error('建筑饰面ID或颜色无效');seen.add(s.id);bounded(s.roughness,'饰面粗糙度',.15,1);bounded(s.metalness,'饰面金属度',0,1);}
 }
 if(scene.fixtures!==undefined){
  if(!Array.isArray(scene.fixtures)||scene.fixtures.length>FIXTURE_SLOTS.length)throw Error('固定家具数量无效');
  const seen=new Set();for(const f of scene.fixtures){exact(f,['id','model'],'固定家具');const slot=FIXTURE_SLOTS.find(s=>s.id===f.id);if(!slot||seen.has(f.id)||!slot.models.includes(f.model))throw Error('家具替换必须使用匹配的固定槽位与准入模型');seen.add(f.id);}
 }
 return scene;
}

/**
 * 校验可移植主题包清单（纯数据层）。真实文件哈希、字节数、文件头、符号链接
 * 与目录越界由 tools/theme-package.mjs 在受控目录中验证。
 */
export function validatePackageManifest(input){
 const manifest=clonePlain(input,'主题包清单');
 exact(manifest,MANIFEST_KEYS,'主题包清单');
 if(manifest.schemaVersion!==PACKAGE_VERSION)throw new Error(`主题包清单schemaVersion必须为${PACKAGE_VERSION}`);
 if(typeof manifest.id!=='string'||!THEME_ID.test(manifest.id))throw new Error('主题包id必须以小写字母开头，只含小写字母、数字和短横线，最长41字符');
 if(typeof manifest.version!=='string'||!SEMVER.test(manifest.version))throw new Error('主题包version必须是三段数字semver，例如1.0.0');
 text(manifest.name,'主题包name',1,200);
 text(manifest.author,'主题包author',1,200);
 text(manifest.description,'主题包description',1,2000,{multiline:true});
 if(!Array.isArray(manifest.styles)||manifest.styles.length<1||manifest.styles.length>12)throw new Error('主题包styles必须是1到12个风格标签');
 const styleKeys=new Set();
 manifest.styles.forEach((style,index)=>{
  text(style,`主题包styles[${index}]`,1,60);
  const key=style.toLowerCase();
  if(styleKeys.has(key))throw new Error(`主题包styles重复：${style}`);
  styleKeys.add(key);
 });
 if(manifest.compatibleContract!==CONTRACT)throw new Error(`主题包布局契约必须是${CONTRACT}`);
 assertLicense(manifest.license,'主题包license');
 exact(manifest.source,['repository','commit'],'主题包source');
 assertRepo(manifest.source.repository,'主题包source.repository');
 assertCommit(manifest.source.commit,'主题包source.commit');
 if(manifest.themePath!=='theme.json')throw new Error('主题包themePath必须固定为theme.json');
 if(manifest.scenePath!=='scene.json')throw new Error('主题包scenePath必须固定为scene.json');
 assertImagePath(manifest.previewPath,'主题包previewPath');
 if(!Array.isArray(manifest.files)||manifest.files.length<1||manifest.files.length>MAX_FILES)throw new Error(`主题包files必须是1到${MAX_FILES}个文件`);
 const paths=new Map();
 const exactPaths=new Set();
 let totalBytes=0;
 manifest.files.forEach((file,index)=>{
  const label=`主题包files[${index}]`;
  exact(file,FILE_KEYS,label);
  safePackagePath(file.path,`${label}.path`);
  if(file.path==='theme-package.json')throw new Error('主题包files不得登记清单自身theme-package.json');
  assertExtension(file.path,`${label}.path`);
  if(!Number.isSafeInteger(file.bytes)||file.bytes<1)throw new Error(`${label}.bytes必须是大于0的整数`);
  if(file.bytes>MAX_FILE_BYTES)throw new Error(`${label}.bytes单文件不得超过10MiB`);
  totalBytes+=file.bytes;
  if(totalBytes>MAX_TOTAL_BYTES)throw new Error('主题包文件总大小不得超过30MiB');
  if(typeof file.sha256!=='string'||!SHA256.test(file.sha256))throw new Error(`${label}.sha256必须是64位小写十六进制SHA256`);
  assertLicense(file.license,`${label}.license`);
  text(file.source,`${label}.source`,1,500);
  const key=file.path.toLowerCase();
  if(paths.has(key))throw new Error(`主题包文件路径重复或大小写冲突：${file.path}`);
  paths.set(key,file.path);
  exactPaths.add(file.path);
 });
 const has=path=>exactPaths.has(path);
 for(const [path,label] of [[manifest.themePath,'themePath'],[manifest.scenePath,'scenePath'],[manifest.previewPath,'previewPath'],['README.md','README.md']])if(!has(path))throw new Error(`主题包files必须包含${label}对应的文件：${path}`);
 if(!has('LICENSE.txt')&&!has('LICENSE.md'))throw new Error('主题包files必须包含LICENSE.txt或LICENSE.md');
 return manifest;
}
