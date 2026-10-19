# 资源来源与排除项

本仓库原创代码、UI、主题及配套文档按 [MIT License](LICENSE.md) 发布。第三方代码与素材保留各自许可，详见下文及 `public/licenses/`；MIT 不替代这些第三方许可，也不授予公司商标、名称或个人肖像的权利。

Kenney Furniture Kit 的官方页面 https://kenney.nl/assets/furniture-kit 标为 Creative Commons CC0，2026-10-19核对。仓库内13个家具沿用本地已有的 Tiny Game Engine GLB 转换；保留原随附CC0说明。不是新下载的整套上游140件。

`public/draco/` 是现有工程的 Google Draco 解码器，Apache-2.0；`public/licenses/` 保留 Draco 与 Three.js 许可。精确资源哈希及字节数见 `asset-catalog.json`。

`public/furniture/warm/` 与 `public/furniture/cyber/` 各13件、共26件静态家具为本项目原创，采用 MIT；可由 `node tools/build-cyber-furniture.mjs` 重建。两套是独立几何而非同模型换色：暖木使用车制木腿、软包壳体、藤编柜门与陶土花盆；星港使用悬挑钢架、模块柜体与整合光带，包含独立的圆润会客椅、储物柜、咖啡机、书架、书堆、笔记本与小盆栽。每件按1米高度归一，单件不超过8个绘制批次与1800个三角面，并受 `src/model-budgets.json` 的包围盒约束。相同材质的部件在导出时合并以减少绘制，家具实例仍分别编辑；这些文件不包含角色骨骼或动画。

`source/blender/furniture-library.blend` 是在本机 Blender 5.2 中，从这13个GLB导入、分集合整理并重新保存的派生文件，沿用家具CC0。没有原始拓扑制作历史，不声称恢复了作者源工程。总部建筑与通用机器人直接由 `src/office.ts` 创建，没有对应原作者 `.blend`。

没有发布：老板照片、官网人物图、老板带骨骼GLB/Blender工程、Hunyuan输出、官网项目图标、参考截图、商业素材、医院或研究资料。它们在主工程仍可正常使用；是否允许公众修改和再分发，需要另行审核。
