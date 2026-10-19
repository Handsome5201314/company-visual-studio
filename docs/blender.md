# 用 Blender 修改家具

1. 在Blender打开 `source/blender/furniture-library.blend`。每件家具位于同名集合。此库由GLB派生，原作者完整源工程未提供。
2. 复制需要改的集合/文件后编辑，保留原GLB作为对照。单位米；Blender内部Z向上，glTF导出器转换为运行时+Y。
3. 选中一件家具的全部对象，导出glTF 2.0，格式GLB，启用“仅选中对象”，内嵌纹理。导出单件家具，不把整间库一起导出。导出前应用尺度，避免过高面数、外部贴图和隐藏的私人对象。
4. 在展厅“检查自己的模型”导入。它只在浏览器解析，不上传。检查尺寸、材质、朝向与需要的蒙皮/动作；导入模型台不会直接替换正式家具。
5. 将最终GLB放入 `public/furniture/`，登记来源/许可/哈希，修改主题的 `models` 和 `assets`，在完整场景复核。运行时按原家具高度归一化并检查宽深预算；超界请修改模型或提布局迁移，不能通过扩大包围盒绕过。

需要重新生成一个新的库文件：

```sh
blender --factory-startup -b --python tools/create-blender-source.py -- source/blender/my-library.blend
```

脚本遇到已存在目标会拒绝覆盖。GLB导入后的模型可编辑，但不会神奇恢复原作者的修改器、绑定工作流或制作历史。

人物模型如果需要真实行走，必须包含实际蒙皮与对应动画。展厅会显示skins和动画名称；主游戏老板角色仍由私有 CharacterMotion 校验Idle/Walk，不能把无骨骼模型当成可直接替换的角色。
