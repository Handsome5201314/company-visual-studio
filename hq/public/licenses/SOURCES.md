# 随项目素材来源

- `furniture/*.glb`：从既有个人 IP 总部工程复制的 Kenney CC0 家具；同目录 Kenney-CC0.txt 保留既有分发说明（Tiny Game Engine GLB 转换）。本轮未复制旧网站业务代码或数据。
- `models/shuai-rigged.glb`、`models/nurse-reference-20261020.glb`：用户授权的本人IP和护士参考形象，经本机图生3D与Blender整理、参考纹理修正后接入。老板有20骨和 Idle/Walk，护士静态；形象还原尚未获用户接受。2026-10-20保留当前在用文件和 `artifacts/active-characters/` 打包源工程，按用户要求删除旧角色候选；原图和原始工作流保留。上游生成模型条款未在此次清理中重新审核。
- `brand/shuai-reference.webp`：用户指定官网 `https://xiaozhiserver.cloud/assets/profile/hero-character-wave.webp`，仅作为本人品牌素材。
- `projects/*`：2026-10-19 从用户官网 `/assets/projects/` 获取的公开项目图标，按用户授权仅用于本游戏展示。项目文案快照在 `src/data/projects.json`，不导入网站私有数据。
- Three.js：MIT，Three-LICENSE.txt；npm 包版本见 package-lock.json。
- `draco/*`：既有工程分发的 Draco 解码器，Google Draco Apache-2.0。原项目 https://github.com/google/draco ，许可副本 Draco-LICENSE.txt。正式客户端打包须保留这些说明。

总部建筑几何、机器人接待外形与页面界面为本项目代码原生实现；没有从参考截图提取/下载场景模型。上游 Agent Office 未被复制到本项目，因此不将其候选界面截图当作本项目素材。
