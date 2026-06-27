# VoiceHub Agent 行为规范

## 1. 项目概览

VoiceHub — Nuxt 4 校园广播站点歌管理系统。

- **前端**: Nuxt 4 (Vue 3), Tailwind CSS
- **图标**: 自定义 `Icon.vue` 组件（内联 SVG），辅以 `@lucide/vue`
- **后端**: Nuxt Server API (Nitro)
- **数据库**: PostgreSQL (Neon), Drizzle ORM
- **语言**: 后端 TypeScript, Vue SFC 用纯 JavaScript（无 `lang="ts"`）

## 2. 规范

### 2.1. 语言
注释、文档、Git 信息均用简体中文。注释写"为什么"，不写"如何"。

### 2.2. Vue 组件
- 统一 `<script setup>`（纯 JS，不加 `lang="ts"`，禁止类型注解）
- API 调用用 `useFetch` 或 `$fetch`，需错误处理
- 模态框用 `<Teleport to="body">`
- 图标用 `<Icon name="..." />`，name 需在 `Icon.vue` 中有定义
- 状态管理用 Composables，不用 Pinia

### 2.3. 后端
- 导入: 项目根用 `~~/`，app 目录用 `~/`
- 错误: `createError({ statusCode, message })`，认证错误 401

### 2.4. 第三方库
- otplib: `import otplib from 'otplib'` 然后 `const { authenticator } = otplib`

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
