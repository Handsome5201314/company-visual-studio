import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {THEMES,MODEL_IDS} from '../src/theme.js';
import {validateAssets} from './validate-assets.mjs';
import {verifyPackage} from './theme-package.mjs';
import {effectiveModelPaths} from '../src/theme-package-export.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const repository='https://github.com/Handsome5201314/company-visual-studio';
// Reproducible source-package build only. Does not grant headquarters approval or list a theme.
export async function buildShippedPackage(id,output){
 const original=THEMES.find(t=>t.id===id);if(!original)throw new Error('未知内置主题');
 validateAssets();const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const catalog=JSON.parse(await readFile(join(root,'asset-catalog.json'),'utf8'));
 const paths=effectiveModelPaths(original);
 const models=[...new Set(Object.values(paths))].map(path=>{const asset=catalog.find(item=>item.path===path);if(!asset)throw new Error(`asset-catalog缺少家具：${path}`);return asset;});
 const theme={...structuredClone(original),models:paths,assets:models.map(a=>a.path)};
 const scene={schemaVersion:1,compatibleContract:theme.compatibleContract,objects:[],lights:[]};
 const files=new Map([
  ['theme.json',{bytes:Buffer.from(JSON.stringify(theme)),license:'MIT'}],
  ['scene.json',{bytes:Buffer.from(JSON.stringify(scene)),license:'MIT'}],
  ['preview.png',{bytes:await readFile(join(root,'docs/images',id==='default'?'warm-showroom.png':'cyber-showroom.png')),license:'MIT'}],
  ['README.md',{bytes:Buffer.from(`# ${theme.name}\n\n原始源码主题包，仅通过技术检查；未自动取得市场认证或公司应用批准。\n\n来源 ${repository}/tree/${commit}\n原创家具使用 MIT；Kenney 家具保留 CC0 许可，逐文件许可见清单。\n`),license:'MIT'}],
  ['LICENSE.txt',{bytes:await readFile(join(root,'LICENSE.md')),license:'MIT'}],
  ['licenses/Kenney-CC0.txt',{bytes:await readFile(join(root,'public/licenses/Kenney-CC0.txt')),license:'CC0-1.0'}]
 ]);
 for(const a of models)files.set(a.path,{bytes:await readFile(join(root,'public',a.path)),license:a.license,source:a.source});
 const manifest={schemaVersion:1,id:theme.id,name:theme.name,author:theme.author,version:theme.version,description:theme.description,styles:[id==='default'?'warm-wood':'cool-blue'],compatibleContract:theme.compatibleContract,license:'MIT',source:{repository,commit},themePath:'theme.json',scenePath:'scene.json',previewPath:'preview.png',files:[...files].map(([path,f])=>({path,bytes:f.bytes.length,sha256:createHash('sha256').update(f.bytes).digest('hex'),license:f.license,source:f.source||repository}))};
 const directory=resolve(output);await mkdir(directory,{recursive:false});
 for(const[path,f]of files){const target=join(directory,path);await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,f.bytes,{flag:'wx'});}
 await writeFile(join(directory,'theme-package.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
 return verifyPackage(directory);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw new Error('用法：node tools/build-shipped-package.mjs <default|cyber> <new-directory>');const r=await buildShippedPackage(process.argv[2],process.argv[3]);console.log(JSON.stringify({id:r.manifest.id,digest:r.digest,totalBytes:r.totalBytes,approved:false}));}catch(e){console.error(e.message);process.exitCode=1;}
}
