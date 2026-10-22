import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const files=execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
if(!files.length)throw new Error('没有可检查的Git文件；先显式暂存允许公开的文件');
// 超过 10MB 的公开副本二进制必须逐个登记：字节数与 SHA-256 都在这里核对，
// 防止“大文件随手进仓库”或“登记之后又被替换”。
const largeManifest=JSON.parse(readFileSync(resolve(root,'hq/public/models/LARGE-ASSETS.json'),'utf8'));
if(!Array.isArray(largeManifest.assets))throw new Error('LARGE-ASSETS.json 缺少 assets 数组');
const largeByPath=new Map(largeManifest.assets.map(asset=>[asset.path,asset]));
const allowed=/^(\.github\/|apps\/|src\/|themes\/|tests\/|tools\/|docs\/|public\/|source\/|hq\/|\.impeccable\/(?:design\.json|surfaces\/showroom\.md)$|(?:README|CONTRIBUTING|LICENSE|NOTICE|PRODUCT|DESIGN)\.md$|(?:package(?:-lock)?|tsconfig|asset-catalog)\.json$|index\.html$|vite\.config\.js$|\.gitignore$|\.gitattributes$)/;
for(const file of files){
 if(!allowed.test(file)||/(^|\/)(\.env(?:\.|$)|\.local|node_modules|server|integrations|dist)(\/|$)/.test(file)||/\.(sqlite\w*|pem|key|log)$/i.test(file))throw new Error('禁止发布路径：'+file);
 const path=resolve(root,file),stat=lstatSync(path);if(stat.isSymbolicLink())throw new Error('禁止发布符号链接');
 if(stat.size>10*1024*1024){
  const entry=largeByPath.get(file);
  if(!entry)throw new Error('超过10MB且未登记 LARGE-ASSETS.json：'+file);
  const digest=createHash('sha256').update(readFileSync(path)).digest('hex');
  if(entry.bytes!==stat.size||String(entry.sha256).toLowerCase()!==digest)throw new Error('大文件与登记不一致：'+file);
  continue;
 }
 if(['.glb','.wasm','.blend','.png'].includes(extname(file)))continue;
 const content=readFileSync(path,'utf8');
 const suspicious=[/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{25,}/,/sk-[A-Za-z0-9]{25,}/,/(?:api[_-]?key|password|secret|token)\s*[:=]\s*["'][A-Za-z0-9+\/_=-]{20,}["']/i];
 if(suspicious.some(p=>p.test(content)))throw new Error('疑似凭证，仅报告路径：'+file);
}
console.log(`Checked ${files.length} tracked files; no forbidden paths or matching credential patterns (${largeByPath.size} large binaries verified by SHA-256). This is a bounded check, not proof of absence.`);
