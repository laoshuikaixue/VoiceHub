# VoiceHub Agent 行为规范

## 1. 项目概览

VoiceHub — Nuxt 4 校园广播站点歌管理系统。

- **前端**: Nuxt 4 (Vue 3), Tailwind CSS
- **图标**: 自定义 `Icon.vue` 组件（内联 SVG），辅以 `@lucide/vue`
- **后端**: Nuxt Server API (Nitro)
- **数据库**: PostgreSQL, Drizzle ORM
- **语言**: 后端 TypeScript, Vue SFC 用纯 JavaScript（无 `lang="ts"`）

## 2. 规范

### 2.1. 语言
注释、文档、Git 信息均用简体中文。注释中禁止写思考过程等无用内容，只需关键部分。
- 界面文案（locale 描述、提示语等）与代码注释一律用简洁陈述句，禁止过长、口语化、带语气词/反问/比喻的啰嗦表述（如“所以不会变成死板的按票数排序”“这样高热度歌曲更容易排在前面，但相邻名次之间会经常互换”）；只保留必要信息，能一句话说清就不写第二句
- CSS 注释只保留关键信息（变量用途、值来源、防误删警告），禁止写设计意图、过程或对比说明（如“取值与现状一致”“视觉零变化”“浅色模式下需清晰可见”“对齐某分支观感”等）

### 2.2. Vue 组件
- 统一 `<script setup>`（纯 JS，不加 `lang="ts"`，禁止类型注解）
- API 调用用 `useFetch` 或 `$fetch`，需错误处理
- 模态框用 `<Teleport to="body">`
- 图标用 `<Icon name="..." />`，name 需在 `Icon.vue` 中有定义；图标语义必须符合实际功能（如音源控制用 `ListMusic`），禁止使用语义不符的图标
- 项目未开启组件自动导入，模板中使用的自定义组件（含 `Icon`）必须在 `<script setup>` 中显式导入；漏导入不会报错，会被渲染成无内容的原生未知标签（如 `<icon>`），表现为占位但不显示
- 下拉选择统一复用 `~/components/UI/Common/CustomSelect.vue`；多选使用其 `multiple` 模式，禁止为普通业务配置新增原生 `<select>`
- 状态管理用 Composables，不用 Pinia
- 颜色类名以 `nuxt.config.ts` 的 `theme.colors` 键为准：键已是 `bg-primary-40`、`border-secondary`、`text-tertiary` 这类带语义前缀的完整名，使用时再加 UnoCSS 前缀（如 `bg-bg-primary-40`、`border-border-secondary`）。新增颜色前先在该文件确认键存在，拼错不会报错，只会静默不生成 CSS
- 承载文字的交互控件（按钮、输入框、下拉）背景必须与其所在卡片有可见差异：深色主题下面板为 `--bg-secondary-40`（比主色亮一档），控件用 `bg-bg-primary-40`（比面板更暗）会显得没有背景；这类控件统一用实色层级 `bg-bg-tertiary`，悬停 `hover:bg-bg-quaternary`

### 2.3. 后端
- 导入: 项目根目录（如 `server/`）用 `~~/`，app 目录用 `~/`（`~/` 即 `app/`）；drizzle 位于 `app/drizzle/`，服务端导入必须写 `~/drizzle/db`、`~/drizzle/schema`，禁止 `~~/drizzle/...`（静态检查不报错，部署构建解析失败）
- 错误: 用户可见的业务错误统一用 `createApiError(statusCode, code, message, data?)`（`~~/server/utils/apiError.ts`），code 取自 `SERVER_ERROR_CODES`；认证错误 401
- 时间戳: 服务端取当前时间统一用 `getServerTimestamp()` / `getServerDate()`（`~~/server/utils/serverTime.ts`），禁止直接写 `Date.now()` / `new Date()`

### 2.4. 第三方库
- otplib: `import otplib from 'otplib'` 然后 `const { authenticator } = otplib`
- 给第三方接口/依赖模块传参前，必须追到实际构造请求体的函数确认该字段被消费；文档未列出的参数一律不得自行添加，中间对象里被读过但没进 payload 的视为无效

### 2.5. 国际化 (i18n)
- 支持 `zh-CN`（基底，静态内置）与 `en-US`（动态按需加载）；词典 `app/utils/locale/{zh-CN,en-US}.ts` 结构必须完全一致，新增文案键须两文件同步添加
- 组件取文案用 `useLocale()` 分区 + `useLocaleText`/`useSafeLocale`，禁止自行实现 `callLocale`/`getNestedMessage` 等取值函数
- 服务端错误码本地化：服务端 `createApiError` 抛码 → 客户端 `useServerErrors().localize(err)` 展示；动态值用第四参 `{ params: [...] }`，词典值用 `{0}`/`{1}` 占位符
- 新增错误码须三处同步：`SERVER_ERROR_CODES` + zh/en 的 `serverErrors`（键完全对齐）
- 英文长文本须考虑页面布局排布：按钮/Tab/徽章/菜单/开关标签等空间受限位置优先使用缩写（如 Previous → Prev），避免溢出或换行错位；描述性文本（Desc/Placeholder/Hint/Message 等）可自然换行不受限；缩写仅调整 en-US 词典值，键名与词典结构保持不变

### 2.6. 时间与时区
设计口径：数据库统一存 UTC（`timestamp` 无时区 + `default now()`），只在"展示"和"按北京日期计算"时转成北京时间（UTC+8）；前端展示的时间必须一律是北京时间，不允许出现偏移。
- 时区换算只允许在 `app/utils/timeUtils.ts`（唯一权威实现，dayjs + `Asia/Shanghai`，前后端共用）里完成；数据库不存北京时间，也不在 SQL 里手工加减小时
- 接口返回的原始时间字段（`createdAt`、`playedAt`、`updatedAt` 等）是**无时区标记的 UTC 墙钟字符串**（形如 `2026-09-24 04:38:31`，即 UTC 的 04:38）；凡前端要展示的时间，接口必须同时给出用 `formatDateTime()` 生成的北京时间字段（如 `requestedAt`，格式 `YYYY/M/D H:mm:ss`）
- 前端展示优先直接渲染接口给的北京时间字段（如首页歌曲列表用 `song.requestedAt`）；需要对时间点做运算（相对时间、排序、倒计时）时，用 `timeUtils` 的北京时区函数显式按北京时区解析
- 禁止 `new Date(原始时间戳)` / `dayjs(原始时间戳)` 解析接口原始时间字段——无时区字符串会被浏览器按本地时区解释，东八区整体偏移 8 小时
- 禁止手写时区换算（`+ 8 * 3600 * 1000`、`toISOString().split('T')[0]`、`getHours()` 等）；当天/本周/本月的边界用 `getBeijingStartOfDay` / `getBeijingStartOfWeek` / `getBeijingEndOfMonth` 等
- 取"当前时间"：服务端 `getServerTimestamp()` / `getServerDate()`（见 2.3），客户端 `getSyncedTimestamp()` / `getSyncedDate()`（`app/composables/useSyncedTime.ts`）

## 3. 项目关键模式

### 3.1. 音频播放器
- `useAudioPlayer.ts` — 全局状态
- `useAudioPlayerControl.ts` — `<audio>` 元素控制、进度拖拽
- `useAudioPlayerSync.ts` — 状态同步
- 连续失败保护: `consecutiveSkipCount`，上限 3 次

### 3.2. 音源
- 多音源搜索（netease、tencent、bilibili）
- QQ 搜索失败自动降级到网易云，选项卡同步切换
- 搜索结果含 `actualMusicPlatform` 字段

### 3.3. 字符串匹配
- 归一化唯一权威实现: `app/utils/song-name-normalize.ts` 的 `normalizeForMatch`（`server/utils` 下同名文件仅转发导出；前端组件禁止内联重复实现）
- 口径: 先繁→简（`toSimplifiedChinese`，映射表 `app/utils/data/cjkT2sMap.ts` 由 OpenCC 数据自动生成、禁止手工编辑），再按单词边界移除 `feat.`/`ft.`，然后移除标点和空格，最后 `&`/`＆` → `and`

### 3.4. 专辑详情
- `AlbumDetailsModal.vue`：仅网易云支持，使用 `AbortController` 防止竞态
- QQ 音乐专辑链接不可点击

### 3.5. 加载动画
- 加载转圈统一用 `~/components/UI/Common/AppSpinner.vue`（scoped CSS 实现，不依赖 UnoCSS utility），支持 `size`（直径 px，默认 32）、`borderWidth`、`label` 属性；复杂加载状态（标题/进度/步骤）用 `LoadingState.vue`（其 circle 类型内部复用 AppSpinner）
- 禁止手写 `border-*-20/30 border-t-primary rounded-full animate-spin` 或自建 `.loading-spinner` 圆环类；此写法依赖 UnoCSS 生成的 border 工具类，preflight 未设置 `border-style: solid` 时整个圆环不可见
- 按钮内加载态可用 Lucide 图标（`Loader2`/`RefreshCw` 等）+ `animate-spin`；错误语义色（如网易云红色转圈）保留专用类
- `AppSpinner` 放在深色/填充底色（`bg-primary`、`bg-primary-hover` 等按钮）内时必须传 `color`（如 `color="white"`），其默认主题色与蓝底同色会不可见；Lucide 图标靠 `text-*` 继承色不受此限
- 全局 border 重置：`main.css` 的 `*` 规则含 `border-style: solid; border-width: 0`，勿删除

## 4. 配置与扩展功能开发规范

### 4.1. 常量与白名单收敛
- 业务白名单/枚举只允许一个权威定义：服务端放 `server/config/constants.ts`（如 `MUSIC_SOURCE_PLATFORMS`），前端放共享模块（如 `app/utils/platforms.ts`）；其他文件一律 import 引用，禁止重新定义同名数组或映射
- 新增业务实体（平台等）需同步：constants + 前端共享模块 + `app/drizzle/schema.ts` 默认值 + 迁移文件，缺一不可

### 4.2. 数据库迁移
- 迁移文件（SQL + snapshot + journal 条目）必须且只能通过 `pnpm db:generate` 自动生成，禁止手工编写 SQL、手工创建 snapshot、手工编辑 `_journal.json`；手工迁移会导致 snapshot 格式与 drizzle-kit 版本不兼容，后续 `db:generate`/`db:check`/`db:migrate` 均会失败
- 迁移时间戳使用真实生成时刻，禁止随意编造
- 迁移文件命名保持 drizzle-kit 自动生成的时间戳格式，禁止手动改名（改名会导致数据库中已执行的迁移记录无法匹配，产生重复迁移）
- 迁移文件要求使用语义化名称，使用 `pnpm db:generate:name <name>` 由 drizzle-kit 生成，禁止生成后手动改名

### 4.3. 新增 SystemSettings 字段同步清单
新增字段必须全部同步，遗漏会导致备份能进不能出、初始化缺字段：
1. `app/drizzle/schema.ts`（含默认值）
2. `server/utils/system-settings-defaults.ts` 的 `SYSTEM_SETTINGS_DEFAULTS`
3. `server/api/admin/system-settings/index.ts` 建行分支
4. `server/api/admin/backup/restore.post.ts` 与 `restore-chunk.post.ts` 的字段白名单（最易遗漏）
5. 需公开时加入 `PUBLIC_SETTINGS_FIELDS`
6. 迁移文件

### 4.4. 组合字段交叉校验
- 多个配置字段存在相互约束（如启用列表与排序列表交集非空）时，保存接口必须做交叉一致性校验：提交字段与当前持久化值合并后校验，禁止只独立校验单字段；失败用 `createApiError` + `COMMON_INVALID_PARAMS`

### 4.5. 开关/禁用类功能
- 实现平台/功能开关时，必须梳理该功能的全部调用路径（含既有降级、兜底、跨平台升级路径），在每条路径的源头按配置过滤，禁止只拦截主入口
- 后台任务（如歌词跨平台升级）遇到被禁用的目标应显式跳过并记录日志，不能静默失败

### 4.6. 配置读取容错
- 读取 DB/外部配置（JSON 数组等）必须容错：非法 JSON、空数组、未知值回退默认值（参考 `usePlatformConfig` 的 `parsePlatformArray`），禁止直接采用解析结果

### 4.7. 模块级缓存与异步配置 UI
- 模块级共享缓存加载必须防并发（in-flight promise 去重）；`refresh` 类方法加 `import.meta.server` 守卫，防止 SSR 污染共享状态
- 依赖异步配置的 UI 在配置加载完成前不渲染（如 `v-if="loaded"`），避免 SSR 首屏闪烁或禁用项短暂可见

### 4.8. 抛错与错误展示
- 抛错必须用 `Error` 实例（可附加 `data`），禁止 `throw { data: ... }` 字面量
- 客户端用户可见错误统一 `useServerErrors().localize(err)` 展示，禁止直接取 `error.data.message`/`error.message`（中文消息在英文界面会泄漏）

### 4.9. 网易云接口白名单同步
`server/api/api-enhanced/netease/[...path].ts` 的 `allowedEndpoints`（端点路径 → 允许的 HTTP 方法）是该代理的唯一放行名单，未列入的接口一律 403。该路由匿名可达且能触达上游全部接口（含发短信、注册、账号绑定等有外部副作用的接口），白名单是唯一的闸门。
- 新增或变更网易云调用端点时，必须同步更新 `allowedEndpoints`，禁止只改调用方。调用点分散：前端音源适配器 `useMusicSources`（搜索/歌词）、封面/时长/详情、听歌识曲、评论、扫码登录、歌单、播放记录/听歌上报、云盘上传（`NeteaseUploadDialog`）、服务端 `songCoverFetcher`/`songDurationFetcher` 等，逐一确认
- 只放行实际使用的端点与真实使用的方法（如 `/audio/match`、`/cloud/upload/*` 为 POST，其余多为 GET）；禁止图省事整段放行、加通配前缀或改成默认放行
- 端点写错或方法不符时功能会直接 403，服务端会打 `[Netease] 拦截未放行的接口` 日志，按日志补齐

### 4.10. 权限模型与权威实现
- 后台业务准入按有效权限判断，禁止用 `role === 'ADMIN'`、`isSuperAdmin` 或角色名单代替功能权限；角色仅用于身份展示及既有受保护账号约束
- `app/utils/admin-permissions.ts` 是权限码、默认模板、读取依赖和页面关联的唯一来源；有效权限为角色模板与用户显式授权的并集，`!权限码` / `!域:*` / `!*` 显式拒绝优先，`permissions: null` 表示跟随角色模板
- 操作权限仅按 `PERMISSION_READ_DEPENDENCIES` 包含必要读取，显式拒绝读取仍生效；禁止把写入、删除、审核、重置密码、分配角色、敏感配置或后台准入互相隐含授权。新增读取依赖须检查数据暴露范围及授权上界，禁止循环依赖
- 服务端用 `hasAdminPermission(user, code)` 检查后台能力，前端用 `usePermissions().can(code)`；两者均要求 `priv:admin-console`。禁止直接对令牌数组使用 `includes` 判断能力，避免遗漏通配、依赖和拒绝项
- 动态角色使用现有 `User.role` 文本列和 `SystemSettings.rolePermissionTemplates` JSON 字段；角色列表复用 `getRoleTemplateKeys()`，角色键复用 `isValidRoleKey()`。不得硬编码内置角色作为完整可分配列表，新增角色无需修改数据库结构
- 权限配置读取失败或结构损坏时必须拒绝特权，禁止按普通配置容错规则恢复默认权限；权限模板只能通过权限矩阵接口修改

### 4.11. 接口准入与授权变更
- `/api/admin/**` 及遗留管理接口统一登记在 `server/utils/admin-permission-routes.ts`；后台接口要求准入码和对应业务码，未登记的读写均拒绝。新增端点须登记实际路径及 HTTP 方法，禁止为解决 403 扩大整组通配规则
- 路由使用 `:id` 可限定正整数 ID；同层存在 `batch-*` 等操作时，不得通过 `users/*` 为单用户操作追加替代权限，以免放行批量操作
- 同一接口按权限允许不同操作时，处理器必须校验提交字段；例如仅有 `users:assign-role` 时，用户 PUT 只允许提交 `role`，不得附带资料、状态或密码
- 修改模板、用户显式权限、账号角色、状态或删除账号时，复用 `withPermissionTransaction()`，在共同事务锁内刷新操作者和权限，再做授权范围及最后持有者校验。禁止把校验与写入拆开或绕过事务执行器申请第二个连接
- 授权上界必须覆盖通配展开、读取依赖、清除拒绝、恢复模板、角色变更和账号重新启用；不能授出操作者未持有的能力，也不能用有限具体权限授出覆盖未来权限的通配符
- `priv:admin-console`、`priv:role-template`、`priv:grant` 受自锁与最后持有者保护；统计全部 active 用户，包括 USER 和自定义角色，禁止预先按管理员角色筛选
- `users:write` 不包含密码重置或角色分配；分别检查 `users:reset-password`、`users:assign-role`。重置密码等可接管目标账号的操作须校验目标能力不超出操作者；`backup:restore` 与 `database:reset` 按全站维护能力审慎分配

### 4.12. 后台页面与模块配置隔离
- `ADMIN_PAGE_CAPABILITIES` 将业务能力关联到菜单；有功能权限即可显示对应入口，无需另配 `page:*`。显式 `!page:<id>` / `!page:*` 仍可隐藏入口；页面码仅控制入口，不授予 API 或数据权限
- `canAccessPage()` 用于菜单，`canUsePage()` 用于加载业务组件；控制台自动选择可用页面，无模块或仅有页面码时显示明确提示，禁止空白页面
- 组合页面按权限分别加载子面板；无权操作须隐藏或禁用按钮，并在事件处理函数中检查权限。禁止只隐藏菜单，或无条件请求无权访问的数据后依赖 403 兜底
- 页面依赖优先使用已有轻量接口：学期筛选用 `/api/semesters/options`，收件人选择用 `/api/admin/recipients` 或点歌券接收人接口，禁止为选项查询授予完整用户或学期管理权限
- SMTP、机器人、播出时段、投稿时段及内置音源配置走 `/api/admin/system-settings/<scope>`；权限和字段清单统一维护在 `server/utils/admin-settings-scope.ts`。新增配置模块须同步专用权限、字段白名单、路由、页面关联和双语文案
- 模块配置接口必须拒绝白名单外字段，保存响应与读取响应均只返回本模块字段；校验中派生的更新字段也须受白名单约束。通用系统设置中的敏感字段另要求 `system-settings:secrets`，禁止为模块功能自动追加整站配置或敏感配置权限
- 密码与令牌只返回掩码，回传掩码表示保留原值；配置加载成功前禁用保存，失败时显示本地化错误，禁止把默认空值保存覆盖真实配置
- SMTP 测试使用隔离实例；仅有 `smtp:test` 时使用已保存配置，不接受客户端指定凭据投递目标。使用保存密码测试时须匹配原服务器、端口、TLS 和用户名，改变目标须重新输入密码；禁止临时改写全局邮件实例

### 4.13. 权限变更验证
- 修改权限链路须覆盖：仅准入无模块、仅页面码、单功能角色、只读与操作角色、组合模块、显式拒绝、通配授权、跨模块字段读写、未登记路由和批量操作旁路
- 新增操作权限或读取依赖时，验证最小授权可完成页面加载与操作，不能读取其他模块凭据或执行无关写入；不得仅以模板包含权限码或按钮源码匹配作为功能验证
- 涉及账号或权限变更须补授权上界、自锁和最后持有者回归；涉及共享事务须验证等待期间撤权或会话版本变更会阻止提交
- 定向回归参见 `tests/server/admin-feature-access.test.ts`、`admin-permission-routes.test.ts`、`permission-policy.test.ts`、`permission-refactor-regressions.test.ts`、`system-settings-permissions.test.ts` 及 `tests/frontend/admin-feature-access.test.ts`；变更完成后运行相关测试和服务端类型检查
- 报告须区分实际 HTTP / 浏览器测试、处理器与组件替身测试、数据库并发测试及未验证项；自动化通过不等于不存在所有越权风险。不得为测试擅自改写现有账号权限、业务配置或发送外部邮件

## 5. 文件变更提醒

**每次完成任务后，如果新增或删除了文件/目录，必须同步更新 `README.md` 的"项目结构"部分，保持与实际文件系统一致。（注意：数据库迁移文件和测试文件除外，不需要改动，不需要新增目录）**
