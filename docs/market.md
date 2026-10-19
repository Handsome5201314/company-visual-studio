# 装修市场（Phase 2）

本文件记录独立展示厅中的公开装修市场 UI、静态目录与同源公司市场接入约定。

**边界：**

- 市场条目必须来自总部审核通过并处于 `LISTED` 状态的真实数据。未审核、下架、私有草稿不会进入公开目录。
- 默认静态目录是**空的官方目录**，不是把仓库里已有的两套源码主题包装成市场作品。
- 技术校验通过不等于总部审核、版权审核、公司老板批准或正式应用。
- 公开页面没有审批按钮。总部市场审核与公司私有装修审批互相独立。

## 1. 文件

| 文件 | 作用 |
| --- | --- |
| `apps/showroom/main.ts` | 页头“装修市场”入口、宿主 3D 预览适配器、展厅生命周期 |
| `apps/showroom/showroom.css` | 原展厅布局（本次只通过 market.css 增加市场外观） |
| `apps/showroom/market.ts` | 市场 dialog、目录/详情/搜索/模式切换/宿主适配器调用 |
| `apps/showroom/market.css` | 市场响应式外观，沿用纸色、森林绿、现有圆角与焦点 |
| `apps/showroom/market-index.json` | 默认静态公开目录：`schemaVersion:1`、`items:[]`、数据驱动的分类 |
| `src/market-index.js` | 纯数据校验、公开字段收窄、筛选/排序、受控同源 URL 构造 |
| `tests/market-index.test.mjs` | 真实数据格式与拒绝路径测试 |
| `docs/market.md` | 本文件 |

## 2. 两种数据模式

### 2.1 独立静态目录（默认）

打开市场时使用随展厅构建的 `market-index.json` 静态快照（不请求远程目录）：

```json
{
  "schemaVersion": 1,
  "items": [],
  "categories": [
    {"id": "warm-wood", "label": "温馨木质"}
  ]
}
```

- 空数组是明确的真实空状态：页面显示“当前没有已审核上架的公开作品”，并说明未审核、下架、私有方案不会出现。
- 静态模式不加载详情字节、图片、下载或试装；详情只展示清单元数据，并明确提示“与公司市场尚未同步”。
- 不虚构封面、截图、下载量、精选或热门。分类来自 `categories` 数据字段；搜索、风格和作者筛选都读取条目字段。
- 不把现有两套主题自动填入市场。

### 2.2 同源公司市场（用户主动选择）

只有点击“连接同源公司市场”后才请求同源 API：

```text
GET /api/market/themes
GET /api/market/themes/:id
GET /api/market/themes/:id/download
GET /api/market/themes/:id/files/<relativepath>
POST /api/decoration/drafts/from-market
```

- 没有 URL 输入框，不接受任意远程市场地址；不会把公司凭证发往第三方。
- 目录接口返回 `{schemaVersion:1,items:[entry]}`；分类可以缺省，缺省时使用静态目录的分类数据。
- 总部市场未启用时返回 503。UI 显示真实 HTTP 错误和服务器消息，并继续保留可用的静态目录；**不会把 503 静默变成空数组**。
- 200 且 `items:[]` 是真实的空市场；与错误区分。
- 请求失败、目录不合法或详情不合法时，不会用旧数据冒充新数据。

## 3. 条目与详情

公开目录条目：

```ts
{
  id: string,                 // 路由安全的短 ID
  themeId: string,            // 必须等于 manifest.id
  version: string,            // 三段数字 semver，必须等于 manifest.version
  manifest: ThemePackageManifest, // Phase 1 清单
  packageHash: 'sha256:<64hex>',
  totalBytes: number,         // 1..30 MiB，且等于 manifest.files 字节总和
  state: 'LISTED',
  revision: number,           // 正整数
  createdAt: string,          // 带时区的 ISO 8601
  updatedAt: string
}
```

详情返回 `{...entry, theme, scene, assetBase:'/api/market/themes/:id/files/'}`。

`src/market-index.js` 只输出白名单公开字段：标题、作者、简介、风格、许可、契约、预览、图片路径、来源仓库/commit、hash、大小、修订与日期。审核人、私有备注、草稿所有者、权限等额外字段不会进入返回值。它不会推导“官方认证”徽章；只有后端明确给出的 `state: LISTED`。

UI 详情展示：

- 作者、版本、修订、许可证、布局契约、资源大小、包哈希、来源仓库、固定 commit、上架/更新时间、包内文件数；
- `theme.ui` 的七个界面颜色作为真实配色样本（来自详情 theme.json，不使用虚构色板）；
- `manifest.files` 中的图片（包括 `previewPath`），加载失败显示文字，不用假图；
- 下载按钮仅指向固定同源 `/download`；
- 基础主题预览按钮；
- 试装说明与按钮。

截图/预览图片使用 `textContent` 和受控 URL 构造，不把标题、作者、描述或路径插入 `innerHTML`。

## 4. 3D 预览

宿主 `main.ts` 注入安全预览回调；市场模块本身不执行任何主题 JS：

```ts
preview({entry, detail, host, onProgress}) -> Promise<{dispose(): void}>
```

主展厅的实现：

```ts
new OfficeVisuals(
  candidateScene,
  import.meta.env.BASE_URL,
  [],
  detail.theme,
  detail.assetBase
)
```

- 只有 `detail.theme.assets` 中列出的资源才从 `detail.assetBase` 取；默认家具与 Draco 解码器始终从可信 `trustedAssetBase` 取。
- 先异步构建候选 `OfficeVisuals` 并等待加载成功，再替换旧预览；失败抛出错误，旧预览保留，页面显示错误。
- 预览只渲染基础主题家具与灯光。**不应用 `scene.objects/lights`**；详情明确写“基础主题预览；可编辑物件待集成”。
- 没有审批、安装或正式应用按钮。

## 5. 试装

独立展厅没有公司身份、岗位或装修权限，因此静态模式只显示可读说明，不显示会成功的假按钮。

同源 API 模式显示“在公司试装”，点击后：

```http
POST /api/decoration/drafts/from-market
Content-Type: application/json

{"submissionId":"<entry.id>","idempotencyKey":"<uuid>"}
```

- 只提交公司私有草稿请求；不会直接修改正式公司场景。
- 当前接口尚未完成时，显示真实 HTTP 状态和服务器消息（如 404/501/503），不伪造成功。
- 成功响应也只提示“服务器已接受试装请求；请在草稿/审批流程查看”，展厅不应用场景。
- 没有审批按钮；审批只能在公司私有流程中进行。

## 6. 交互与可访问性

- 市场是原生模态 `dialog`；`Escape` 在详情中先返回目录，再关闭市场。关闭后焦点回到页头入口。
- 目录卡片、筛选、详情按钮均为原生按钮/链接；`focus-visible` 沿用共享 3px 棕色外框。
- 移动端单列、工具栏换行、详情两栏在 900px 以下变为单列；390px 不横向溢出。
- 加载、错误、待处理、空状态均有文本反馈；加载时设置 `aria-busy`；错误使用 `role="alert"`。
- `prefers-reduced-motion` 下停止 spinner 动画、关闭过渡。
- 精选/热门不展示；页面明确说明需要真实运营数据。

## 7. 安全约束

- 市场只读数据；不执行主题包内 JS、HTML、SVG 或 WASM。
- 目录条目必须 `state===LISTED`；非法、未上架、下架、重复 ID、错误 hash/预算/路径/来源会使目录校验失败，不静默过滤。
- `manifest` 必须通过 Phase 1 `validatePackageManifest`。
- 详情 `assetBase` 必须是固定 `/api/market/themes/<id>/files/`；图片、下载、详情 URL 都由固定同源路径构造。
- 搜索/风格/作者只读取字段；恶意标题作为纯文本保存，UI 使用 `textContent` 渲染。
- 来源链接只允许 Phase 1 校验过的 GitHub 仓库地址；不发送公司凭证。
- 导航、碰撞、门禁、员工路径、模型包围盒、版权和公网上架仍需宿主/总部审核；本 UI 不宣称这些已通过。

## 8. 测试

```sh
npm test
node_modules/.bin/tsc --noEmit
npm run validate
```

`tests/market-index.test.mjs` 覆盖：

- 默认空目录与六个数据分类；
- `LISTED` 公开字段收窄，私有审核字段不泄露；
- 未上架、下架、重复 ID、非法 ID/themeId/hash/totalBytes/manifest 拒绝；
- 恶意标题保持纯文本，搜索/风格/作者筛选正确；
- 详情版本绑定、非法/跨域 `assetBase` 拒绝；
- 详情 theme/scene 与目录条目不一致拒绝；
- 图片/下载/详情 URL 固定同源且拒绝路径穿越；
- 现有两套源码主题不会自动变成市场条目。
