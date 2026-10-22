import {defineConfig} from 'vite';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// 宿主前端（线上 3D 总部的场景与页面）与视觉层的协作构建配置。
// 视觉层（office/themes/furniture/UI 外壳）在本仓库根目录，宿主在 hq/。
const here = dirname(fileURLToPath(import.meta.url));
const visualRoot = resolve(here, '..');
const buildId = process.env.COMPANY_BUILD_ID || `local-${Date.now()}`;

function buildVersion() {
  return {
    name: 'company-build-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: JSON.stringify({id: buildId, builtAt: new Date().toISOString()}),
      });
    },
  };
}

export default defineConfig({
  root: here,
  define: {
    'import.meta.env.VITE_VISUAL_SOURCE_COMMIT': JSON.stringify(process.env.VISUAL_SOURCE_COMMIT || ''),
    'import.meta.env.VITE_COMPANY_BUILD_ID': JSON.stringify(buildId),
  },
  plugins: [buildVersion()],
  resolve: {dedupe: ['three']},
  server: {
    host: '127.0.0.1',
    port: 5312,
    strictPort: true,
    // 服务端属于私有主工程；本仓库不包含 /api 实现。
    // 需要真实接口时，在私有主工程启动开发服务（默认 5313）后由这里代理过去。
    proxy: {'/api': 'http://127.0.0.1:5313'},
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        company: resolve(here, 'index.html'),
        portal: resolve(here, 'portal.html'),
        characters: resolve(here, 'character-review.html'),
      },
    },
  },
});
