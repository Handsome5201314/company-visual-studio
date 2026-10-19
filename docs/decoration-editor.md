# 装修创作台与主游戏接入

创作台位于 `apps/editor/index.html`，不需要公司账户。设计仅在当前浏览器处理，保存导出 JSON，预览图导出 PNG；不上传公司数据，不修改正式游戏。Showroom 页头可进入创作台与装修市场。

`src/decoration-editor.ts` 导出的 `createDecorationEditor(host, initial, options)` 与主游戏共用。`initial` 包含受验证的 `theme` 和 `scene`；`options.save/submit` 由私有宿主提供真实API，公共入口不提供后端写入。返回 `design` 快照和 `dispose()`；关闭面板必须dispose。`readOnly` 拒绝选中/拖动，允许镜头环绕；可提供 `comparison` 与 `comparisonAssetBase` 比较当前正式版本。

首版支持13个 `MODEL_IDS` 模型，编辑范围由 `decoration-safety.js` 明确限定在接待台、两组工作台和书架原有障碍内。数值摆放和指针拖动共用验证，位置按0.05米吸附；物件重叠、超出体积或不认识的模型会报错。建筑、楼梯、碰撞、门禁与员工位置由宿主控制。

可以选择、添加、删除、替换、旋转、缩放陈设，修改主体材质色，调整一盏接待区装饰灯，撤销/重做50步，导入小于1MiB的兼容设计JSON。右侧工具可滚动，移动端排列在场景之后，所有精确操作均有表单入口。

设计JSON不是完整主题包。要公开投稿，需使用 [Theme Package 标准](theme-package.md) 补齐静态资源、真实许可、封面、来源仓库/提交并打包。审核和正式应用属于私有宿主，不由编辑器或公开仓库决定。

`OfficeVisuals.setDecoration(scene)` 仅生成可编辑视觉层；`OfficeVisuals` 支持已验证的 `packageAssetBase`，只有明确登记的静态模型走包内路径，Draco解码器仍来自宿主可信资源。加载候选主题时应在游离Scene中构建，全部资源及陈设成功才替换旧Root，失败dispose候选并保留旧视觉。角色和多人Root不放入装修Root。

未来科技变体含模块地板、导光楼梯、悬架工位、环灯与外部塔群，沿用同一布局契约。不能把新建筑布局直接当主题应用，新的布局须另行迁移私有碰撞与门禁。
