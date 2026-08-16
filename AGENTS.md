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
- CSS 注释只保留关键信息（变量用途、值来源、防误删警告），禁止写设计意图、过程或对比说明（如“取值与现状一致”“视觉零变化”“浅色模式下需清晰可见”“对齐某分支观感”等）

### 2.2. Vue 组件
- 统一 `<script setup>`（纯 JS，不加 `lang="ts"`，禁止类型注解）
- API 调用用 `useFetch` 或 `$fetch`，需错误处理
- 模态框用 `<Teleport to="body">`
- 图标用 `<Icon name="..." />`，name 需在 `Icon.vue` 中有定义；图标语义必须符合实际功能（如音源控制用 `ListMusic`），禁止使用语义不符的图标
- 项目未开启组件自动导入，模板中使用的自定义组件（含 `Icon`）必须在 `<script setup>` 中显式导入；漏导入不会报错，会被渲染成无内容的原生未知标签（如 `<icon>`），表现为占位但不显示
- 下拉选择统一复用 `~/components/UI/Common/CustomSelect.vue`；多选使用其 `multiple` 模式，禁止为普通业务配置新增原生 `<select>`
- 状态管理用 Composables，不用 Pinia

### 2.3. 后端
- 导入: 项目根用 `~~/`，app 目录用 `~/`
- 错误: 用户可见的业务错误统一用 `createApiError(statusCode, code, message, data?)`（`~~/server/utils/apiError.ts`），code 取自 `SERVER_ERROR_CODES`；认证错误 401
- 时间戳: 服务端取当前时间统一用 `getServerTimestamp()` / `getServerDate()`（`~~/server/utils/serverTime.ts`），禁止直接写 `Date.now()` / `new Date()`

### 2.4. 第三方库
- otplib: `import otplib from 'otplib'` 然后 `const { authenticator } = otplib`

### 2.5. 国际化 (i18n)
- 支持 `zh-CN`（基底，静态内置）与 `en-US`（动态按需加载）；词典 `app/utils/locale/{zh-CN,en-US}.ts` 结构必须完全一致，新增文案键须两文件同步添加
- 组件取文案用 `useLocale()` 分区 + `useLocaleText`/`useSafeLocale`，禁止自行实现 `callLocale`/`getNestedMessage` 等取值函数
- 服务端错误码本地化：服务端 `createApiError` 抛码 → 客户端 `useServerErrors().localize(err)` 展示；动态值用第四参 `{ params: [...] }`，词典值用 `{0}`/`{1}` 占位符
- 新增错误码须三处同步：`SERVER_ERROR_CODES` + zh/en 的 `serverErrors`（键完全对齐）
- 英文长文本须考虑页面布局排布：按钮/Tab/徽章/菜单/开关标签等空间受限位置优先使用缩写（如 Previous → Prev），避免溢出或换行错位；描述性文本（Desc/Placeholder/Hint/Message 等）可自然换行不受限；缩写仅调整 en-US 词典值，键名与词典结构保持不变

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
- `normalizeStr` / `normalizeString`：先移除 `feat.`/`ft.`（单词边界），再移除标点和空格，最后 `&`/`＆` → `and`

### 3.4. 专辑详情
- `AlbumDetailsModal.vue`：仅网易云支持，使用 `AbortController` 防止竞态
- QQ 音乐专辑链接不可点击

### 3.5. 加载动画
- 加载转圈统一用 `~/components/UI/Common/AppSpinner.vue`（scoped CSS 实现，不依赖 UnoCSS utility），支持 `size`（直径 px，默认 32）、`borderWidth`、`label` 属性；复杂加载状态（标题/进度/步骤）用 `LoadingState.vue`（其 circle 类型内部复用 AppSpinner）
- 禁止手写 `border-*-20/30 border-t-primary rounded-full animate-spin` 或自建 `.loading-spinner` 圆环类；此写法依赖 UnoCSS 生成的 border 工具类，preflight 未设置 `border-style: solid` 时整个圆环不可见
- 按钮内加载态可用 Lucide 图标（`Loader2`/`RefreshCw` 等）+ `animate-spin`；错误语义色（如网易云红色转圈）保留专用类
- 全局 border 重置：`main.css` 的 `*` 规则含 `border-style: solid; border-width: 0`，勿删除

## 4. 配置与扩展功能开发规范

### 4.1. 常量与白名单收敛
- 业务白名单/枚举只允许一个权威定义：服务端放 `server/config/constants.ts`（如 `MUSIC_SOURCE_PLATFORMS`），前端放共享模块（如 `app/utils/platforms.ts`）；其他文件一律 import 引用，禁止重新定义同名数组或映射
- 新增业务实体（平台等）需同步：constants + 前端共享模块 + `app/drizzle/schema.ts` 默认值 + 迁移文件，缺一不可

### 4.2. 数据库迁移
- 迁移必须用 `pnpm db:generate` 生成（自动产出 SQL + snapshot + journal），禁止手工编辑 `_journal.json` 或手工放置 SQL；缺 snapshot 会导致后续 `db:generate`/`db:check` 失败或生成重复迁移
- 迁移时间戳使用真实生成时刻，禁止随意编造

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

## 5. 文件变更提醒

**每次完成任务后，如果新增或删除了文件/目录，必须同步更新 `README.md` 的"项目结构"部分，保持与实际文件系统一致。（注意：数据库迁移文件除外）**