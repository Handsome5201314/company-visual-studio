# 主题包协议 v1（Phase 1）

本文件定义童医魔盒视觉工作室的可移植主题包协议，以及配套的浏览器校验 API 和 Node 校验/打包工具。

**边界先说清楚：**

- 本工具只验证数据结构、文件完整性、文件头和协议一致性，不执行任何包内内容。
- **技术校验通过不等于总部市场上架、版权审核通过、公司老板批准或正式应用。**
- 导航、碰撞、门禁、楼梯、工位、员工目的地与权限必须由宿主使用权威 `world.js` / 服务端数据再次校验；本工具不证明场景可安全行走。
- 本工具不能替代素材版权与许可证的人工审核；清单中的 SPDX 标识只是机器可读声明。
- 私有公司装修不需要总部市场审核；市场审核也不能绕过公司老板审批。

## 1. 文件与 API

| 文件 | 作用 |
| --- | --- |
| `src/decoration-package.js` | 浏览器/宿主共用纯数据校验；无 Node 内置模块依赖 |
| `tools/theme-package.mjs` | 在真实目录上验证文件哈希/字节/文件头，并提供 CLI |
| `tests/decoration-package.test.mjs` | 真实临时目录、真实 SHA256 与拒绝路径测试 |
| `docs/theme-package.md` | 本协议 |

浏览器 API：

```js
import {PACKAGE_VERSION,validateScene,validatePackageManifest}
  from './src/decoration-package.js';

PACKAGE_VERSION === 1;
const scene = validateScene(input);          // 返回深拷贝
const manifest = validatePackageManifest(input); // 返回深拷贝
```

校验失败抛出 `Error`，消息指出具体字段或限制。输入必须是可 `structuredClone` 的 JSON 纯数据。`validateScene` 只校验视觉数据；`validatePackageManifest` 只校验清单纯数据，不接触文件系统。

## 2. 场景 `scene.json`

```json
{
  "schemaVersion": 1,
  "compatibleContract": "hq-fixed-layout-v1",
  "objects": [
    {
      "id": "desk-a",
      "model": "desk",
      "position": [0, 0, 0],
      "rotationY": 0,
      "scale": [1, 1, 1]
    }
  ],
  "lights": [
    {
      "id": "lamp-a",
      "position": [0, 2, 0],
      "color": "#ffcc88",
      "intensity": 1.5,
      "distance": 4
    }
  ]
}
```

### 2.1 精确字段

顶层只允许 `schemaVersion`、`compatibleContract`、`objects`、`lights`。物件只允许 `id`、`model`、`position`、`rotationY`、`scale`。装饰灯只允许 `id`、`position`、`color`、`intensity`、`distance`。缺少字段、未知字段、代码/URL/导航/碰撞/员工/权限字段都会被拒绝。

### 2.2 约束

| 项目 | 约束 |
| --- | --- |
| `schemaVersion` | 必须为 `1` |
| `compatibleContract` | 必须为 `hq-fixed-layout-v1` |
| `objects` | 0–60 个 |
| `lights` | 0–4 盏，仅装饰灯 |
| `objects[].model` | 必须是 `src/theme.js` 的 13 个 `MODEL_IDS` 之一 |
| `id` | 小写字母开头，只含小写字母、数字、短横线；物件与灯全局唯一 |
| `position` | 三个有限数字；X/Z 在 `layout-contract.json` 的 `-9.55..9.55` / `-7.5..7.5`；Y 在视觉包围盒 `0..7.5` |
| `rotationY` | 有限弧度值 |
| `scale` | 三个数，每轴 `0.05..2` |
| `lights[].color` | `#rrggbb` 六位十六进制 |
| `lights[].intensity` | `0..3` |
| `lights[].distance` | `0.1..12` |

Y 的 `0..7.5` 是视觉包围盒：一楼地面 0、夹层 3.4、顶棚约 7；**它不是碰撞体，也不是可达性证明**。

`validateScene` 不检查模型包围盒比例、与固定建筑/家具的穿插、楼梯通行、门禁或员工路径。这些由宿主基于权威场景与 `src/model-budgets.json` 再校验。

## 3. 清单 `theme-package.json`

```json
{
  "schemaVersion": 1,
  "id": "warm-wood",
  "name": "暖阳木质总部",
  "author": "作者名",
  "version": "1.0.0",
  "description": "主题简介。",
  "styles": ["warm-wood", "cozy"],
  "compatibleContract": "hq-fixed-layout-v1",
  "license": "MIT",
  "source": {
    "repository": "https://github.com/owner/repo",
    "commit": "0123456789abcdef0123456789abcdef01234567"
  },
  "themePath": "theme.json",
  "scenePath": "scene.json",
  "previewPath": "preview.png",
  "files": [
    {
      "path": "theme.json",
      "bytes": 1234,
      "sha256": "64位小写十六进制SHA256",
      "license": "MIT",
      "source": "https://github.com/owner/repo"
    }
  ]
}
```

### 3.1 顶层字段

| 字段 | 约束 |
| --- | --- |
| `schemaVersion` | 必须为 `1` |
| `id` | 小写字母开头，`[a-z0-9-]`，最长 41 字符；必须与 `theme.json` 的 `id` 一致 |
| `name` / `author` | 1–200 字符非空白文本，不含控制字符 |
| `version` | 三段数字 semver，如 `1.0.0`；必须与 `theme.json` 一致 |
| `description` | 1–2000 字符，可含换行 |
| `styles` | 1–12 个非空标签，每个 1–60 字符；大小写不敏感去重 |
| `compatibleContract` | 必须为 `hq-fixed-layout-v1`；必须与 theme/scene 一致 |
| `license` | 仅 `MIT`、`Apache-2.0`、`CC0-1.0`、`CC-BY-4.0` |
| `source.repository` | 仅 `https://github.com/<owner>/<repo>`；拒绝 query、凭证、非 GitHub、尾斜杠 |
| `source.commit` | 40 位小写十六进制 Git commit |
| `themePath` | 固定 `theme.json` |
| `scenePath` | 固定 `scene.json` |
| `previewPath` | 安全相对路径，扩展名仅 `png`/`webp`/`jpg` |
| `files` | 1–100 个文件条目 |

### 3.2 文件条目

每个条目只允许 `path`、`bytes`、`sha256`、`license`、`source`：

- `path`：严格的包内相对 ASCII 路径。
- `bytes`：`1..10 MiB` 的整数。
- `sha256`：64 位小写十六进制。
- `license`：与顶层相同的四个 SPDX 之一。
- `source`：1–500 字符非空白文本，用于逐文件来源说明。

全部文件声明总大小不得超过 **30 MiB**。

### 3.3 路径规则

拒绝：`..`、反斜杠、冒号、百分号编码、绝对路径、URL、空段、`.` 段、以点或空格结尾的路径段、Windows 保留名（`CON`、`NUL`、`COM1` 等）、隐藏段、重复路径、大小写碰撞。扩展名必须小写，仅允许：

```text
.json  .glb  .png  .webp  .jpg  .md  .txt
```

不允许 `.js`、`.html`、`.svg`、`.wasm` 或其他可执行/可嵌入内容。**第三方包不得打包宿主内置的 Draco JS/WASM**；宿主可自行提供解码器，但包内只允许静态资源。

### 3.4 必含文件

`files` 必须包含：

- `theme.json`
- `scene.json`
- `previewPath` 指向的文件
- 根目录 `README.md`
- `LICENSE.txt` 或 `LICENSE.md`

清单自身 `theme-package.json` 不得登记进 `files`。

`theme.json` 还必须通过现有 `src/theme.js` 的 `validateTheme`；`scene.json` 还必须通过 `validateScene`。

## 4. `verifyPackage(directory)`

```js
import {verifyPackage} from './tools/theme-package.mjs';

const {manifest,theme,scene,digest,totalBytes} = await verifyPackage(dir);
```

成功时返回且只返回这五个字段：

- `manifest`：通过校验的清单深拷贝。
- `theme`：现有 `validateTheme` 校验后的主题。
- `scene`：`validateScene` 校验后的场景。
- `digest`：`sha256:<64位十六进制>`，定义见下。
- `totalBytes`：实际文件字节总和。

验证顺序与行为：

1. 目录必须是真实目录，不能是符号链接。
2. 读取并校验 `theme-package.json` 的纯数据部分。
3. 递归扫描目录：拒绝任何符号链接；拒绝清单未登记的文件；拒绝清单登记但实际缺失的文件；拒绝非普通文件。
4. 逐文件检查真实字节数与 SHA256；拒绝超过单文件/总预算。
5. 检查安全文件头：
   - JSON：UTF-8 严格解码并解析；
   - GLB：复用 `src/glb.js` 的 `inspectGLB`，拒绝外部 buffer/image URI、截断、超限；
   - PNG：签名、IHDR、IEND；
   - WEBP：RIFF/WEBP 与声明长度；
   - JPG：SOI/EOI；
   - MD/TXT：严格 UTF-8，拒绝 NUL。
6. 解析 `theme.json` / `scene.json` 并执行 `validateTheme` / `validateScene`。
7. 校验包 `id`、`version`、`compatibleContract` 分别与 `theme.json` 一致；场景契约与清单一致。
8. 计算 digest。

任一步失败都抛出带文件/字段信息的 `Error`，不返回部分结果。该 API **不写入任何文件，也不访问网络**。

### 4.1 digest 定义

digest 是以下 JSON 的 SHA256，前缀 `sha256:`：

```json
{
  "format": "company-theme-package",
  "packageVersion": 1,
  "manifest": { "...": "清单，其中 files 按 path 排序" },
  "files": [
    {"path": "实际文件相对路径", "bytes": 1234, "sha256": "实际文件哈希"}
  ]
}
```

规范化规则：对象键递归排序；数组顺序保留；清单的 `files` 与实际文件列表都按 `path` 升序。因此：

- 清单键顺序、`files` 数组顺序不影响 digest；
- 清单元数据或任一实际文件字节变化会改变 digest；
- digest 同时绑定清单声明和实际文件哈希。

## 5. CLI

```sh
node tools/theme-package.mjs verify <dir>
node tools/theme-package.mjs pack <dir> <output.company-theme.json.gz>
```

`verify` 成功时向 stdout 输出摘要 JSON（`id`、`version`、`compatibleContract`、`digest`、`totalBytes`、`fileCount`），退出码 0；失败时向 stderr 输出 `theme-package: ...`，退出码 1。

`pack` 先执行与 `verify` 完全相同的验证，然后输出 gzip 封装的 UTF-8 JSON：

```json
{
  "manifest": { "...": "..." },
  "files": [
    {"path": "theme.json", "base64": "..."}
  ]
}
```

- 文件按 `path` 排序；不执行内容。
- 输出扩展名必须是 `.company-theme.json.gz`。
- 输出位置必须由 CLI 显式给出；不会自动写公共索引、市场目录或数据库。
- 拒绝覆盖已存在的输出文件；拒绝把输出写进输入主题包目录。
- gzip 只是可移植传输封装；解包后必须重新执行 `verifyPackage`，不能因为来自 gzip 就信任内容。

## 6. 宿主必须继续做的事

本协议通过只代表“包结构、文件完整性、静态资源头与现有主题/场景规则通过”。宿主仍需：

- 用权威 `world.js` 校验固定建筑、碰撞、楼梯、门禁、工位、员工目的地与导航深度。
- 确认 `theme.models` / `theme.assets` 引用的模型在包内或宿主受信任的内置资源中存在。
- 用 `model-budgets.json` 或服务端权威数据校验模型包围盒与替换比例。
- 在隔离环境中做真实浏览器渲染/性能测试。
- 做版权、许可证、素材来源与视觉质量的人工审核。
- 分开执行总部市场审核与公司老板审批；技术校验不能替代任何一方。
- 对私有草稿做公司身份、岗位、权限、审计与版本检查。
- 保证第三方包不能修改服务端碰撞权威数据，也不能携带任意可执行插件代码。

## 7. 测试覆盖

`tests/decoration-package.test.mjs` 使用真实临时目录与真实 SHA256，覆盖：

- 场景字段精确性、未知字段/脚本/URL/导航/碰撞/员工/权限拒绝；
- 物件/灯数量、ID 重复、模型白名单、坐标、缩放、灯光范围；
- 清单路径逃逸、URL、绝对路径、反斜杠、百分号、重复与大小写碰撞、Windows 保留名；
- 可执行扩展名拒绝；
- 单文件/总大小/文件数量预算；
- 篡改字节、错误 SHA256、错误字节数、缺失文件、额外文件；
- 符号链接文件与目录（平台允许时）；
- GLB 外部 URI、截断 GLB、伪造 PNG/WEBP/JPG/JSON/UTF-8；
- 包/主题/场景 ID、版本、契约不一致；
- digest 对键顺序/文件顺序稳定、对实际字节变化敏感；
- CLI verify/pack、gzip 可移植封装、拒绝覆盖与错误扩展名；
- 原有两套主题与现有资源目录继续通过。

运行：

```sh
npm test
npm run validate
```

## 8. 现有主题导出与 PR 检查

`node tools/build-shipped-package.mjs default <新目录>`（或 `cyber`）将现有主题、真实家具、封面与许可证导出为独立包，拒绝覆盖。来源提交读取当前 Git HEAD；输出仅表示技术校验通过，不授予认证或上架资格。

`node tools/validate-theme-packages.mjs` 扫描 `themes/` 内贡献的 `theme-package.json`，复用同一校验器。PR CI 已加入该步骤；没有贡献包时明确报告零个，不生成假市场项目。清单读取前限制 1 MiB，遍历目录最多 1000 项，每个文件在读取前核对字节预算。

原有两个主题仍为内置演示，不因可导出就自动成为市场认证版本。可执行宿主代码与第三方声明式主题包始终分开。
