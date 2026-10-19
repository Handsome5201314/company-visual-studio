---
name: 公司视觉工作室
description: 暖阳木质总部与纸色工具界面的现有视觉系统
colors:
  accent: "#365b43"
  paper: "#fbf5e8"
  ink: "#293c30"
  muted: "#5f6b58"
  line: "#c7c8ae"
  error: "#973b29"
  horizon: "#e8d6ba"
  cool-accent: "#245a75"
  cool-paper: "#f2f7fa"
  cool-ink: "#213a4a"
  cool-muted: "#4e6471"
  cool-line: "#b3c9d3"
  cool-error: "#a43436"
  cool-horizon: "#dae8ef"
  on-accent: "#fff8e6"
  button-hover: "#e4e9d4"
  primary-hover: "#264a34"
  focus: "#8c4d26"
  field: "#fffdf5"
  field-line: "#a9b49a"
  status-fill: "#e2e8d4"
typography:
  display:
    fontFamily: '"STKaiti","KaiTi",serif'
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-.02em"
  headline:
    fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif'
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.02em"
  title:
    fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif'
    fontSize: "24px"
    fontWeight: 600
  body:
    fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif'
    fontSize: "14px"
    lineHeight: 1.85
  label:
    fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif'
    fontSize: "13px"
    fontWeight: 500
rounded:
  field: "8px"
  control: "12px"
  panel: "16px"
  status: "6px"
spacing:
  observed-8: "8px"
  observed-10: "10px"
  observed-12: "12px"
  observed-16: "16px"
  observed-20: "20px"
  observed-24: "24px"
  observed-28: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.button-hover}"
  input-shared:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px"
    width: "100%"
  input-showroom:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px"
    width: "100%"
  camera-choice:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  camera-choice-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  status-chip:
    backgroundColor: "{colors.status-fill}"
    rounded: "{rounded.status}"
    padding: "6px 9px"
  entry-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "30px 34px"
  dialog-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
---

# Design System: 公司视觉工作室

## Overview

**Creative North Star: "暖阳木质工作室"**

现有世界以木地板、鼠尾草绿墙面、木格窗和两层挑空总部建立亲近感。空间由 Three.js 原生几何、材质和真实灯光构成；纸色界面与森林绿操作控件延续室内的材料关系。

工具界面采用清楚、克制的系统字体与单列控件。主游戏入口保留楷体标题；展厅工具标题使用系统无衬线字体。冷蓝对照主题沿用同一空间及交互锚点，改变建筑配色、光照和界面颜色。

本文件是现有代码的提取记录。颜色、排版、圆角和组件常量见 frontmatter；未建立全局 token 的值如实标为观察值。页面编排与访客路径保存在 surface brief，不提升为全局设计规则。

**Key Characteristics:**

- 暖纸与森林绿连接木质、鼠尾草绿的总部空间。
- 真实三维几何与柔和投影提供深度，界面以平面分区为主。
- 系统字体、原生表单控件、明确焦点与可读操作状态。
- 矿物白与深海蓝作为同布局的冷色对照，保留现有主题覆盖边界。

提取来源：[共享样式](src/ui/style.css)、[展厅样式](apps/showroom/showroom.css)、[暖色主题](themes/default/theme.json)、[冷蓝主题](themes/cyber/theme.json)、[主题应用](src/theme.js)、[空间实现](src/office.ts)、[展厅实现](apps/showroom/main.ts)。方向与产品依据：[PRODUCT.md](PRODUCT.md)、[展厅约定](.impeccable/surfaces/showroom.md)。精确定位与抽取范围另见 [.impeccable/design.json](.impeccable/design.json) 的 extensions.sources。

## Colors

暖色主调由浅纸色承托深绿文字与森林绿动作；对照主题把这些角色换为矿物白、蓝灰和深海蓝。

### Primary

- **森林绿**（accent）：主要按钮、链接与被选中的展厅镜头。
- **深海蓝**（cool-accent）：冷色界面主题中的同角色值。

### Neutral

- **暖纸 / 矿物白**（paper / cool-paper）：工具栏、表单分区、提示与弹窗背景。
- **深叶墨 / 蓝墨**（ink / cool-ink）：主要文字。
- **苔灰 / 蓝灰**（muted / cool-muted）：工具说明与次级信息。
- **草灰线 / 冷灰线**（line / cool-line）：细描边与分隔线。
- **沙色地平线 / 冷雾地平线**（horizon / cool-horizon）：展厅舞台 CSS 背景；WebGL 场景背景由 environment.background 独立控制。
- **奶白动作文字**（on-accent）：两套界面主题都使用的主按钮与选中镜头文字。
- **浅田野悬停、深林悬停、浅米表单与草灰表单线**（button-hover / primary-hover / field / field-line）：共享 CSS 的固定辅助色。

### Semantic

- **砖红 / 冷砖红**（error / cool-error）：错误与离线状态文字。
- **棕色焦点**（focus）：所有现有共享可聚焦控件的键盘焦点外框。
- **淡草状态底**（status-fill）：共享状态标签底色，文字继承所在上下文。

**The Theme Boundary Rule.** 界面主题仅替换 paper、ink、muted、accent、line、error、horizon 七个 CSS 变量。当前悬停色、焦点色、部分表单、提示、状态和文字色仍为硬编码；冷色主题并非完整语义换肤。新增界面优先复用已存在的变量，不把本次提取当作辅助色已全部 token 化的证据。

空间调色以两份主题 JSON 的 environment 与 src/office.ts 为准；不把室内几十种材质颜色伪装成通用 UI token。冷色 palette 只重映射进入材质登记表的标准材质；单独创建的玻璃、灯泡、文字贴图及外部 GLB 不保证跟随该表改色。侧车的八级 OKLCH 色带仅供面板观察色相，属于合成预览，不是代码中已实现的色阶。

## Typography

**Display Font:** 系统楷体回退栈，用于主游戏入口标题。
**Body Font:** Microsoft YaHei、PingFang SC、sans-serif；现有工具界面的系统字体选择。
**Label/Mono Font:** 标签沿用正文栈；坐标及舞台指标使用等宽数字特性，没有另设等宽字体。

### Hierarchy

- **Display:** 入口卡片标题；使用 frontmatter 的 display，移动断点缩至（27px）。
- **Headline:** 展厅标题；使用 headline，展厅移动断点缩至（21px）。
- **Title:** 共享弹窗标题使用 title；共享移动断点为（21px）。展厅侧栏分区标题另为（17px），行高（1.5）。
- **Body:** 对话正文使用 body，最大行长（68ch）；入口说明另用行高（1.9），工具说明为（12px / 1.8）。
- **Label:** 共享字段标签使用 label；展厅侧栏标签为（12px）。
- **Supporting text:** 说明、指标、状态使用（10–13px）之间的已实现尺寸，按原组件场景保留。

没有统一比例字号系统，也没有外部字体加载。frontmatter 的 body 是共享对话正文角色，不代表整个页面根字号已被显式设定。700px 以下，共享聊天正文与 #panel 表单输入为（16px）；800px 以下，展厅侧栏输入、文本域和选择框为（16px）。

## Layout

共享界面叠置于固定铺满视口的三维世界，标题栏、任务、镜头控制和底部提示按各自锚点定位。弹窗采用居中原生 dialog，桌面最大宽度（660px），宽度为视口减（40px），最大高度为 100dvh 减（64px），内部滚动。

展厅在宽于（800px）时采用弹性舞台与（330px）工具栏两列。舞台顶端粘附，最小高度（600px）；工具栏内分组以细线分隔。800px 及以下改为单列，舞台高度（470px），控件在其后自然滚动。此处是展厅实现记录，其他页面布局仍以其 surface brief 为准。

共享移动断点为（700px），展厅移动断点为（800px）。粗指针查询启用共享方向按钮、竖排镜头按钮并抬高交互提示。间距来自现有 CSS 的多组像素值；frontmatter 的 observed-* 仅记录复用频繁的观察值，不声称代码存在统一 spacing 自定义属性。表单、按钮组和标题可按当前实现换行；长文本采用 overflow-wrap。

## Elevation & Depth

界面主要依靠纸色平面、细描边与分区呈现层次。入口卡片、主交互按钮和弹窗带局部柔和阴影；展厅侧栏与舞台信息条没有新增卡片阴影。空间深度来自网格几何、透视、材质粗糙度、灯光和投影。

### Shadow Vocabulary

- **入口抬升：**（0 16px 60px #463e2826）。
- **交互提示：**（0 10px 25px #302f2829）。
- **弹窗：**（0 22px 90px #242d2847），配合遮罩（#26372db8）。

空间默认标准材质粗糙度为（0.8），太阳投影贴图为（2048 × 2048），展厅使用 PCFSoftShadowMap、sRGB 输出与 ACESFilmicToneMapping。暖色主题半球光 / 太阳 / 补光强度为（1.7 / 4.2 / 1），曝光（1.08）；冷色主题为（2.3 / 2.8 / 1.9），曝光（1.16）。天空、地面、太阳、补光颜色及完整重映射表直接读取主题 JSON，不在文档另建材质真值表。

## Shapes

控件采用柔和圆角：基础按钮、任务块、相机控制容器复用 control；字段和信息条采用 field；入口卡与弹窗采用 panel；状态与舞台操作提示采用 status。边框通常为（1px）细线。入口卡和弹窗是连续实底表面，没有磨砂玻璃或复杂裁切。

三维世界保留挑空大厅、木格窗、夹层、真实楼梯和护栏。盒体、圆柱与有限的圆润几何共同构成家具与通用角色。当前角色是分层四肢模型，不能将其描述为完整人形蒙皮模型。

## Components

### Buttons

平实清楚的圆角操作控件。基础按钮采用 button-secondary，最小高度（44px）；主动作采用 button-primary。展厅侧栏按钮字号为（12px）。共享手机顶栏按钮存在（36px）最小高度的特例，不能声称全项目均达到 44px。

背景过渡时长（150ms），未显式指定 easing。悬停值见对应 frontmatter 变体；disabled 使用等待光标与（0.55）透明度。键盘 focus-visible 外框宽（3px）、偏移（4px），使用 focus 色。没有统一按压位移或缩放动画。

### Inputs / Fields

共享输入、文本域与选择框采用 input-shared，描边使用 field-line，最小高度（44px），内边距（12px）。展厅侧栏改用 input-showroom，并以 line 描边；保留原生选择、文件选择和复选框。文本域可纵向缩放，行高（1.75）。展厅复选框尺寸（18px），accent-color 跟随 accent。

输入控件复用同一焦点外框。错误文字采用 error 并在空内容时隐藏；当前没有统一的字段级错误描边，也没有自定义共享输入 disabled 外观。加载时实际控件状态由业务或展厅事件设置，文档不增加假定状态样式。

### Navigation

展厅镜头为可换行的按钮组，基础内边距（9px 14px），当前镜头用 aria-pressed=true 与 camera-choice-selected 显示。共享游戏相机控制器的选中态另用固定浅绿（#dce4cd）和深绿文字（#29462f），不是同一导航变体。链接使用 accent 与向下偏移（4px）的下划线。

### Chips / Status

共享状态标签为 status-chip，字号（11px），不换行；它是文字状态，不含可点击或筛选行为。舞台操作提示使用同级柔和圆角与纸色底，保持静态说明角色。

### Cards / Containers

入口卡采用 entry-card、最大宽度（510px），以楷体标题和局部阴影形成入口层级；700px 及以下内边距为（23px）且占满可用宽度。弹窗采用 dialog-panel；手机宽度为视口减（24px），内边距（21px），最大高度为 100dvh 减（24px）。共享任务与展厅工具分组各有具体样式，不应把全部容器改成入口卡。

### Scene and Motion

展厅支持拖动环绕、滚轮缩放与右键平移，WebGL canvas 禁用浏览器触摸默认手势。角色步态是明确的可选演示；prefers-reduced-motion 时不播放该步态。CSS 同时取消 transition 并恢复自动滚动；该媒体查询不停止 WebGL 绘制，也不保证导入 GLB 的所有动画暂停。载入、模型错误、WebGL 丢失通过状态文字反馈；颜色不是唯一信息来源。

## Do's and Don'ts

### Do:

- **Do** 以现有暖阳木质空间、暖纸界面和森林绿控件为默认视觉依据。
- **Do** 复用七个现有界面变量，并对照两套主题检查控件的实际状态。
- **Do** 保留系统字体、原生字段和可见的键盘焦点。
- **Do** 按共享 700px、展厅 800px 断点及粗指针条件复核相关界面。
- **Do** 从主题 JSON 与空间实现核对材质、光照和曝光，保留当前布局契约。

### Don'ts:

- **Don't** 把冷蓝对照主题描述为新地图或完整的全组件换肤。
- **Don't** 将文档中合成的色带当作已实现的 CSS 颜色 scale。
- **Don't** 声称所有辅助色、间距与圆角都已统一为运行时 token。
- **Don't** 在提取文档时引入新字体、阴影、悬停动画或空间重设计。
- **Don't** 把视觉主题、演示状态或通用角色外观当作真实业务与权限来源。
