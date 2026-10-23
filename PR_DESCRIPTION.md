# feat: 播出日期时段选择 · QQ 互联 OAuth · 批量标记播放 · 浏览器指纹登录

## 概述

本 PR 包含 4 项功能改进与 3 处缺陷修复，均在现有架构上增量实现，未改动上游既有安全加固逻辑（CORS HMAC 签名校验、IP 信任链、JWT 弱密钥 fail-fast 等）。其中「播出日期 + 时段两级选择」已从页面内嵌表单重构为**选歌后弹窗**交互。

**变更规模**：62 个文件，+14871 / −70 行（本次时段弹窗重构另改 6 文件，+219 / −166）
**数据库迁移**：3 个（`20261023040954` / `20261023042547` / `20261023050353`）
**提交**：
- `471c92f` feat: 播出日期时段选择、QQ OAuth、批量标记播放、浏览器指纹登录
- `c36c8b7` fix(play-slot): dayjs 插件导入补 .js 后缀
- `64eef46` refactor(request): 时段选择重构为选歌后弹窗 + 登录页图标/间距修复 + 服务端未指定日期自动分配

---

## 一、播出日期 + 时段两级选择（选歌后弹窗）

点歌选曲后弹出**时段选择小窗**：播出**日期可选、时段必选**；**日期优先级高于时段**——指定日期时仅能选该星期开放的时段，未指定日期则由服务端自动分配到最近一个开放该时段的日期，适配「周一~周四 4 时段 / 周五仅早中午 / 周日仅傍晚晚上」这类不规则排期。

### 数据层
| 变更 | 说明 |
|---|---|
| `PlayTime.weekdays` | `jsonb`，`0=周日 … 6=周六`；空数组表示每天均可选（兼容历史数据） |
| `Song.preferredPlayDate` | `date`，`YYYY-MM-DD` |
| `SystemSettings.playSlotRequired` | `boolean`，时段必选总开关 |

### 服务端
- 新增 `server/utils/play-slot.ts`：`normalizeWeekdays` / `slotAppliesToWeekday` / `getWeekdayOfDateString` / `validatePlayDateString`；新增 `findNearestDateForSlot(weekdays, startDate, horizonDays=60)` 用于「未指定日期时自动分配到最近一个开放该时段的日期」（默认向前 60 天窗口内查找）
- `songRequestService`：zod schema 增加 `preferredPlayDate`；**时段必选**；指定日期时校验该日期星期必须开放所选时段（否则 400 明确报错 `playSlotNotOpenOnDate`）；未指定日期时调用 `findNearestDateForSlot` 自动分配（窗口内无可用日期同样 400）；日期不得早于北京时间今天
- `play-times` API 返回 `required` + `weekdays`；admin CRUD 支持星期配置
- `songs` GET 用 `to_char` 返回 `preferredPlayDate`；开放 API 白名单 + 机器人端点透传日期

### 前端
- **新增 `app/components/Songs/PlaySlotPickerModal.vue`**：选歌后弹出的时段选择弹窗（`z-[130]`，高于手动投稿弹窗 `z-[100]`）。选日期 → 时段下拉仅列该星期开放的；未选日期 → 列全部；切换日期后若已选时段不再开放则自动清空；确认时回传 `{ date, timeId }`；复用项目统一 CSS 变量（`bg-bg-secondary` / `text-text-primary` / `bg-primary-hover`），样式与全站统一
- `RequestForm.vue`：删除页内嵌时段表单，改为**提交前拦截弹窗**；三条提交路径（自动投稿 / 手动投稿 / 重播）在「时段必选且尚未选择时段」时先弹出 `PlaySlotPickerModal`，确认后回填 `preferredPlayDate` / `preferredPlayTimeId` 再继续提交；取消则清空 `pendingPlaySlotSubmit` 与时段状态
- `PlayTimeManager.vue`：星期勾选按钮组 + 「点歌时段必选」总开关；卡片按星期高亮
- `SongManagement.vue`：展示「M月D日 周X · 时段」，并提供播出日期筛选

### i18n
新增 / 改写时段弹窗相关键：`playSlotModalTitle` / `playSlotModalSubtitle` / `playSlotDateOptionalHint` / `playSlotDateSelectedHint` / `playSlotTimeFreeHint` / `playSlotTimeRestrictedHint` / `playSlotAutoAssignHint` / `playSlotNotOpenOnDate`（zh-CN / en-US 同步）

---

## 二、QQ 互联 OAuth 直连登录

在既有 OAuth 框架（github / casdoor / google / oauth2 / aggregate 五策略）上新增第 6 个 provider `qq`，直连 `graph.qq.com`，与聚合登录中的 QQ 相互独立。

### 数据层
`SystemSettings` 新增 `qqOAuthEnabled` / `qqOAuthAppId` / `qqOAuthAppKey`。

### 服务端
- `oauth-strategies.ts` 新增 `qqStrategy` 及三个纯函数导出：`buildQqAuthorizeUrl` / `parseQqTokenResponse` / `parseQqOpenIdResponse`；token 与 openid 以 base64url 打包传递（沿用 aggregate 模式）
- **关联依据取 `id`（openid）**，昵称仅用于展示
- 协议坑位处理：`token`/`me` 接口可能返回 `text/plain`；`me` 响应外层裹 `callback(...)`；令牌错误同样以 callback JSON 返回；网络错误与业务错误分类抛出

### 前端
- `useSiteConfig` 增加 `qqOAuthEnabled` + `oauthProviders`
- `OAuthButtons` / `OAuthBindingCard` 增加 `oauth-qq` 图标与悬停色；`OAuthQuickLogin` 支持直连 QQ（QQ 内嵌浏览器优先走 `/api/auth/qq`）
- `OAuthConfigManager` 增加 QQ 配置段（App ID / App Key / 文档链接）
- `app/utils/oauth` 中 `displayName`：`qq` → `QQ`

### 设置同步
`defaults` 公开字段、`POST` 校验（启用需同时提供 App ID + Key，并入 redirect / stateSecret 前置校验）、`secretMask` 覆盖 `qqOAuthAppKey`、admin GET 建行分支、备份恢复白名单 ×2、`env-oauth` 导入导出（`QQ_OAUTH_APP_ID` / `QQ_OAUTH_APP_KEY`）。

---

## 三、歌曲管理：批量标记已播放 / 未播放

歌曲管理页多选后可批量标记播放状态，**新增独立按钮组**（不复用「下载 / 批量驳回 / 删除」那一组；视觉样式完全统一：同款 pill 容器 + Transition + `text-[11px] font-black`）。

### 服务端
**零改动** —— `mark-played.post.ts` 早已支持 `songIds` 批量（≤100）+ `unmark` 参数并返回 `count`。

### 前端
- 新增 `batchMarkPlayed` / `batchMarkUnplayed`：POST `songIds` → `refreshSongs()` → 按**仍存在的歌曲恢复勾选**（便于连续操作）；`count = 0` 时走 warning noop 提示（服务端按已播状态过滤，不会误发通知）
- 桌面端：新增 Transition + pill 组置于原批量组**左侧**（非破坏性操作在前）
- 移动端悬浮栏改为 `flex-col`，第二行为独立分组（`border-t` 分隔 + `flex-1` 双按钮）
- 图标复用既有 `Check` / `RotateCcw`；语义色沿用单行规则：已播放 = `text-success`，未播放 = `text-text-tertiary`

---

## 四、浏览器指纹登录（HTTPS）

安全上下文中自动采集浏览器指纹并绑定账号；后台可见绑定关系；用户可在账号页自助启用（需密码认证）；指纹一致时一键登录；管理员可配置总开关。

### 数据层
新表 `browser_fingerprints`：

| 字段 | 说明 |
|---|---|
| `userId` | FK → `users.id`，`ON DELETE CASCADE` |
| `fingerprintHash` | 加盐哈希，**全局唯一索引**（一个指纹只能绑定一个账号） |
| `label` / `browser` / `operatingSystem` / `device` | 备注与设备信息 |
| `createdAt` / `lastUsedAt` / `lastLoginIp` | 绑定时间、最近使用时间与 IP |

外加 `SystemSettings.fingerprintLoginEnabled` 总开关。

### 服务端
- **`server/utils/fingerprint.ts`**：`MAX_FINGERPRINT_BINDINGS = 10`；`isValidFingerprint`（`/^[a-f0-9]{64}$/`）；`hashFingerprint = sha256(指纹 + pepper)`，pepper 取 `FINGERPRINT_PEPPER || JWT_SECRET`（两者皆无则抛错）——**不明文存原始指纹**
- **5 个用户端点**
  - `enable.post`：登录态 + 功能开关 + bcrypt 密码校验 + 全局唯一冲突（409）+ 同账号重复启用幂等更新 + 单账号上限 10
  - `login.post`：复用 `createAuthSession(loginMethod='fingerprint')` + `auth-token` cookie；IP 封禁检查；失败 `recordLoginFailure`；**不叠加 2FA**（沿用 WebAuthn 先例）
  - `list.get`：`?fingerprint=` 参数合法时由服务端标记 `current: true`
  - `check.get`：匿名预检 + 限流（120 次 / 10 分钟）+ 返回掩码用户名
  - `[id].delete`：解绑自己的绑定
- **管理端点**：`admin/users/[id]/fingerprints/[fpId].delete`（ADMIN / SUPER_ADMIN 撤销）；`users` 的 `[id].get` 与 `index.get` 的 `with` 增加 `browserFingerprints`
- **设置 6 处同步**（遵循 `AGENTS.md` §4.3 清单）：schema 默认值 / `admin/system-settings/index.ts` 建行分支 / `index.post.ts` 布尔校验 / `backup/restore.post.ts` 与 `restore-chunk.post.ts` 白名单 / `server/utils/system-settings-defaults.ts` 的 `DEFAULTS` 与 `PUBLIC_SETTINGS_FIELDS`
- **新增 6 个错误码**：`AUTH_FINGERPRINT_{INVALID, DISABLED, NOT_BOUND, BOUND_TO_OTHER, LIMIT_EXCEEDED, NOT_FOUND}`

### 前端
- **`app/utils/fingerprint.js`（零依赖）**：canvas 2D 绘图 / WebGL debug renderer info / OfflineAudioContext 浮点累积 / 字体宽度探测 / 屏幕与硬件 / 时区 / Chromium 高熵 UA-Data；经 cyrb53 四轮种子哈希（`0x9e3779b1, 0x85ebca6b, 0xc2b2ae3d, 0x27d4eb2f`）得 64 位十六进制；排除主题相关信号（避免深浅色切换改变指纹）；WebGL 上下文用完即 `loseContext`；SSR 环境返回空指纹
- **`LoginForm.vue`**：与 WebAuthn 合并为单分隔线下的双按钮；`handleFingerprintLogin` / `checkFingerprintBinding`（挂载时非绑定模式自动预检，提示掩码用户名）
- **`Account/FingerprintManager.vue`**：账号页独立 section；启用对话框（Teleport + 备注 + 密码）；解绑二次确认；`collectFingerprint()` → `list?fingerprint=` 标记当前浏览器
- **`Admin/FingerprintBindingsModal.vue`** + `UserManager.vue`：用户详情卡「浏览器指纹登录」显示绑定数量，点击展开明细（绑定时间 / 最近使用 / IP / 设备）并可撤销
- **`SiteConfigManager.vue`**：安全区新增「浏览器指纹登录」总开关

### i18n
`zh-CN` / `en-US` 全量同步：`loginForm` 4 键、`account.fingerprint` 21 键、`userManager.detail` 15 键、`siteConfig` 2 键、`serverErrors` 6 码。

---

## 五、缺陷修复

### 1. 指纹公开端点被鉴权中间件拦截（401）
新增的 `check` / `login` 端点未加入 `server/utils/auth-route-policy.ts` 的 `PUBLIC_API_EXACT_ROUTES` 白名单，导致匿名访问被鉴权中间件拦成 401。参照既有 `/api/auth/login`、`/api/auth/webauthn/login` 的写法补入白名单（`enable` / `list` / `delete` 仍需登录态）。

### 2. Nitro 打包后 ESM 解析失败（500）
新增的 `server/utils/play-slot.ts` 写 `import utc from 'dayjs/plugin/utc'`，而 Nitro 产物为**原生 ESM**，`dayjs` 插件等**子路径导入必须显式带 `.js` 后缀**（主包如 `'dayjs'` 不需要），导致 `/api/play-times` 与 `/api/songs/request` 全部 500：

```
Cannot find module '/app/.output/server/node_modules/dayjs/plugin/utc'
imported from /app/.output/server/chunks/_/play-slot.mjs
Did you mean to import "dayjs/plugin/utc.js"?
```

改为 `dayjs/plugin/utc.js` + `dayjs/plugin/timezone.js`，与既有 `server/api/admin/stats.get.ts` 写法保持一致。修复后重建，500 归零。

### 3. 登录页按钮图标重复与间距缺失
- **图标重复**：指纹登录按钮原用 `FingerprintPattern`（虚线圆点），与 WebAuthn 按钮的 `Fingerprint`（指纹纹）视觉差异过小，截图中几乎一致。改用 `ScanFace`（人脸扫描轮廓），语义上贴合「识别本设备」，与 `Fingerprint` 明确区分。
- **间距缺失**：`.webauthn-section` 仅有 `width: 100%`，无 `gap` 与子元素间距，两个按钮直接贴合。改为 flex 纵向布局 + `gap: 10px`；同时收敛 `.fingerprint-hint` 的 `margin`（避免与 `gap` 叠加）、`.divider` 在该容器内的 `margin` 调整为 `20px 0 10px`。

---

## 验证情况

### 静态验证
- 7 个 SFC 通过 `vue/compiler-sfc` 的 script + template 编译，模板标签配平
- 20 个 TS / JS 文件通过 esbuild 解析
- i18n 双语**深结构完全对齐**（含组件内 `locale.*` 引用与语言包键的交叉校验）
- 6 个新错误码在 `SERVER_ERROR_CODES` 与双语 `serverErrors` 三处同步
- 迁移 SQL + `meta/_journal.json`（idx 57/58）+ snapshot 三件套一致

### 行为验证
- 服务端：指纹格式校验 9 组用例、哈希稳定性、pepper 缺失抛错、`JWT_SECRET` 兜底
- 客户端：打桩浏览器全局验证 64 位十六进制格式、同环境指纹稳定、UA 变化时指纹变化、SSR 返回空
- `play-slot` 规则 17/17 单测、QQ 协议解析 10/10 单测（均以真实转译代码执行）

### 本地构建验证
- 本地 macOS 全量 `pnpm run build` 通过：Nuxt client（3995 模块）+ server（327 模块）打包成功，Nitro 产物 `.output/server/index.mjs` 生成，总体积 44.9 MB
- 本次新增 / 改动的 SFC（`PlaySlotPickerModal.vue`、`RequestForm.vue`、`LoginForm.vue`）与后端 TS（`play-slot.ts`、`songRequestService.ts`）均通过编译，无类型 / 模板错误
- 验证环境：`node v22.22.2` + pnpm；构建不含 `db:migrate`（本地无 Postgres，迁移已在测试实例应用）

### 服务器端到端验证
在测试实例上以真实 HTTP 请求走通完整链路：

| 用例 | 期望 | 结果 |
|---|---|---|
| 管理员登录 → 启用绑定（密码校验） | 200 | ✅ |
| 绑定列表 `current` 标记 | 正确 | ✅ |
| 匿名预检 | `available` + 掩码用户名 | ✅ |
| 指纹一键登录（免密）+ 回写 `lastUsedAt` / `lastLoginIp` | 200 | ✅ |
| 管理端查看 / 撤销绑定 | 正常 | ✅ |
| 错误密码 | `AUTH_CURRENT_PASSWORD_INCORRECT` | ✅ |
| 未绑定指纹 | `AUTH_FINGERPRINT_NOT_BOUND` | ✅ |
| 格式非法指纹 | `AUTH_FINGERPRINT_INVALID` | ✅ |
| 指纹已绑定他人账号 | 409 `AUTH_FINGERPRINT_BOUND_TO_OTHER` | ✅ |
| 未登录访问受保护接口 | 401 | ✅ |

---

## 部署须知

### 迁移
本 PR 附带 3 个迁移文件，`deploy.js` 会在容器启动时自动应用。**本地开发环境需手动执行**：

```bash
pnpm install && pnpm db:migrate
```

### 环境变量（可选）
`FINGERPRINT_PEPPER` 用于指纹哈希加盐；未配置时回退到 `JWT_SECRET`。**多实例部署时建议显式配置且保持各实例一致**，否则同一浏览器在不同实例上算出的哈希不同，指纹登录将失效。

```bash
# .env
FINGERPRINT_PEPPER=<openssl rand -base64 32>
```

### 功能开关
后台 **站点配置 → 安全与隐私 → 浏览器指纹登录**（默认关闭，管理员可配置）。

### 浏览器要求
指纹采集依赖**安全上下文**（HTTPS 或 `localhost`），采集逻辑使用 canvas / WebGL / 音频 API，不依赖 `crypto.subtle`。
