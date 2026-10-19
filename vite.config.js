import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({base:'./',server:{host:'127.0.0.1',port:5312,strictPort:true},build:{target:'es2022',rolldownOptions:{input:{showroom:resolve('index.html'),editor:resolve('apps/editor/index.html')}}}});
