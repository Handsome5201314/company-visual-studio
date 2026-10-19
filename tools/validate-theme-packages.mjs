import {readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPackage} from './theme-package.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
let count=0;
async function walk(dir,depth=0){
 if(depth>8)throw new Error('主题源码目录层级过深');
 const entries=await readdir(dir,{withFileTypes:true});
 if(entries.some(e=>e.isSymbolicLink()))throw new Error('主题源码不允许符号链接');
 if(entries.some(e=>e.name==='theme-package.json')){const r=await verifyPackage(dir);console.log(JSON.stringify({id:r.manifest.id,version:r.manifest.version,digest:r.digest,approved:false}));count++;return;}
 for(const e of entries)if(e.isDirectory())await walk(join(dir,e.name),depth+1);
}
await walk(resolve(root,'themes'));console.log(`Validated ${count} contributed theme packages. Technical validation does not list market submissions.`);
