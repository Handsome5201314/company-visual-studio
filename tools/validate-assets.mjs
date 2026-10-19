import {readFileSync,readdirSync,statSync,realpathSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateTheme,MODEL_IDS} from '../src/theme.js';
import {inspectGLB} from '../src/glb.js';
const root=fileURLToPath(new URL('..',import.meta.url));
export function validateAssets(){
 const catalog=JSON.parse(readFileSync(resolve(root,'asset-catalog.json'))),known=new Set();
 for(const asset of catalog){
  if(!/^(furniture\/[a-z0-9_/-]+\.glb|draco\/[a-z_]+\.(js|wasm)|licenses\/[A-Za-z0-9-]+\.txt)$/.test(asset.path)||asset.path.includes('..'))throw new Error('资源路径越界');
  const full=resolve(root,'public',asset.path),real=realpathSync(full);if(!real.startsWith(resolve(root,'public')+sep))throw new Error('资源不得链接到仓库外');
  const bytes=readFileSync(full);if(bytes.length>10*1024*1024)throw new Error('单资源超过10MB');
  if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error('资源变更后须更新asset-catalog和许可：'+asset.path);
  if(!['CC0-1.0','Apache-2.0','MIT'].includes(asset.license)||!asset.source)throw new Error('缺少再分发许可');
  if(asset.path.endsWith('.glb'))inspectGLB(bytes);
  known.add(asset.path);
 }
 function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isSymbolicLink())throw new Error('public不允许符号链接');if(entry.isDirectory())walk(p);else if(!known.has(relative(resolve(root,'public'),p).split(sep).join('/')))throw new Error('public包含未审核文件：'+entry.name);}}
 walk(resolve(root,'public'));
 for(const id of MODEL_IDS)if(!known.has(`furniture/${id}.glb`))throw new Error('缺少默认家具：'+id);
 for(const dir of readdirSync(resolve(root,'themes'),{withFileTypes:true}).filter(d=>d.isDirectory())){const theme=validateTheme(JSON.parse(readFileSync(resolve(root,'themes',dir.name,'theme.json'))));if(theme.id!==dir.name)throw new Error('主题目录和ID不一致');for(const p of theme.assets)if(!known.has(p))throw new Error('主题包含未审核资源');}
 return catalog.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(`Validated ${validateAssets()} licensed assets and all themes`);
