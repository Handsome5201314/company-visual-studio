# hq/ — 线上 3D 总部的宿主前端

本目录是生产站点前端（宿主层）的协作副本：场景装配、相机、碰撞、SSE 同步、2D 页面与各业务面板 UI。

- **视觉层在本仓库根目录**（`src/office.ts`、`src/ui/`、`themes/`、`furniture/` 等）；`hq/src` 通过 `../../src/...` 引用它们。
- **不含服务端**：`/api` 需要私有主工程提供；没有它时，3D 场景与模型仍可本地浏览，业务页面显示未连接/空态（预期行为）。
- **不含的素材**：`public/ip/story/`（个人生活照）与 `public/models/shuai-clean-20261020.glb`（超大本地模型）。

## 运行

```bash
cd hq
npm install
npm run dev      # http://127.0.0.1:5312
```

`npm run build` 输出 `hq/dist/`。若要同时跑视觉层自己的开发服务（根目录 `npm run dev`，同样占用 5312），二者需错开端口或分时运行。

## 目录

```
hq/
  index.html / portal.html / character-review.html / headquarters-review.html
  src/            # 宿主场景与页面（scene.ts、main.ts、portal.ts、founder.ts…）
  public/         # 模型、品牌、项目图、ip 素材（无 story）
  vite.config.js  # dev 5312，/api 代理到 5313
```
