# feat: 点歌券派发 · 投稿选项弹窗重构 · 自动排期落位约束 · 统一日期时间选择器 · 人机验证与错误收敛

## 概述

本 PR 在现有架构上增量实现 5 项功能，均未改动上游既有安全加固逻辑（CORS HMAC 签名校验、IP 信任链、JWT 弱密钥 fail-fast 等）。

| # | 功能 | 领域 | 状态 |
|---|---|---|---|
| 1 | 点歌券派发给指定用户（美团券 / 团购券模式） | 点歌 | 本 PR 新增 |
| 2 | 投稿选项弹窗重构 + 投稿设置说明行 | 点歌 | 本 PR 新增 |
| 3 | 播出日期 + 时段两级选择（选歌后弹窗） | 点歌 | 主干已有基础实现，本 PR 增强「未选日期时自动分配最近开放日期」等行为 |
| 4 | 自动排期期望落位约束 | 排期 | 本 PR 新增约束层（算法层增强 + 服务端唯一真源） |
| 5 | 人机验证接入 + 服务端错误信息收敛 | 安全 | 本 PR 新增 |

> 「统一日期 / 时间选择器组件」作为 UI 基建贯穿其中，见第五章。

**变更规模**：97 个文件，+6943 / −6961 行（不含本说明文档）
**数据库迁移**：1 个新增（`20261024135728_add_card_code_assignment.sql`）
**移除功能**：独立 QQ 互联 OAuth 直连登录、浏览器指纹登录（均已完整回退代码与数据库残留）

---

## 一、点歌券派发（美团券 / 团购券模式）

管理员可把点歌券**派发给指定用户**。获得点歌券的用户在投稿时**直接从下拉列表选择**自己的券，也可手动输入券码。

### 数据层

新增券状态 `ASSIGNED`，并用独立的归属列 + 审计表记录派发全流程。

| 变更 | 说明 |
|---|---|
| `card_code_status` 枚举 | 新增 `ASSIGNED`（位于 `AVAILABLE` 与 `LOCKED` 之间） |
| `card_code_assignment_status` 枚举 | 新增枚举：`ASSIGNED` / `USED` / `RECYCLED` / `FAILED` |
| `CardCode.assignedTo` | 持有人用户 ID，外键指向 `users.id`（`onDelete: set null`） |
| `CardCode.assignedAt` | 派发时间 |
| **新表 `CardCodeAssignment`** | 派发审计流水：券码快照、接收人（ID + 姓名快照）、**派发人员（ID + 姓名）**、**派发时间**、状态、使用时间、回收时间、回收人、回收原因、失败原因、通知状态与错误、备注 |

4 个索引覆盖按券 / 按接收人 / 按状态 / 按派发时间查询。

### 服务端（`server/services/cardCodeAssignmentService.ts`，377 行）

- **派发**：逐张处理，用**条件 UPDATE**（`where id = ? AND status = 'AVAILABLE'`）保证并发安全 —— 同一张券不会被派发两次。失败分三类返回：「已派发给其他用户」/「状态不可派发」/「券不存在」
- **通知失败不回滚派发**：站内通知失败时仅记 `notifyStatus = 'FAILED'` + `notifyError`，券仍归用户所有（用户可在「更多选项」中看到）。这符合团购券「券已到账、消息未送达」的语义
- **整体异常回滚**：派发过程抛异常时把已改状态的券回滚为 `AVAILABLE`，并补写一条 `FAILED` 记录
- **回收**：仅 `ASSIGNED` 可回收。事务内把券置回 `AVAILABLE`、清空 `assignedTo` / `assignedAt`，记录 `RECYCLED` + `recycledAt` / `recycledBy` / `recycleReason`。已 `USED` 的券拒绝回收
- **生命周期同步**：核销时记 `USED`；撤回投稿时若券有持有人，则**归还给持有人**（`ASSIGNED`）而非退回公共池（`AVAILABLE`），避免用户凭空丢券

### 接口

| 接口 | 用途 |
|---|---|
| `POST /api/admin/card-codes/assign` | 派发（校验目标用户存在且非 `pending`，单次上限 500 张，返回逐张失败明细） |
| `POST /api/admin/card-codes/recycle` | 回收 |
| `GET /api/admin/card-codes/assignments` | 派发记录查询（`status` / `q` / `assignee` / `dispatcher` / `startDate` / `endDate` 筛选 + 分页 + 状态统计） |
| `GET /api/admin/card-codes/recipients` | 接收人搜索（返回真实姓名 / username / 年级班级 / 角色，排除 `pending`） |
| `GET /api/card-codes/mine` | 用户查询自己持有的可用券 |

`validate` 接口允许**持有人**使用已派发券（`assigned: true`），非持有人拒绝。
投稿锁定券时允许持有人锁定自己的已派发券（`songRequestService`）。
手工改状态接口**一律拒绝**置为 `ASSIGNED`（必须走派发接口指定接收人），其它状态一律清空 `assignedTo` / `assignedAt`。

### 前端

- **管理端**（`CardCodesManager.vue`）：新增「派发点歌券」面板（接收人内联搜索下拉、已选可用券计数、派发备注、是否发通知开关、失败明细展示）+「派发记录」区（关键词/状态筛选、表格、分页、状态统计徽标）+ 列表行持有人展示 + 卡券列表「已派发」计数卡片 + 导出新增「持有人用户ID」「派发时间」列
- **用户端**（`SubmissionOptionsModal.vue`）：点歌券区改为「我的点歌券」下拉 + 「手动输入券码」并列于同一列表

---

## 二、投稿选项弹窗重构 + 投稿设置说明行

### 弹窗分组与分割线

留言与点歌券合并为同一「投稿内容」组，**组内不再画分割线**；分割线只保留在投稿内容组与「播出安排」控件之间。

```
┌─ 播出安排（时段选择）────────────────┐
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤  ← 唯一分割线
│  投稿备注留言                        │
│  [匿名投稿]              12/300      │
│  点歌券（可选）                      │
│    ▾ 选择点歌券 / 我有 2 张点歌券     │
└──────────────────────────────────────┘
```

实现：`.options-group` 承载内容组，`.options-group--separated` 仅在时段控件启用时加上 `border-top: 1px dashed`。组内间距用 `gap: 1.25rem` 补偿去掉分割线后的留白。

### 点歌券选择方式

「手动输入券码」**并入点歌券下拉列表**作为其中一项（内部哨兵值 `__manual__`），选中后才展开输入框，默认不展开。

- 下拉内容：派发给当前用户的可用券 + 「手动输入券码」
- 已保存的券码若不在派发列表中（手动录入的），打开弹窗时自动回显为「手动输入券码」并展开输入框
- 触发器占位文案：「从我的点歌券中选择，或手动输入券码」

### 投稿区说明行

登录提示条正下方新增一行说明投稿设置内容，**内容随时段 / 留言 / 匿名 / 点歌券开关动态变化**：

| 站点配置 | 显示文案 |
|---|---|
| 留言开 + 券开 | 投稿设置包含：投稿留言、点歌券 |
| 留言关 + 券开 | 投稿设置包含：点歌券 |
| 留言开 + 券关 | 投稿设置包含：投稿留言 |
| 时段开 | 追加「播出安排」项 |
| 全部关闭 | 整行不渲染 |

### 修复：useSafeLocale 下的字符串调用崩溃

`useSafeLocale` 的 Proxy 把所有字符串包装成**带 `toString` 覆写的函数**。任何 `String.prototype` 方法（`.replace` / `.split` / `.includes` / `.trim`）都会抛错，导致整个 `RequestForm` 渲染崩溃、投稿标签页空白。

修复：改用项目既有的 `{0}` 数字占位符 + 直接调用 locale 函数的约定，占位符替换前先用 `String()` 取值。

---

## 三、播出日期 + 时段两级选择（选歌后弹窗）

点歌选曲后弹出**时段选择小窗**：播出**日期可选、时段必选**；**日期优先级高于时段** —— 指定日期时仅能选该星期开放的时段，未指定日期则由服务端自动分配到最近一个开放该时段的日期，适配「周一~周四 4 时段 / 周五仅早中午 / 周日仅傍晚晚上」这类不规则排期。

### 数据层

以下三列**主干已具备**，本 PR 在其基础上增强行为，未新增列：

| 列 | 说明 |
|---|---|
| `PlayTime.weekdays` | `jsonb`，`0=周日 … 6=周六`；空数组表示每天均可选（兼容历史数据） |
| `Song.preferredPlayDate` | `date`，`YYYY-MM-DD` |
| `SystemSettings.playSlotRequired` | `boolean`，时段必选总开关 |

### 服务端

- `server/utils/play-slot.ts` **新增 `findNearestDateForSlot(weekdays, startDate, horizonDays=60)`**：用于「时段必选但日期可选」的场景 —— 用户只选了时段没选日期时，由服务端自动分配到最近一个该时段确实开放的日期，避免出现空排期；未配置星期的时段视为每天开放，直接返回今天
- `songRequestService`：zod schema 增加 `preferredPlayDate`；**时段必选**；指定日期时校验该日期星期必须开放所选时段（否则 400 明确报错 `playSlotNotOpenOnDate`）；未指定日期时自动分配（窗口内无可用日期同样 400）；日期不得早于北京时间今天
- `play-times` API 返回 `required` + `weekdays`；admin CRUD 支持星期配置
- `songs` GET 用 `to_char` 返回 `preferredPlayDate`；开放 API 白名单 + 机器人端点透传日期

### 前端

- **新增 `app/components/Songs/PlaySlotPickerModal.vue`**：选歌后弹出的时段选择弹窗。选日期 → 时段下拉仅列该星期开放的；未选日期 → 列全部；切换日期后若已选时段不再开放则自动清空
- `RequestForm.vue`：删除页内嵌时段表单，改为**提交前拦截弹窗**；三条提交路径（自动投稿 / 手动投稿 / 重播）在「时段必选且尚未选择时段」时先弹窗，确认后回填再继续提交
- `PlayTimeManager.vue`：星期勾选按钮组 + 「点歌时段必选」总开关；卡片按星期高亮
- `SongManagement.vue`：展示「M月D日 周X · 时段」，并提供播出日期筛选

---

## 四、自动排期期望落位约束

- **期望日期（软偏好）**：设置了期望播出日期的歌曲**只在该日期参与排期**，命中当天时优先安排；其它日期的歌曲不参与本次排期
- **期望时段（硬约束）**：选择了指定时段的歌曲**只能排到该时段**，排到其它时段一律拒绝

### 算法层（`app/utils/autoSchedule.ts`）

- 新增 `filterByExpectedPlacement(candidates, options)` → `{ eligible, excludedByDate, excludedByPlayTime }`。**排除数量随结果一并返回**，供界面显式提示，避免静默丢弃
- 新增 `preferExpectedDate`（稳定分区）/ `countExpectedDateHits` / `normalizePreferredPlayDate` / `normalizePreferredPlayTimeId`
- `compareResults` 排序优先级新增「期望日期命中数」（位于投稿人偏差之后、时长偏差之前）

### 服务端

- **新增 `server/utils/schedulePlacementConstraint.ts`**：落位约束唯一真源，`assertSchedulePlacement` + `loadSongTitleMap`；期望时段取「重播申请自带时段 > 歌曲自身时段」；违反时抛 `SONG_SCHEDULE_PREFERRED_TIME_MISMATCH`（400）
- `bulk-draft` / `bulk-publish` 复用该校验；**服务端只强制时段，不强制日期** —— 日期优先级仅作用于算法层，管理员仍可手工改期
- 数据链路补齐：`song-pool.get.ts` / `replay-requests/index.get.ts` / `full.get.ts` 三处透出 `preferredPlayDate`

### 前端（`ScheduleManager.vue`）

- 自动排期弹窗展示**排除诊断**：「N 首歌曲指定了其它播出时段，已按硬约束排除」/「N 首歌曲的期望日期不是当天，已排除」
- 待排列表新增「期望日期」徽章
- 手工添加 / 拖拽添加 / 拖拽插入三条路径统一走 `canAddToSchedule` 守卫

---

## 五、统一日期 / 时间选择器组件

自绘日期与时间选择器，全站替换原生 `<input type="date">` / `datetime-local` / `time`，不依赖原生控件、明暗主题自动适配。

### 新增组件（`app/components/UI/Common/`）

| 组件 | 说明 |
|---|---|
| `AppDatePicker.vue` | 自绘月历弹层：年/月/日三级视图、翻月翻年、今天、清除、`min/max` 范围禁用、框内 label、ghost 变体、`size`(xs~xl) + `rounded`(none~full) 档位 |
| `AppTimePicker.vue` | 时间单选（HH:mm）：时/分双列滚动选择、`scroll-snap` 居中 + 高亮、`clearable` / 「现在」/ `:minuteStep` |
| `AppDateTimePicker.vue` | 日期 + 时间（`YYYY-MM-DDTHH:mm`）：复用日历逻辑，日期视图下追加时/分滚动列 |

三组件统一使用**语义色 token**，**不依赖 `color-scheme`**，自动跟随主题；弹层统一 `Teleport to="body"` + `usePopupZIndex()` 动态层级，弹层外点 / 滚动 / resize 自动关闭，Esc 关闭。

### 替换范围

15 处原生 `type=date`（`SongManagement` / `SearchFilter` / `PlaySlotPickerModal` / `ScheduleForm` / `CardCodesManager`×2 / `SchedulePrinter`×2 / `SiteConfigManager` / `ScheduleManager`×8）+ `RequestTimeManager` 的 `datetime-local`×2 + `PlayTimeManager` 的 `type=time`×2，各自保留原有布局与尺寸档位。**替换完成后 `app/components` 与 `app/pages` 下已无残留的原生 `type="date"` / `type="time"` / `type="datetime-local"` 输入。**

### 同步

- `CustomSelect` 新增 `size` prop + `sizeClass` 计算属性，与日期选择器高度统一；`SearchFilter` 改用 `size="xs"`
- i18n 新增 `common.datePicker` / `common.timePicker`

---

## 六、人机验证与错误处理加固

### 人机验证（新增 `server/utils/request-captcha.ts`）

邮箱验证码与重置密码流程接入人机验证，防止接口被批量刷。

- 新增 `server/utils/request-captcha.ts`（78 行）：统一的验证码校验封装，按站点配置决定是否强制校验
- `email-code.post.ts` / `forgot-password.post.ts` / `captcha/verify.post.ts` 接入校验
- `EsaCaptchaWidget.vue` 同步调整（复用既有 ESA Turnstile 组件，失败计数与重试逻辑收敛）
- `esa-captcha-pass.ts` 为主干已有文件，本 PR 仅做配套调用调整

### 错误处理（`server/error.ts`，185 行改动）

注册 Nitro 全局错误处理器，修复内部错误信息直接透传客户端的问题。

- 服务端内部异常（数据库连接失败、类型错误等）统一收敛为安全文案，**不再把堆栈或 SQL 语句透传给客户端**
- 保留业务错误码的语义化提示（前端可据此做差异化引导）
- 修正错误处理路径中的路径分隔符问题（跨平台路径拼接）

---

## 同时移除（完整回退）

- **独立 QQ 互联 OAuth 直连登录**：provider 配置、`qqStrategy`、`qqOAuthEnabled` 三列、系统设置项、README 说明章节全部移除。**聚合登录中的 QQ 类型保留**（与直连相互独立）
- **浏览器指纹登录**：前端 `FingerprintManager` / `FingerprintBindingsModal`、后端 4 个指纹接口、`useFingerprint` 工具、数据库列与迁移、`User` / `SystemSettings` 相关字段全部回退，与上游 schema 对齐

---

## 验证

- **单元测试**：`node --experimental-strip-types --test "tests/**/*.test.ts"` → **508 / 508 通过**
  - 新增 `tests/frontend/autoSchedule-placement-constraint.test.ts`（15 例）：归一化、时段硬约束、日期软约束、排除计数、方案比较命中数、算法层集成
- **点歌券派发 · 数据库层**：`scripts/test-card-code-assignment.mjs` → **14 / 14 通过**（派发置 `ASSIGNED`、写入 `assignedTo`、落派发记录含时间/人员/接收人、重复派发被拒、用户可查自己他人不可查、持有人可锁定他人不可锁定、使用后记录转 `USED`、回收回 `AVAILABLE`、回收记录含时间与回收人、已核销不可回收）
- **点歌券派发 · HTTP 端到端**：真实 HTTP + Cookie 鉴权 → **55 / 55 通过**（派发、重复派发拒绝、目标用户校验、我的点歌券、持有人校验、派发记录、回收、回收后回可用池、接收人搜索、普通用户派发被拒 403）
- **类型检查**：`pnpm run typecheck:server` 通过（总错误 563 条，闸门族 3 条均在白名单内，**相对基线零新增**）
- **生产构建**：`pnpm run build` 通过（`◆ ✨ Build complete in 34.6s!`，`.output` 正常产出）
- **浏览器实测**（playwright-core + Chromium）：
  - 投稿说明行 5 组配置组合联动验证（留言 / 点歌券 / 时段开关 → 文案增减，全部关闭则整行不渲染）
  - 弹窗分割线位置验证（时段启用时组间 `1px dashed`，组内 `0px`）
  - 点歌券下拉列表验证（2 张派发券 + 「手动输入券码」，手动输入框默认不展开、选中后展开）

## 部署须知

1. 执行数据库迁移：`pnpm run db:migrate`（1 个新迁移：`20261024135728_add_card_code_assignment.sql`）
2. 点歌券派发无需额外配置；派发记录可在管理端「点歌券」页面查看
3. 若此前已执行过被移除的 QQ OAuth / 浏览器指纹迁移，需手工清理对应数据库残留（`SystemSettings` 的 `qqOAuthEnabled` / `qqOAuthAppId` / `qqOAuthAppKey` 三列、`BrowserFingerprint` 表及相关列），应用层已不再引用，不清理也不影响运行
