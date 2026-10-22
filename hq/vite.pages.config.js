import {defineConfig} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// GitHub Pages 演示构建。与 vite.config.js（宿主完整前端）分开：
// - 只构建 demo.html（场景 + 走动），不构建需要 /api 的完整页面；
// - base 指向仓库子路径，运行时资源统一走 import.meta.env.BASE_URL；
// - 站点根 index.html 是一张跳转卡，直接进入演示页。
const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.COMPANY_PAGES_BASE || '/company-visual-studio/';
const buildId = process.env.COMPANY_BUILD_ID || `pages-${Date.now()}`;

const landing = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=./demo.html">
<title>童医魔盒 · 三层暖木总部演示</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#f2e8d8;color:#2f4a34;font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif}main{text-align:center;line-height:1.8}p{margin:0 0 12px;font-size:14px}a{color:#2f6b45}</style>
</head><body><main><p>正在打开北京童医魔盒科技服务有限公司三维总部演示…</p><p><a href="./demo.html">如果没有自动跳转，点这里继续</a></p></main></body></html>`;

function pagesLanding(){
  return {
    name:'pages-landing',
    closeBundle(){
      const dist = resolve(here, 'dist');
      mkdirSync(dist, {recursive:true});
      writeFileSync(resolve(dist, 'index.html'), landing);
    },
  };
}

export default defineConfig({
  root: here,
  base,
  define: {
    'import.meta.env.VITE_VISUAL_SOURCE_COMMIT': JSON.stringify(process.env.VISUAL_SOURCE_COMMIT || ''),
    'import.meta.env.VITE_COMPANY_BUILD_ID': JSON.stringify(buildId),
  },
  plugins: [pagesLanding()],
  resolve: {dedupe:['three']},
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {demo: resolve(here, 'demo.html')},
    },
  },
});
