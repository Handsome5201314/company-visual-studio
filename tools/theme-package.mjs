import {lstat,readFile,readdir,realpath,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {validateTheme} from '../src/theme.js';
import {PACKAGE_VERSION,validatePackageManifest,validateScene} from '../src/decoration-package.js';
import {inspectGLB} from '../src/glb.js';

const MANIFEST_NAME='theme-package.json';
const OUTPUT_SUFFIX='.company-theme.json.gz';
const MAX_FILE_BYTES=10*1024*1024;
const MAX_TOTAL_BYTES=30*1024*1024;
const MAX_DIRECTORY_ENTRIES=1000;
const MAX_DIRECTORY_DEPTH=20;

const byPath=(a,b)=>a.path<b.path?-1:a.path>b.path?1:0;

function canonicalJSON(value){
 if(Array.isArray(value))return `[${value.map(canonicalJSON).join(',')}]`;
 if(value&&typeof value==='object'){
  const keys=Object.keys(value).sort();
  return `{${keys.map(key=>`${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
 }
 return JSON.stringify(value);
}

function decodeText(bytes,label){
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error(`${label}不是有效UTF-8文本`);}
 if(text.includes('\u0000'))throw new Error(`${label}包含NUL字节`);
 return text;
}

function parseJSONBuffer(bytes,label){
 const text=decodeText(bytes,label);
 try{return JSON.parse(text);}catch(error){throw new Error(`${label}不是有效JSON：${error.message}`);}
}

function validateFileHeader(path,bytes){
 const extension=extname(path).slice(1).toLowerCase();
 switch(extension){
  case 'json':
   parseJSONBuffer(bytes,path);
   break;
  case 'glb':
   try{inspectGLB(bytes);}catch(error){throw new Error(`GLB文件${path}未通过自包含检查：${error.message}`);}
   break;
  case 'png':{
   const signature=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
   if(bytes.length<45||signature.some((byte,index)=>bytes[index]!==byte))throw new Error(`PNG文件头无效：${path}`);
   if(bytes.toString('ascii',12,16)!=='IHDR')throw new Error(`PNG缺少IHDR块：${path}`);
   if(bytes.toString('ascii',bytes.length-8,bytes.length-4)!=='IEND')throw new Error(`PNG缺少IEND结束块：${path}`);
   break;
  }
  case 'webp':
   if(bytes.length<12||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)throw new Error(`WEBP文件头或长度无效：${path}`);
   break;
  case 'jpg':
   if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff||bytes[bytes.length-2]!==0xff||bytes[bytes.length-1]!==0xd9)throw new Error(`JPG文件头或结束标记无效：${path}`);
   break;
  case 'md':
  case 'txt':
   decodeText(bytes,path);
   break;
  default:
   throw new Error(`不支持的文件类型：${path}`);
 }
}

async function assertNoSymlinkChain(base,path,realBase){
 let current=base;
 const parts=path.split('/');
 for(let index=0;index<parts.length;index++){
  current=join(current,parts[index]);
  const info=await lstat(current).catch(()=>null);
  if(!info)throw new Error(`主题包文件不存在：${path}`);
  if(info.isSymbolicLink())throw new Error(`主题包不允许符号链接：${path}`);
  const last=index===parts.length-1;
  if(last&&!info.isFile())throw new Error(`主题包路径不是普通文件：${path}`);
  if(!last&&!info.isDirectory())throw new Error(`主题包路径层级不是目录：${path}`);
 }
 const realFile=await realpath(current);
 const realRelative=relative(realBase,realFile);
 if(realRelative===''||realRelative==='..'||realRelative.startsWith(`..${sep}`)||isAbsolute(realRelative))throw new Error(`主题包文件真实路径越界：${path}`);
 return current;
}

async function walkFiles(base,relativePath='',depth=0,budget={entries:0}){
 if(depth>MAX_DIRECTORY_DEPTH)throw new Error('主题包目录层级过深');
 const directory=relativePath?join(base,...relativePath.split('/')):base;
 const entries=await readdir(directory,{withFileTypes:true});
 const found=new Set();
 for(const entry of entries){
  if(++budget.entries>MAX_DIRECTORY_ENTRIES)throw new Error(`主题包目录条目过多，超过${MAX_DIRECTORY_ENTRIES}个`);
  const childRelative=relativePath?`${relativePath}/${entry.name}`:entry.name;
  const absolute=join(directory,entry.name);
  const info=await lstat(absolute);
  if(info.isSymbolicLink())throw new Error(`主题包不允许符号链接：${childRelative}`);
  if(info.isDirectory()){
   for(const file of await walkFiles(base,childRelative,depth+1,budget)){
    found.add(file);
    if(found.size>MAX_DIRECTORY_ENTRIES)throw new Error(`主题包目录文件过多，超过${MAX_DIRECTORY_ENTRIES}个`);
   }
  }else if(info.isFile()){
   found.add(childRelative);
   if(found.size>MAX_DIRECTORY_ENTRIES)throw new Error(`主题包目录文件过多，超过${MAX_DIRECTORY_ENTRIES}个`);
  }else{
   throw new Error(`主题包包含非普通文件：${childRelative}`);
  }
 }
 return found;
}

function computeDigest(manifest,files){
 const payload={
  format:'company-theme-package',
  packageVersion:PACKAGE_VERSION,
  manifest:{...manifest,files:[...manifest.files].sort(byPath)},
  files:files.map(({path,bytes,sha256})=>({path,bytes,sha256})).sort(byPath)
 };
 return `sha256:${createHash('sha256').update(canonicalJSON(payload),'utf8').digest('hex')}`;
}

async function loadAndVerify(directory){
 if(typeof directory!=='string'||directory.length===0)throw new Error('主题包目录必须是字符串路径');
 const base=resolve(directory);
 const baseInfo=await lstat(base).catch(()=>null);
 if(!baseInfo)throw new Error(`主题包目录不存在：${base}`);
 if(baseInfo.isSymbolicLink())throw new Error('主题包目录不能是符号链接');
 if(!baseInfo.isDirectory())throw new Error('主题包路径必须是目录');
 const realBase=await realpath(base);

 const manifestPath=join(base,MANIFEST_NAME);
 await assertNoSymlinkChain(base,MANIFEST_NAME,realBase);
 if((await lstat(manifestPath)).size>1024*1024)throw new Error('主题包清单超过1MiB');
 let parsedManifest;
 try{parsedManifest=parseJSONBuffer(await readFile(manifestPath),MANIFEST_NAME);}catch(error){throw new Error(`${MANIFEST_NAME}读取失败：${error.message}`);}
 const manifest=validatePackageManifest(parsedManifest);

 const actualFiles=await walkFiles(base);
 const expectedFiles=new Set([...manifest.files.map(file=>file.path),MANIFEST_NAME]);
 for(const path of actualFiles)if(!expectedFiles.has(path))throw new Error(`主题包目录含清单未登记的文件：${path}`);
 for(const file of manifest.files)if(!actualFiles.has(file.path))throw new Error(`主题包缺少清单登记的文件：${file.path}`);

 const loadedFiles=[];
 let totalBytes=0;
 for(const entry of manifest.files){
  await assertNoSymlinkChain(base,entry.path,realBase);
  const info=await lstat(join(base,...entry.path.split('/')));
  if(info.size!==entry.bytes||info.size>MAX_FILE_BYTES)throw new Error(`文件读取前字节数或预算不符：${entry.path}`);
  const bytes=await readFile(join(base,...entry.path.split('/')));
  if(bytes.length!==entry.bytes)throw new Error(`文件字节数不符：${entry.path}（清单${entry.bytes}，实际${bytes.length}）`);
  if(bytes.length>MAX_FILE_BYTES)throw new Error(`单文件超过10MiB：${entry.path}`);
  const sha256=createHash('sha256').update(bytes).digest('hex');
  if(sha256!==entry.sha256)throw new Error(`文件SHA256不符：${entry.path}`);
  validateFileHeader(entry.path,bytes);
  totalBytes+=bytes.length;
  if(totalBytes>MAX_TOTAL_BYTES)throw new Error('主题包实际文件总大小超过30MiB');
  loadedFiles.push({path:entry.path,bytes:bytes.length,sha256,data:bytes});
 }

 const byFile=new Map(loadedFiles.map(file=>[file.path,file]));
 const themeFile=byFile.get(manifest.themePath);
 const sceneFile=byFile.get(manifest.scenePath);
 if(!themeFile||!sceneFile)throw new Error('主题包清单缺少theme.json或scene.json的实际文件');
 const theme=validateTheme(parseJSONBuffer(themeFile.data,manifest.themePath));
 const scene=validateScene(parseJSONBuffer(sceneFile.data,manifest.scenePath));
 if(theme.id!==manifest.id)throw new Error(`包id与theme.json不一致：${manifest.id} ≠ ${theme.id}`);
 if(theme.version!==manifest.version)throw new Error(`包version与theme.json不一致：${manifest.version} ≠ ${theme.version}`);
 if(theme.compatibleContract!==manifest.compatibleContract)throw new Error('包契约与theme.json不一致');
 if(scene.compatibleContract!==manifest.compatibleContract)throw new Error('包契约与scene.json不一致');

 const digest=computeDigest(manifest,loadedFiles);
 return {result:{manifest,theme,scene,digest,totalBytes},files:loadedFiles};
}

/**
 * 校验一个可移植主题包目录，返回经过实际文件哈希校验的 manifest/theme/scene。
 * 技术校验通过不代表市场上架、公司应用或版权审核通过。
 */
export async function verifyPackage(directory){
 return (await loadAndVerify(directory)).result;
}

async function packPackage(directory,output){
 if(typeof output!=='string'||!output.endsWith(OUTPUT_SUFFIX))throw new Error(`pack输出文件名必须以${OUTPUT_SUFFIX}结尾`);
 const outputPath=resolve(output);
 const base=resolve(directory);
 const relativeOutput=relative(base,outputPath);
 const inside=relativeOutput!==''&&!isAbsolute(relativeOutput)&&relativeOutput!=='..'&&!relativeOutput.startsWith(`..${sep}`);
 if(inside)throw new Error('pack输出文件不能写入主题包目录');
 const loaded=await loadAndVerify(directory);
 const payload={
  manifest:loaded.result.manifest,
  files:loaded.files.slice().sort(byPath).map(file=>({path:file.path,base64:file.data.toString('base64')}))
 };
 const archive=gzipSync(Buffer.from(JSON.stringify(payload),'utf8'),{level:9});
 try{
  await writeFile(outputPath,archive,{flag:'wx'});
 }catch(error){
  if(error.code==='EEXIST')throw new Error(`pack输出文件已存在，拒绝覆盖：${outputPath}`);
  throw new Error(`无法写入pack输出文件：${error.message}`);
 }
 return {output:outputPath,digest:loaded.result.digest,bytes:archive.length,manifest:loaded.result.manifest};
}

async function main(argv){
 const[command,...rest]=argv;
 if(command==='verify'){
  if(rest.length!==1)throw new Error('用法：node tools/theme-package.mjs verify <dir>');
  const result=await verifyPackage(rest[0]);
  console.log(JSON.stringify({id:result.manifest.id,version:result.manifest.version,compatibleContract:result.manifest.compatibleContract,digest:result.digest,totalBytes:result.totalBytes,fileCount:result.manifest.files.length},null,2));
  return;
 }
 if(command==='pack'){
  if(rest.length!==2)throw new Error('用法：node tools/theme-package.mjs pack <dir> <output.company-theme.json.gz>');
  const packed=await packPackage(rest[0],rest[1]);
  console.log(`已打包 ${packed.manifest.id}@${packed.manifest.version} -> ${packed.output}`);
  console.log(JSON.stringify({digest:packed.digest,bytes:packed.bytes},null,2));
  return;
 }
 throw new Error('用法：node tools/theme-package.mjs <verify|pack> ...');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.argv.slice(2)).catch(error=>{
  console.error(`theme-package: ${error.message}`);
  process.exitCode=1;
 });
}
