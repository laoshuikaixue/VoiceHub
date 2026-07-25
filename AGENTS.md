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

### 2.2. Vue 组件
- 统一 `<script setup>`（纯 JS，不加 `lang="ts"`，禁止类型注解）
- API 调用用 `useFetch` 或 `$fetch`，需错误处理
- 模态框用 `<Teleport to="body">`
- 图标用 `<Icon name="..." />`，name 需在 `Icon.vue` 中有定义
- 下拉选择统一复用 `~/components/UI/Common/CustomSelect.vue`；多选使用其 `multiple` 模式，禁止为普通业务配置新增原生 `<select>`
- 状态管理用 Composables，不用 Pinia

### 2.3. 后端
- 导入: 项目根用 `~~/`，app 目录用 `~/`
- 错误: 用户可见的业务错误统一用 `createApiError(statusCode, code, message, data?)`（`~~/server/utils/apiError.ts`），code 取自 `SERVER_ERROR_CODES`；认证错误 401

### 2.4. 第三方库
- otplib: `import otplib from 'otplib'` 然后 `const { authenticator } = otplib`

### 2.5. 国际化 (i18n)
- 支持 `zh-CN`（基底，静态内置）与 `en-US`（动态按需加载）；词典 `app/utils/locale/{zh-CN,en-US}.ts` 结构必须完全一致，新增文案键须两文件同步添加
- 组件取文案用 `useLocale()` 分区 + `useLocaleText`/`useSafeLocale`，禁止自行实现 `callLocale`/`getNestedMessage` 等取值函数
- 服务端错误码本地化：服务端 `createApiError` 抛码 → 客户端 `useServerErrors().localize(err)` 展示；动态值用第四参 `{ params: [...] }`，词典值用 `{0}`/`{1}` 占位符
- 新增错误码须三处同步：`SERVER_ERROR_CODES` + zh/en 的 `serverErrors`（键完全对齐）

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

## 4. 文件变更提醒

**每次完成任务后，如果新增或删除了文件/目录，必须同步更新 `README.md` 的"项目结构"部分，保持与实际文件系统一致。**
