import {validatePackageManifest,validateScene} from './decoration-package.js';
import {MODEL_IDS,validateTheme} from './theme.js';
import {inspectGLB} from './glb.js';

const encoder=new TextEncoder();
const MAX_ARCHIVE_BYTES=31*1024*1024;
const byPath=(a,b)=>a.path<b.path?-1:a.path>b.path?1:0;

/** Effective model path per MODEL_ID, preserving a theme's verified custom mappings. */
export function effectiveModelPaths(inputTheme){
 const theme=validateTheme(inputTheme);
 return Object.fromEntries(MODEL_IDS.map(id=>[id,theme.models?.[id]||`furniture/${id}.glb`]));
}

const bytesOf=(value,label)=>{
 if(value instanceof Uint8Array)return value;
 if(value instanceof ArrayBuffer)return new Uint8Array(value);
 if(typeof value==='string')return encoder.encode(value);
 throw new Error(`${label}必须是Uint8Array、ArrayBuffer或字符串`);
};

const canonicalJSON=value=>{
 if(Array.isArray(value))return `[${value.map(canonicalJSON).join(',')}]`;
 if(value&&typeof value==='object'){
  const keys=Object.keys(value).sort();
  return `{${keys.map(key=>`${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
 }
 return JSON.stringify(value);
};

export async function sha256Hex(bytes){
 if(!globalThis.crypto?.subtle)throw new Error('当前环境没有Web Crypto，无法计算包哈希；请使用HTTPS或localhost');
 const digest=await globalThis.crypto.subtle.digest('SHA-256',bytesOf(bytes,'哈希输入'));
 return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function makeReadme({name,description,author,version,compatibleContract,repository,commit,files}){
 return `# ${name}\n\n${description}\n\n- 作者：${author}\n- 版本：${version}\n- 兼容契约：${compatibleContract}\n- 代码许可：MIT\n- 家具许可：逐文件见 theme-package.json；原创家具 MIT，Kenney 家具 CC0-1.0\n- 源码基线：${repository}/tree/${commit}\n\n## 包内文件\n\n${files.map(path=>`- ${path}`).join('\n')}\n\n> 这是可移植主题包，不是市场认证或公司正式装修审批结果。应用前仍须宿主校验导航、碰撞、权限与版权。\n`;
}

/**
 * Build a complete, portable theme package from an editor design and real asset bytes.
 * Browser-safe: no Node built-ins; hashing uses Web Crypto.
 */
export async function buildThemePackage(input){
 if(!input||typeof input!=='object')throw new Error('完整主题包输入必须是对象');
 const theme=validateTheme(input.theme);
 const scene=validateScene(input.scene);
 const metadata=input.metadata??{};
 const repository=typeof metadata.repository==='string'?metadata.repository:'';
 const commit=typeof metadata.commit==='string'?metadata.commit:'';
 const id=metadata.id??theme.id;
 const name=metadata.name??theme.name;
 const author=metadata.author??theme.author;
 const version=metadata.version??theme.version;
 const description=metadata.description??theme.description;
 const styles=Array.isArray(metadata.styles)&&metadata.styles.length?metadata.styles:[theme.id];
 const themeModels=effectiveModelPaths(theme);
 const requiredModelPaths=[...new Set(Object.values(themeModels))];
 const exportTheme={...structuredClone(theme),id,name,author,version,description,models:themeModels,assets:requiredModelPaths};
 const validTheme=validateTheme(exportTheme);
 const validScene=validateScene(scene);
 if(validTheme.compatibleContract!==validScene.compatibleContract)throw new Error('theme与scene布局契约不一致');

 const preview=bytesOf(input.preview,'预览图');
 if(preview.length<45||preview[0]!==0x89||preview[1]!==0x50||preview[2]!==0x4e||preview[3]!==0x47)throw new Error('预览图必须是PNG字节');
 if(preview.length>10*1024*1024)throw new Error('预览图不能超过10MiB');
 const licenseText=bytesOf(input.licenseText,'LICENSE文本');
 if(!licenseText.length)throw new Error('LICENSE文本不能为空');
 const modelLicense=input.modelLicense;
 if(!modelLicense||typeof modelLicense.path!=='string')throw new Error('缺少家具许可证文件描述');
 const modelLicenseBytes=bytesOf(modelLicense.bytes,'家具许可证');
 if(!modelLicenseBytes.length)throw new Error('家具许可证不能为空');
 if(!Array.isArray(input.models))throw new Error('完整主题包缺少模型文件列表');
 const modelByPath=new Map();
 for(const item of input.models){
  if(!item||typeof item.path!=='string'||!requiredModelPaths.includes(item.path))throw new Error(`模型路径不在允许列表：${String(item?.path)}`);
  if(modelByPath.has(item.path))throw new Error(`模型路径重复：${item.path}`);
  const bytes=bytesOf(item.bytes,item.path);
  try{inspectGLB(bytes);}catch(error){throw new Error(`模型 ${item.path} 未通过GLB检查：${error.message}`);}
  if(typeof item.license!=='string'||!item.license||typeof item.source!=='string'||!item.source)throw new Error(`模型 ${item.path} 缺少许可证或来源`);
  modelByPath.set(item.path,{path:item.path,bytes,license:item.license,source:item.source});
 }
 for(const path of requiredModelPaths)if(!modelByPath.has(path))throw new Error(`完整主题包缺少模型：${path}`);

 const files=new Map();
 const add=(path,bytes,license,source)=>{
  if(files.has(path))throw new Error(`包内文件重复：${path}`);
  files.set(path,{bytes:bytesOf(bytes,path),license,source});
 };
 add('theme.json',JSON.stringify(validTheme),'MIT',repository);
 add('scene.json',JSON.stringify(validScene),'MIT',repository);
 add('preview.png',preview,'MIT',repository);
 add('LICENSE.txt',licenseText,'MIT',repository);
 add(modelLicense.path,modelLicenseBytes,modelLicense.license??'CC0-1.0',modelLicense.source??repository);
 for(const model of modelByPath.values())add(model.path,model.bytes,model.license,model.source);

 const readme=makeReadme({name,description,author,version,compatibleContract:validTheme.compatibleContract,repository,commit,files:[...files.keys(),'README.md'].sort()});
 add('README.md',readme,'MIT',repository);

 const entries=[];
 for(const [path,file] of [...files.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0)){
  entries.push({path,bytes:file.bytes.length,sha256:await sha256Hex(file.bytes),license:file.license,source:file.source});
 }
 const manifest=validatePackageManifest({
  schemaVersion:1,id:validTheme.id,name:validTheme.name,author:validTheme.author,version:validTheme.version,
  description:validTheme.description,styles,compatibleContract:validTheme.compatibleContract,license:'MIT',
  source:{repository,commit},themePath:'theme.json',scenePath:'scene.json',previewPath:'preview.png',files:entries
 });
 const payload={
  format:'company-theme-package',packageVersion:1,
  manifest:{...manifest,files:[...manifest.files].sort(byPath)},
  files:[...manifest.files].map(file=>({path:file.path,bytes:file.bytes,sha256:file.sha256})).sort(byPath)
 };
 const digest=`sha256:${await sha256Hex(encoder.encode(canonicalJSON(payload)))}`;
 const contentFiles=[...files.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,file])=>({path,bytes:file.bytes}));
 const archiveFiles=[...contentFiles,{path:'theme-package.json',bytes:encoder.encode(JSON.stringify(manifest))}].sort(byPath);
 return {
  manifest,theme:validTheme,scene:validScene,digest,
  totalBytes:entries.reduce((sum,entry)=>sum+entry.bytes,0),
  files:contentFiles,archiveFiles
 };
}

const CRC_TABLE=(()=>{
 const table=new Uint32Array(256);
 for(let n=0;n<256;n++){
  let c=n;
  for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
  table[n]=c>>>0;
 }
 return table;
})();

function crc32(bytes){
 let crc=0xffffffff;
 for(const byte of bytes)crc=CRC_TABLE[(crc^byte)&0xff]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}

const zipPath=/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
function assertZipPath(path){
 if(typeof path!=='string'||!zipPath.test(path)||path.includes('\\')||path.includes(':')||path.includes('%')||path.includes('//')||path.startsWith('/')||path.endsWith('/'))throw new Error(`ZIP路径不安全：${path}`);
 for(const part of path.split('/'))if(!part||part==='.'||part==='..'||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part))throw new Error(`ZIP路径不安全：${path}`);
}
function concat(parts){
 const length=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(length);let offset=0;
 for(const part of parts){out.set(part,offset);offset+=part.length;}
 return out;
}

/** Create a deterministic, stored (no compression) ZIP for a complete package directory. */
export function createZip(files){
 if(!Array.isArray(files)||files.length===0)throw new Error('ZIP至少需要一个文件');
 if(files.length>1000)throw new Error('ZIP文件数超过1000');
 const entries=[...files].map(file=>({path:file.path,bytes:bytesOf(file.bytes,file.path)})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const seen=new Set();
 for(const entry of entries){assertZipPath(entry.path);if(seen.has(entry.path))throw new Error(`ZIP文件重复：${entry.path}`);seen.add(entry.path);}
 const localParts=[],centralParts=[];let offset=0,totalBytes=0;
 for(const entry of entries){
  assertZipPath(entry.path);
  const name=encoder.encode(entry.path);if(name.length>65535)throw new Error('ZIP文件名过长');
  totalBytes+=entry.bytes.length;if(totalBytes>MAX_ARCHIVE_BYTES)throw new Error('ZIP总大小超过31MiB');
  const crc=crc32(entry.bytes),local=new Uint8Array(30+name.length+entry.bytes.length),view=new DataView(local.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0,true);view.setUint16(8,0,true);view.setUint16(10,0,true);view.setUint16(12,0x21,true);view.setUint32(14,crc,true);view.setUint32(18,entry.bytes.length,true);view.setUint32(22,entry.bytes.length,true);view.setUint16(26,name.length,true);view.setUint16(28,0,true);local.set(name,30);local.set(entry.bytes,30+name.length);
  localParts.push(local);
  const central=new Uint8Array(46+name.length),cview=new DataView(central.buffer);
  cview.setUint32(0,0x02014b50,true);cview.setUint16(4,20,true);cview.setUint16(6,20,true);cview.setUint16(8,0,true);cview.setUint16(10,0,true);cview.setUint16(12,0,true);cview.setUint16(14,0x21,true);cview.setUint32(16,crc,true);cview.setUint32(20,entry.bytes.length,true);cview.setUint32(24,entry.bytes.length,true);cview.setUint16(28,name.length,true);cview.setUint16(30,0,true);cview.setUint16(32,0,true);cview.setUint16(34,0,true);cview.setUint16(36,0,true);cview.setUint32(38,0,true);cview.setUint32(42,offset,true);central.set(name,46);
  centralParts.push(central);offset+=local.length;
 }
 const central=concat(centralParts),end=new Uint8Array(22),eview=new DataView(end.buffer);
 eview.setUint32(0,0x06054b50,true);eview.setUint16(4,0,true);eview.setUint16(6,0,true);eview.setUint16(8,entries.length,true);eview.setUint16(10,entries.length,true);eview.setUint32(12,central.length,true);eview.setUint32(16,offset,true);eview.setUint16(20,0,true);
 return concat([...localParts,central,end]);
}

/** Read a stored ZIP produced by createZip; rejects compression, traversal, duplicates, bombs. */
export function readZipEntries(input){
 const bytes=bytesOf(input,'ZIP');
 if(bytes.length<22)throw new Error('ZIP过短');
 let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-22-65535);i--){
  if(bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x05&&bytes[i+3]===0x06){eocd=i;break;}
 }
 if(eocd<0)throw new Error('ZIP缺少EOCD');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(eocd,true)!==0x06054b50)throw new Error('ZIP EOCD无效');
 if(view.getUint16(eocd+4,true)!==0||view.getUint16(eocd+6,true)!==0)throw new Error('不支持分卷ZIP');
 const count=view.getUint16(eocd+10,true);if(count>1000)throw new Error('ZIP文件数超过1000');
 let offset=view.getUint32(eocd+16,true),totalBytes=0;const entries=[];const seen=new Set();
 for(let index=0;index<count;index++){
  if(offset+46>bytes.length||view.getUint32(offset,true)!==0x02014b50)throw new Error('ZIP中央目录损坏');
  const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),crc=view.getUint32(offset+16,true),compressed=view.getUint32(offset+20,true),uncompressed=view.getUint32(offset+24,true),nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true),localOffset=view.getUint32(offset+42,true);
  if(flags&0x0009)throw new Error('ZIP不支持加密或数据描述符');
  if(method!==0)throw new Error('ZIP只接受stored方式');
  if(compressed!==uncompressed)throw new Error('ZIP压缩大小不一致');
  const nameStart=offset+46,nameEnd=nameStart+nameLength;if(nameEnd>bytes.length)throw new Error('ZIP文件名越界');
  const path=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(nameStart,nameEnd));assertZipPath(path);
  if(seen.has(path))throw new Error(`ZIP文件重复：${path}`);seen.add(path);
  if(localOffset+30>bytes.length||view.getUint32(localOffset,true)!==0x04034b50)throw new Error('ZIP本地文件头损坏');
  const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true),dataStart=localOffset+30+localNameLength+localExtraLength,dataEnd=dataStart+uncompressed;
  if(dataEnd>bytes.length)throw new Error('ZIP文件数据越界');
  const localName=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(localOffset+30,localOffset+30+localNameLength));
  if(localName!==path)throw new Error(`ZIP本地文件名与中央目录不一致：${path}`);
  const data=bytes.slice(dataStart,dataEnd);if(crc32(data)!==crc)throw new Error(`ZIP CRC不符：${path}`);
  totalBytes+=data.length;if(totalBytes>MAX_ARCHIVE_BYTES)throw new Error('ZIP总大小超过31MiB');
  entries.push({path,bytes:data});
  offset=nameEnd+extraLength+commentLength;
 }
 return entries.sort(byPath);
}
