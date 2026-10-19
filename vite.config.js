import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const sourceCommit=existsSync('.git')?execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim():(process.env.VISUAL_SOURCE_COMMIT||'');
export default defineConfig({base:'./',define:{'import.meta.env.VITE_VISUAL_SOURCE_COMMIT':JSON.stringify(sourceCommit)},server:{host:'127.0.0.1',port:5312,strictPort:true},build:{target:'es2022',rolldownOptions:{input:{showroom:resolve('index.html'),editor:resolve('apps/editor/index.html'),preview:resolve('apps/preview/index.html')}}}});
