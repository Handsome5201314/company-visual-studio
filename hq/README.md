# hq/ — 线上 3D 总部的宿主前端

本目录是生产站点前端（宿主层）的协作副本：场景装配、相机、碰撞、SSE 同步、2D 页面与各业务面板 UI。

- **视觉层在本仓库根目录**（`src/office.ts`、`src/ui/`、`themes/`、`furniture/` 等）；`hq/src` 通过 `../../src/...` 引用它们。
- **不含服务端**：`/api` 需要私有主工程提供；没有它时，3D 场景与模型仍可本地浏览，业务页面显示未连接/空态（预期行为）。
- **不含的素材**：`public/ip/story/`（个人生活照）与 `public/models/shuai-clean-20261020.glb`（超大本地模型）。
- **大文件须登记**：[public/models/LARGE-ASSETS.json](public/models/LARGE-ASSETS.json) 记录超过 10MB 的 3 个模型（字节数 + SHA-256），由 `tools/check-publish.mjs` 逐个核对；新增或替换模型必须同步更新。

## 运行

```bash
cd hq
npm install
npm run dev      # http://127.0.0.1:5312
```

`npm run build` 输出 `hq/dist/`。若要同时跑视觉层自己的开发服务（根目录 `npm run dev`，同样占用 5312），二者需错开端口或分时运行。

## GitHub Pages 静态演示

[hq/demo.html](demo.html) 是一个只装配三维场景的静态演示页（与线上同一套 `Headquarters` 与视觉层），不引用 `main.ts` 的会话、SSE 或任何 `/api` 调用；接待、案例、留言与后台需要服务端，因此不在演示范围内。

```bash
cd hq
npm ci
npm run build:demo      # 构建到 hq/dist，base=/company-visual-studio/
npm run preview:demo    # 本地预览 http://127.0.0.1:5399/company-visual-studio/
```

推送 `main`（改动 `hq/**` 或根目录 `src/**`）会触发 [.github/workflows/pages.yml](../.github/workflows/pages.yml) 构建并发布；站点根 `index.html` 是一张跳转到 `demo.html` 的卡片。

运行时模型、贴图与 DRACO 解码器统一经过 `hq/src/asset-base.ts` 的 `asset()`，由 `import.meta.env.BASE_URL` 决定前缀：线上部署为 `/`，Pages 部署为 `/company-visual-studio/`。新增资源加载时不要再写死 `/`。

## 目录

```
hq/
  index.html / portal.html / character-review.html / headquarters-review.html
  demo.html       # GitHub Pages 静态演示（场景 + 走动）
  src/            # 宿主场景与页面（scene.ts、main.ts、portal.ts、founder.ts…）
  src/asset-base.ts  # 运行时资源基地址（BASE_URL）
  public/         # 模型、品牌、项目图、ip 素材（无 story）
  vite.config.js       # dev 5312，/api 代理到 5313
  vite.pages.config.js # Pages 演示构建（base=/company-visual-studio/）
```
