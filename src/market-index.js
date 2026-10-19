import {validatePackageManifest,validateScene} from './decoration-package.js';
import {validateTheme} from './theme.js';

const MAX_ITEMS=500;
const MAX_CATEGORIES=30;
const MAX_TOTAL_BYTES=30*1024*1024;
const ID=/^[a-z0-9][a-z0-9_-]{0,63}$/;
const SEMVER=/^\d+\.\d+\.\d+$/;
const PACKAGE_HASH=/^sha256:[0-9a-f]{64}$/;
const ISO_DATE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const IMAGE_PATH=/\.(?:png|webp|jpg)$/;

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const text=(value,label,min,max)=>{
 if(typeof value!=='string')throw new Error(`${label}必须是字符串`);
 if(value.length<min||value.length>max)throw new Error(`${label}长度必须在${min}到${max}字符之间`);
 if(value.trim().length===0)throw new Error(`${label}不能是空白字符串`);
 if(/[\u0000-\u001f\u007f]/.test(value))throw new Error(`${label}不能包含控制字符`);
 return value;
};
const assertId=(value,label)=>{
 if(typeof value!=='string'||!ID.test(value))throw new Error(`${label}必须是URL安全的短ID：小写字母或数字开头，只含小写字母、数字、下划线和短横线，最长64字符`);
 return value;
};
const assertDate=(value,label)=>{
 if(typeof value!=='string'||!ISO_DATE.test(value)||!Number.isFinite(Date.parse(value)))throw new Error(`${label}必须是带时区的ISO 8601时间`);
 return value;
};
const assertHash=(value,label)=>{
 if(typeof value!=='string'||!PACKAGE_HASH.test(value))throw new Error(`${label}必须是sha256:加64位小写十六进制`);
 return value;
};
const assertRelativePath=(value,label)=>{
 if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value))throw new Error(`${label}必须是安全的包内相对ASCII路径`);
 if(value.includes('..')||value.includes('\\')||value.includes(':')||value.includes('%')||value.includes('//')||value.startsWith('/')||value.endsWith('/'))throw new Error(`${label}不能包含路径穿越、反斜杠、冒号、百分号或空段`);
 for(const part of value.split('/'))if(!part||part==='.'||part==='..'||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part))throw new Error(`${label}包含不安全的路径段`);
 return value;
};
const manifestTotal=manifest=>manifest.files.reduce((sum,file)=>sum+file.bytes,0);

function validateCategory(input,index){
 const label=`市场分类[${index}]`;
 if(!record(input))throw new Error(`${label}必须是普通对象`);
 const id=assertId(input.id,`${label}.id`);
 const categoryLabel=text(input.label,`${label}.label`,1,40);
 return {id,label:categoryLabel};
}

/**
 * 把一个市场条目收窄为可公开字段。未知字段（审核人、私有备注、权限等）
 * 不会出现在返回值中；state 必须是 LISTED。
 */
export function validateMarketEntry(input,index=0){
 const label=`市场条目[${index}]`;
 if(!record(input))throw new Error(`${label}必须是普通对象`);
 if(input.state!=='LISTED')throw new Error(`${label}未上架（state=${String(input.state)}），不能进入公开目录`);
 const id=assertId(input.id,`${label}.id`);
 const themeId=assertId(input.themeId,`${label}.themeId`);
 const version=text(input.version,`${label}.version`,1,40);
 if(!SEMVER.test(version))throw new Error(`${label}.version必须是三段数字semver`);
 let manifest;
 try{manifest=validatePackageManifest(input.manifest);}catch(error){throw new Error(`${label}.manifest无效：${error.message}`);}
 if(manifest.id!==themeId)throw new Error(`${label}.themeId与manifest.id不一致`);
 if(manifest.version!==version)throw new Error(`${label}.version与manifest.version不一致`);
 const packageHash=assertHash(input.packageHash,`${label}.packageHash`);
 if(!Number.isSafeInteger(input.totalBytes)||input.totalBytes<1||input.totalBytes>MAX_TOTAL_BYTES)throw new Error(`${label}.totalBytes必须是1到30MiB的整数`);
 const declaredBytes=manifestTotal(manifest);
 if(input.totalBytes!==declaredBytes)throw new Error(`${label}.totalBytes与manifest文件字节总和不一致`);
 if(!Number.isSafeInteger(input.revision)||input.revision<1)throw new Error(`${label}.revision必须是正整数`);
 const revision=input.revision;
 const createdAt=assertDate(input.createdAt,`${label}.createdAt`);
 const updatedAt=assertDate(input.updatedAt,`${label}.updatedAt`);
 const images=manifest.files.map(file=>file.path).filter(path=>IMAGE_PATH.test(path)).sort();
 return {
  id,themeId,version,manifest,packageHash,totalBytes:input.totalBytes,state:'LISTED',revision,createdAt,updatedAt,
  title:manifest.name,author:manifest.author,description:manifest.description,styles:[...manifest.styles],
  license:manifest.license,compatibleContract:manifest.compatibleContract,previewPath:manifest.previewPath,
  images,source:{repository:manifest.source.repository,commit:manifest.source.commit}
 };
}

/**
 * 校验市场目录。未上架/下架条目、重复ID、非法manifest、非法哈希或预算
 * 都会使整个目录失败；不会静默丢弃坏数据后伪装成空目录。
 */
export function validateMarketIndex(input){
 if(!record(input))throw new Error('市场目录必须是普通对象');
 if(input.schemaVersion!==1)throw new Error('市场目录schemaVersion必须为1');
 if(!Array.isArray(input.items)||input.items.length>MAX_ITEMS)throw new Error(`市场目录items必须是0到${MAX_ITEMS}个条目`);
 const items=input.items.map((item,index)=>validateMarketEntry(item,index));
 const ids=new Set();
 for(const item of items){
  if(ids.has(item.id))throw new Error(`市场目录存在重复条目ID：${item.id}`);
  ids.add(item.id);
 }
 let categories=[];
 if(input.categories!==undefined){
  if(!Array.isArray(input.categories)||input.categories.length>MAX_CATEGORIES)throw new Error(`市场目录categories必须是0到${MAX_CATEGORIES}个分类`);
  categories=input.categories.map((category,index)=>validateCategory(category,index));
  const categoryIds=new Set();
  for(const category of categories){
   const key=category.id.toLowerCase();
   if(categoryIds.has(key))throw new Error(`市场目录存在重复分类ID：${category.id}`);
   categoryIds.add(key);
  }
 }
 return {schemaVersion:1,items,categories};
}

/**
 * 校验同源详情，并确认它与当前目录条目是同一已上架版本。
 * assetBase 只接受固定同源前缀，防止图片/下载跳到第三方位。
 */
export function validateMarketDetail(input,catalogEntry){
 if(!record(catalogEntry))throw new Error('市场详情缺少当前目录条目');
 const entry=validateMarketEntry(input,0);
 for(const key of ['id','themeId','version','packageHash','revision','totalBytes'])if(entry[key]!==catalogEntry[key])throw new Error(`市场详情与目录条目的${key}不一致`);
 let theme,scene;
 try{theme=validateTheme(input.theme);}catch(error){throw new Error(`市场详情theme无效：${error.message}`);}
 try{scene=validateScene(input.scene);}catch(error){throw new Error(`市场详情scene无效：${error.message}`);}
 if(theme.id!==entry.themeId)throw new Error('市场详情theme.id与条目themeId不一致');
 if(theme.version!==entry.version)throw new Error('市场详情theme.version与条目version不一致');
 if(theme.compatibleContract!==entry.compatibleContract)throw new Error('市场详情theme契约与条目不兼容');
 if(scene.compatibleContract!==entry.compatibleContract)throw new Error('市场详情scene契约与条目不兼容');
 const expectedAssetBase=`/api/market/themes/${encodeURIComponent(entry.id)}/files/`;
 if(input.assetBase!==expectedAssetBase)throw new Error(`市场详情assetBase必须是受控同源前缀${expectedAssetBase}`);
 return {entry,theme,scene,assetBase:expectedAssetBase};
}

/**
 * 仅按数据字段筛选，不读取HTML或执行任何包内容。
 * @param {Array} items
 * @param {{query?: string, styles?: string[], author?: string}} [options]
 */
export function filterMarketItems(items,{query='',styles=[],author=''}={}){
 if(!Array.isArray(items))throw new Error('市场条目列表必须是数组');
 const needle=typeof query==='string'?query.trim().toLocaleLowerCase():'';
 const wantedStyles=(Array.isArray(styles)?styles:[styles]).filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim().toLocaleLowerCase());
 const wantedAuthor=typeof author==='string'?author.trim().toLocaleLowerCase():'';
 return items.filter(item=>{
  if(wantedAuthor&&String(item.author).toLocaleLowerCase()!==wantedAuthor)return false;
  if(wantedStyles.length&&!item.styles.some(style=>wantedStyles.includes(String(style).toLocaleLowerCase())))return false;
  if(needle){
   const haystack=[item.id,item.themeId,item.title,item.author,item.description,item.license,item.compatibleContract,...item.styles].join('\n').toLocaleLowerCase();
   if(!haystack.includes(needle))return false;
  }
  return true;
 });
}

/** 真实日期排序；不生成“热门/精选”分数。 */
export function sortMarketItems(items,order='newest'){
 const copy=[...items];
 if(order==='title')return copy.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN')||a.id.localeCompare(b.id));
 return copy.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.title.localeCompare(b.title,'zh-CN')||a.id.localeCompare(b.id));
}

function encodePath(path){return path.split('/').map(segment=>encodeURIComponent(segment)).join('/');}

export function buildMarketDetailUrl(id){
 assertId(id,'市场条目id');
 return `/api/market/themes/${encodeURIComponent(id)}`;
}

export function buildMarketDownloadUrl(id){
 assertId(id,'市场条目id');
 return `/api/market/themes/${encodeURIComponent(id)}/download`;
}

export function buildMarketFileUrl(id,path){
 assertId(id,'市场条目id');
 assertRelativePath(path,'市场资源路径');
 return `/api/market/themes/${encodeURIComponent(id)}/files/${encodePath(path)}`;
}
