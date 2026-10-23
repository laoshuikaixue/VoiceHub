# feat: 播出日期时段选择 · QQ 互联 OAuth · 批量标记播放 · 自动排期期望落位约束 · 统一日期时间选择器

## 概述

本 PR 为 VoiceHub 新增 5 项功能，均在现有架构上增量实现，未改动上游既有安全加固逻辑（CORS HMAC 签名校验、IP 信任链、JWT 弱密钥 fail-fast 等）。

| # | 功能 | 领域 |
|---|---|---|
| 1 | 播出日期 + 时段两级选择（选歌后弹窗） | 点歌 |
| 2 | QQ 互联 OAuth 直连登录 | 认证 |
| 3 | 批量标记播放 / 未播放 | 歌曲管理 |
| 4 | 自动排期期望落位约束 | 排期 |
| 5 | 统一日期 / 时间选择器组件 | UI 基建 |

**变更规模**：68 个文件，+16750 / −248 行（不含本说明文档）
**数据库迁移**：3 个（`20261023040954` / `20261023042547` / `20261023050353`）

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
- **新增 `app/components/Songs/PlaySlotPickerModal.vue`**：选歌后弹出的时段选择弹窗（`z-[130]`，高于手动投稿弹窗 `z-[100]`）。选日期 → 时段下拉仅列该星期开放的；未选日期 → 列全部；切换日期后若已选时段不再开放则自动清空；确认时回传 `{ date, timeId }`
- `RequestForm.vue`：删除页内嵌时段表单，改为**提交前拦截弹窗**；三条提交路径（自动投稿 / 手动投稿 / 重播）在「时段必选且尚未选择时段」时先弹出 `PlaySlotPickerModal`，确认后回填 `preferredPlayDate` / `preferredPlayTimeId` 再继续提交；取消则清空 `pendingPlaySlotSubmit` 与时段状态
- `PlayTimeManager.vue`：星期勾选按钮组 + 「点歌时段必选」总开关；卡片按星期高亮
- `SongManagement.vue`：展示「M月D日 周X · 时段」，并提供播出日期筛选

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
- README 增加「QQ 互联配置说明」章节（三步接入流程 + 身份关联说明）

---

## 三、批量标记播放 / 未播放

`SongManagement.vue` 批量工具栏新增「标记已播放 / 标记未播放」两个按钮，**独立按钮组**（不复用下载/驳回/删除那一组，视觉样式完全统一：同款 pill 容器 + Transition + `text-[11px] font-black`）。

- 服务端零改动：复用既有 `mark-played` 端点的批量能力（≤100 首），返回 `count`
- 新增 `batchMarkPlayed` / `batchMarkUnplayed`：POST `songIds` → `refreshSongs` → 按仍存在歌曲**恢复勾选**（便于连续操作）；`count=0` 时走 warning noop 提示
- 桌面端：新 Transition + pill 组放在原批量组左侧（**非破坏性操作在前**）；移动端悬浮栏改 `flex-col`，第二行独立组（`border-t` 分隔，`flex-1` 双按钮）
- 颜色沿用单行语义：已播放 = `success`、未播放 = `text-tertiary`

---

## 四、自动排期期望落位约束

自动排期新增「期望落位」语义：

- **期望日期（软偏好）**：设置了期望播出日期的歌曲**只在该日期参与排期**，命中当天时优先安排；其它日期的歌曲不参与本次排期，避免被别的日期抢走
- **期望时段（硬约束）**：选择了指定时段的歌曲**只能排到该时段**，排到其它时段一律拒绝

### 算法层（`app/utils/autoSchedule.ts`）
- `AutoScheduleCandidate` 增加 `preferredPlayDate` / `preferredPlayTimeId`
- 新增 `filterByExpectedPlacement(candidates, options)` → `{ eligible, excludedByDate, excludedByPlayTime }`：时段不符 → 硬排除；日期不符 → 软排除。**排除数量随结果一并返回**，供界面显式提示，避免静默丢弃
- 新增 `preferExpectedDate`（稳定分区，命中目标日期排最前）/ `countExpectedDateHits` / `normalizePreferredPlayDate` / `normalizePreferredPlayTimeId`
- `compareResults` 排序优先级新增「期望日期命中数」（位于投稿人偏差之后、时长偏差之前）
- `autoSchedule` / `autoScheduleExhaustive` 均新增第 9 参 `options`，内部经 `prepareScheduleInput` 统一过滤

### 服务端
- **新增 `server/utils/schedulePlacementConstraint.ts`**：落位约束唯一真源，`assertSchedulePlacement` + `loadSongTitleMap`；期望时段取「重播申请自带时段 > 歌曲自身时段」；违反时抛 `SONG_SCHEDULE_PREFERRED_TIME_MISMATCH`（400）
- `bulk-draft` / `bulk-publish` 复用该校验；**服务端只强制时段，不强制日期**——日期优先级仅作用于算法层，管理员仍可手工改期
- 数据链路补齐：`song-pool.get.ts` / `replay-requests/index.get.ts` / `full.get.ts` 三处透出 `preferredPlayDate`；`full.get.ts` 的 `preferredPlayTimeId` 修正为「重播申请优先，回退歌曲自身」

### 前端（`ScheduleManager.vue`）
- 新增 `autoScheduleOptions` / `autoSchedulePlacement` 计算属性
- 自动排期弹窗展示**排除诊断**：「N 首歌曲指定了其它播出时段，已按硬约束排除」/「N 首歌曲的期望日期不是当天，已排除」
- 待排列表新增「期望日期」徽章
- 手工添加 / 拖拽添加 / 拖拽插入三条路径统一走 `canAddToSchedule` 守卫，时段不符时弹提示并阻止加入

---

## 五、统一日期 / 时间选择器组件

自绘日期与时间选择器，全站替换原生 `<input type="date">` / `datetime-local` / `time`，不依赖原生控件、明暗主题自动适配。

### 新增组件（`app/components/UI/Common/`）
| 组件 | 说明 |
|---|---|
| `AppDatePicker.vue` | 自绘月历弹层：年/月/日三级视图、翻月翻年、今天、清除、`min/max` 范围禁用、框内 label、ghost 变体、`size`(xs~xl) + `rounded`(none~full) 档位 |
| `AppTimePicker.vue` | 时间单选（HH:mm）：时/分双列滚动选择、`scroll-snap` 居中 + 高亮、`clearable` / 「现在」/ `:minuteStep` |
| `AppDateTimePicker.vue` | 日期 + 时间（`YYYY-MM-DDTHH:mm`）：复用日历逻辑，日期视图下追加时/分滚动列 |

三组件统一使用**语义色 token**（`bg-bg-primary` / `border-border-secondary` / `text-*` / `primary-*` / CSS 变量 `--primary-*`），**不依赖 `color-scheme`**，自动跟随主题；弹层统一 `Teleport to="body"` + `usePopupZIndex()` 动态层级，弹层外点 / 滚动 / resize 自动关闭，Esc 关闭。

### 替换范围
15 处原生 `type=date`（`SongManagement` / `SearchFilter` / `PlaySlotPickerModal` / `ScheduleForm` / `CardCodesManager`×2 / `SchedulePrinter`×2 / `SiteConfigManager` / `ScheduleManager`×8）+ `RequestTimeManager` 的 `datetime-local`×2 + `PlayTimeManager` 的 `type=time`×2，各自保留原有布局与尺寸档位。

### 同步
- `CustomSelect` 新增 `size` prop + `sizeClass` 计算属性，与日期选择器高度统一；`SearchFilter` 改用 `size="xs"`
- i18n 新增 `common.datePicker` / `common.timePicker`（占位符 / 今天 / 清除 / 翻月翻年 / 星期 / 月份名 / hour / minute）

---

## 验证

- **单元测试**：`node --experimental-strip-types --test "tests/**/*.test.ts"` → **508 / 508 通过**
  - 新增 `tests/frontend/autoSchedule-placement-constraint.test.ts`（15 例）：归一化、时段硬约束、日期软约束、排除计数、方案比较命中数、算法层集成
- **类型检查**：`pnpm run typecheck:server` 通过（总错误 572 条，闸门族 3 条均在白名单内）
- **生产构建**：`pnpm run build` 通过，`◆ ✨ Build complete`，`.output` 正常产出

## 部署须知

1. 执行数据库迁移：`pnpm run db:migrate`（3 个新迁移）
2. QQ 互联需在 QQ 互联开放平台创建网站应用并在后台填入 App ID / App Key，App Key 打雾保存
