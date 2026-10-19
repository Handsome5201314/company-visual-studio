# 主题开发

复制 `themes/default/`，修改目录与 `id`，并在 `src/theme.js` 的本地注册表中导入清单。首版只加载经过代码审查的仓库内 JSON，没有远程URL安装器或任意CSS/脚本入口。

`schemaVersion: 1` 与 `compatibleContract: hq-fixed-layout-v1` 必须保留。`name/version/author/description` 是主题元数据。缩略图本轮未提供，不用未授权图片补位。

- `ui`：paper/ink/muted/accent/line/error/horizon 六位颜色，字体采用现有系统字体。布局与动效由共用样式、组件源码维护；清单不接受任意CSS字符串。部分既有组件内部仍有固定辅助色，不声称所有CSS值都已令牌化。
- `environment`：建筑材质的调色映射、背景、天光/主光/补光颜色与强度、曝光。不能更改角色坐标和锚点。
- `models`：仅允许13个现有家具ID，值必须是 `furniture/` 内GLB相对路径，同时列入 `assets`，并登记 `asset-catalog.json`。
- `character`：sage/cobalt。当前只处理通用机器人配色，不自动给老板换脸或重定向动画。

主游戏和展厅使用同一个 `OfficeVisuals`。装修替换会先在独立Scene构建并加载新资源；成功后替换旧视觉Root，员工、相机和业务控制器保留。失败显示错误并保留旧Root。UI和角色配色独立应用。

`src/layout-contract.json` 是主游戏几何与交互点的验收快照；私有主工程测试会与权威 `world.js`、员工目的地做比较，服务端始终决定移动权限。`src/model-budgets.json` 限制替换家具在单位高度下的宽深，不允许比原模型明显更宽。它是防止误改的包围盒约束，不等于完整碰撞验证或地图编辑器。

新布局需单独变更契约版本，同时迁移服务器碰撞、寻路、楼梯、门禁和目的地；通过真实移动与MCP测试后才能上线。不能只改模型后宣称所有路径兼容。
