import {lstat,mkdir,mkdtemp,readFile,readdir,realpath,rm,writeFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,extname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {validateTheme,MODEL_IDS} from '../src/theme.js';
import {PACKAGE_VERSION,validatePackageManifest,validateScene} from '../src/decoration-package.js';
import {inspectGLB} from '../src/glb.js';
import {readZipEntries} from '../src/theme-package-export.js';

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
 for(const path of theme.assets)if(!byFile.has(path))throw new Error(`主题包缺少声明的模型资源：${path}`);

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

/**
 * Host/HTTP acceptance helper: verify a stored ZIP produced by the editor.
 * The archive is extracted to a private temp directory, verified with the same
 * directory validator, then removed. No archive content is executed.
 */
export async function verifyPackageArchive(input){
 const entries=readZipEntries(input);
 const directory=await mkdtemp(join(tmpdir(),'company-theme-zip-'));
 try{
  for(const entry of entries){
   const target=join(directory,...entry.path.split('/'));
   await mkdir(dirname(target),{recursive:true});
   await writeFile(target,entry.bytes,{flag:'wx'});
  }
  return await verifyPackage(directory);
 }finally{
  await rm(directory,{recursive:true,force:true});
 }
}

function escapeHtml(value){
 return String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function previewHtml(result,previewName){
 const {manifest,digest,totalBytes}=result;
 const files=manifest.files.map(file=>`<li>${escapeHtml(file.path)} · ${file.bytes} B · ${escapeHtml(file.sha256.slice(0,16))}…</li>`).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(manifest.id)} · 主题包技术预览</title><style>body{margin:0;padding:24px;background:#fbf5e8;color:#293c30;font:14px/1.75 "Microsoft YaHei","PingFang SC",sans-serif}main{max-width:960px;margin:auto}h1{font-size:26px;line-height:1.35}p,li{overflow-wrap:anywhere}img{max-width:100%;height:auto;border:1px solid #c7c8ae;border-radius:12px;background:#e8d6ba}.note{padding:12px 15px;border:1px solid #c39b73;border-radius:10px;background:#fff0dc;color:#973b29}.facts{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;font-size:13px}.facts dt{color:#5f6b58}.facts dd{margin:0;overflow-wrap:anywhere}code{overflow-wrap:anywhere;word-break:break-all}</style></head><body><main><h1>${escapeHtml(manifest.name)}</h1><p>${escapeHtml(manifest.description)}</p><p class="note">技术检查与预览 artifact，不代表总部审核通过、APPROVED 或 LISTED，也不会写入市场目录。预览图为包内已校验图片；CI 不执行第三方代码，也不重新渲染 3D。</p><img src="${escapeHtml(previewName)}" alt="${escapeHtml(manifest.name)} 预览图"><h2>元数据</h2><dl class="facts"><dt>包 ID</dt><dd><code>${escapeHtml(manifest.id)}</code></dd><dt>版本</dt><dd>${escapeHtml(manifest.version)}</dd><dt>作者</dt><dd>${escapeHtml(manifest.author)}</dd><dt>许可</dt><dd>${escapeHtml(manifest.license)}</dd><dt>布局契约</dt><dd>${escapeHtml(manifest.compatibleContract)}</dd><dt>固定 commit</dt><dd><code>${escapeHtml(manifest.source.commit)}</code></dd><dt>来源仓库</dt><dd><a href="${escapeHtml(manifest.source.repository)}" rel="noreferrer">${escapeHtml(manifest.source.repository)}</a></dd><dt>包摘要</dt><dd><code>${escapeHtml(digest)}</code></dd><dt>文件总字节</dt><dd>${totalBytes} B</dd></dl><h2>文件</h2><ul>${files}</ul><p><a href="metadata.json" rel="noreferrer">下载元数据 JSON</a></p></main></body></html>`;
}

/** Build a trusted, human-reviewable preview artifact from an already verified package directory. */
export async function buildPreviewArtifact(directory,outputRoot){
 const loaded=await loadAndVerify(directory),result=loaded.result,manifest=result.manifest;
 for(const model of MODEL_IDS){const path=result.theme.models[model]||`furniture/${model}.glb`;if(!manifest.files.some(f=>f.path===path))throw Error(`投稿完整包缺少运行所需模型：${model}`);}
 const output=join(resolve(outputRoot),manifest.id);
 await mkdir(output,{recursive:true});
 const data=join(output,'data');await mkdir(data,{recursive:true});
 for(const file of loaded.files){const target=join(data,...file.path.split('/'));await mkdir(dirname(target),{recursive:true});await writeFile(target,file.data,{flag:'wx'});}
 await writeFile(join(data,MANIFEST_NAME),JSON.stringify(manifest),{flag:'wx'});
 const preview=loaded.files.find(file=>file.path===manifest.previewPath);
 if(!preview)throw new Error(`主题包缺少preview文件：${manifest.previewPath}`);
 if(preview.data.length>5*1024*1024)throw new Error('预览图超过5MiB，无法生成审核artifact');
 const extension=extname(manifest.previewPath).slice(1).toLowerCase();
 if(!['png','webp','jpg'].includes(extension))throw new Error('预览文件扩展名无效');
 const previewName=`preview.${extension}`;
 await writeFile(join(output,previewName),preview.data,{flag:'wx'});
 const metadata={schemaVersion:1,id:manifest.id,version:manifest.version,compatibleContract:manifest.compatibleContract,digest:result.digest,totalBytes:result.totalBytes,source:manifest.source,previewPath:manifest.previewPath,previewSource:'包内预览图与可信构建的交互3D查看器',approved:false,listed:false,note:'技术预览，不是总部审核或上架结果。'};
 await writeFile(join(output,'metadata.json'),JSON.stringify(metadata,null,2),{flag:'wx'});
 const viewer=`../viewer/apps/preview/index.html?package=${encodeURIComponent('../../../'+manifest.id+'/data/')}`;
 const html=previewHtml(result,previewName).replace("img-src 'self' data:;","img-src 'self' data:; frame-src 'self';").replace('CI 不执行第三方代码，也不重新渲染 3D。','下方交互场景由可信基线编译，逐文件校验冻结包；不执行投稿代码。').replace('<h2>元数据</h2>',`<h2>实际 3D 场景</h2><iframe title="冻结包3D预览" src="${viewer}" sandbox="allow-scripts allow-same-origin" style="width:100%;height:740px;border:1px solid #c7c8ae"></iframe><h2>元数据</h2>`);
 await writeFile(join(output,'index.html'),html,{flag:'wx'});
 return {output,previewName,metadata,manifest,digest:result.digest,totalBytes:result.totalBytes};
}

async function findPackageDirectories(root,depth=0,budget={entries:0}){
 if(depth>8)throw new Error('投稿目录层级过深');
 const info=await lstat(root).catch(()=>null);
 if(!info)return [];
 if(info.isSymbolicLink())throw new Error('投稿目录不允许符号链接');
 if(!info.isDirectory())throw new Error('投稿路径必须是目录');
 const entries=await readdir(root,{withFileTypes:true});
 if(entries.some(entry=>entry.isSymbolicLink()))throw new Error('投稿目录不允许符号链接');
 if(++budget.entries>2000)throw new Error('投稿目录条目过多');
 if(entries.some(entry=>entry.name==='theme-package.json'))return [root];
 const found=[];
 for(const entry of entries)if(entry.isDirectory())found.push(...await findPackageDirectories(join(root,entry.name),depth+1,budget));
 return found;
}

/**
 * Trusted PR helper: validate all submitted package directories, build preview
 * artifacts and metadata. It never marks approvals/listings and never runs
 * submitted code. Missing submission directories are reported as zero packages.
 */
export async function preparePrPreview(submissionRoot,outputRoot){
 const root=resolve(submissionRoot),output=resolve(outputRoot);
 const directoryInfo=await lstat(root).catch(()=>null);
 const directories=directoryInfo?await findPackageDirectories(root):[];
 if(directories.length>50)throw new Error('单次PR最多检查50个主题包');
 const items=[];const ids=new Set();
 for(const directory of directories.sort()){
  const preview=await buildPreviewArtifact(directory,output);
  if(relative(root,directory)!==preview.manifest.id)throw Error('投稿目录必须是 themes/<包ID>/，版本保存在清单中');
  if(ids.has(preview.manifest.id))throw new Error(`投稿包ID重复：${preview.manifest.id}`);
  ids.add(preview.manifest.id);
  items.push({id:preview.manifest.id,version:preview.manifest.version,compatibleContract:preview.manifest.compatibleContract,digest:preview.digest,totalBytes:preview.totalBytes,source:preview.manifest.source,preview:`${preview.manifest.id}/index.html`,approved:false,listed:false});
 }
 const summary={schemaVersion:1,items,approved:false,listed:false,note:'技术检查与预览 artifact；审批与上架必须由总部人类明确操作。'};
 await mkdir(output,{recursive:true});
 await writeFile(join(output,'summary.json'),JSON.stringify(summary,null,2));
 const markdown=items.length?`# 主题包技术检查预览\n\n${items.map(item=>`- [${item.id}@${item.version}](${item.preview}) · ${item.digest} · ${item.totalBytes} B`).join('\n')}\n\n> 本 artifact 不代表 APPROVED/LISTED；审批和上架必须由总部人类明确操作。\n`:'# 主题包技术检查预览\n\n未发现带 `theme-package.json` 的投稿包。\n\n> 没有自动审批或上架。\n';
 await writeFile(join(output,'summary.md'),markdown);
 return summary;
}

/** Compile only this trusted checkout, never the submission's configuration. */
export async function buildTrustedPreviewViewer(outputRoot){
 const trusted=fileURLToPath(new URL('..',import.meta.url)),output=resolve(outputRoot,'viewer');
 const {build}=await import('vite');
 await build({configFile:false,root:trusted,base:'./',publicDir:false,build:{outDir:output,emptyOutDir:true,target:'es2022',rolldownOptions:{input:{preview:join(trusted,'apps/preview/index.html')}}}});
 await cp(join(trusted,'public/draco'),join(output,'draco'),{recursive:true});
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
 if(command==='verify-zip'){
  if(rest.length!==1)throw new Error('用法：node tools/theme-package.mjs verify-zip <package.zip>');
  const result=await verifyPackageArchive(await readFile(rest[0]));
  console.log(JSON.stringify({id:result.manifest.id,version:result.manifest.version,compatibleContract:result.manifest.compatibleContract,digest:result.digest,totalBytes:result.totalBytes,fileCount:result.manifest.files.length},null,2));
  return;
 }
 if(command==='preview'){
  if(rest.length!==2)throw new Error('用法：node tools/theme-package.mjs preview <dir> <new-output-dir>');
  const preview=await buildPreviewArtifact(rest[0],rest[1]);
  console.log(JSON.stringify({id:preview.manifest.id,version:preview.manifest.version,digest:preview.digest,output:preview.output,approved:false,listed:false},null,2));
  return;
 }
 if(command==='pr-preview'){
  if(rest.length!==2)throw new Error('用法：node tools/theme-package.mjs pr-preview <submission-themes-dir> <new-output-dir>');
  console.log(JSON.stringify(await preparePrPreview(rest[0],rest[1]),null,2));
  await buildTrustedPreviewViewer(rest[1]);
  return;
 }
 throw new Error('用法：node tools/theme-package.mjs <verify|pack|verify-zip|preview|pr-preview> ...');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.argv.slice(2)).catch(error=>{
  console.error(`theme-package: ${error.message}`);
  process.exitCode=1;
 });
}
