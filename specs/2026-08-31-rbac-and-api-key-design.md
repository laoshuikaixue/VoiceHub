# 管理员 RBAC 重构 + API Key 开放能力优化 — 设计稿

## [S1] 背景与目标

VoiceHub 当前管理员权限体系是硬编码字符串判断，散落在 124+ 处后端接口；API Key 仅作为超级管理员独占的 8 项粗粒度权限工具，缺乏所有者、配额、可观测能力。

本次重构目标：

1. **RBAC 数据化**：把角色 × 权限矩阵、个人加授、权限注册做成数据驱动，前后端策略同源。
2. **API Key 开放能力**：在不引入 OAuth2 协议的前提下，给 API Key 加上所有者模型、速率限制、周期配额、IP 白名单、Webhook 回调签名、调用统计。
3. **可演进的权限中心**：未来支持资源作用域（scope）时，只在 `permissions.scope_expression` 字段上加规则，不改架构。

显式不做：

- 资源作用域表达式（scope DSL）本次只预留字段，不实现解析器。
- OAuth2 / OIDC / client_credentials 协议层。
- 多租户隔离（项目本身单租户部署，按学校分平台）。

## [S2] 角色与权限数据模型

### [S2.1] permissions 表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | serial PK | |
| key | text UNIQUE NOT NULL | 权限标识，如 `user.manage` / `songs.write` |
| category | text NOT NULL | 分类：user / song / schedule / system / api |
| description_zh | text NOT NULL | 中文描述 |
| description_en | text NOT NULL | 英文描述 |
| scope_expression | text NULL | 预留字段，本次不解析，仅写入 |
| is_api_permission | boolean NOT NULL DEFAULT false | 是否同时注册为 API Key 可授权限 |
| created_at | timestamptz | |

权限 key 命名规范：`<resource>.<action>`，动作枚举 `read / write / manage / execute / request`。本设计的 API 权限 key 统一使用点分风格（与现有冒号风格 `card-codes:read` 的存储值做兼容映射）。

### [S2.2] role_permissions 表

| 字段 | 类型 | 说明 |
|---|---|---|
| role | text NOT NULL | USER / SONG_ADMIN / ADMIN / SUPER_ADMIN |
| permission_id | int NOT NULL FK | |
| PK | (role, permission_id) | |

四种角色的 seed 数据由 `pnpm db:generate` 自动生成（参考角色清单见后续章节）。

### [S2.3] user_permissions 表（个人加授）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | serial PK | |
| user_id | int NOT NULL FK | |
| permission_id | int NOT NULL FK | |
| grant_type | text NOT NULL | `assign`（加授）/ `revoke`（减授） |
| expires_at | timestamptz NULL | 临时投权到期时间；NULL = 永久 |
| granted_by | int NOT NULL FK | 操作人 user_id |
| reason | text NULL | 加授理由 |
| created_at | timestamptz | |
| UNIQUE | (user_id, permission_id) | |

生效规则（后端 `resolveUserPermissions(userId)` 单一权威函数）：

```
effective_permissions(user) = (
  role_permissions[user.role]
  ∪ { p | exists user_permissions row where grant_type='assign' AND (expires_at IS NULL OR expires_at > now()) }
) − { p | exists user_permissions row where grant_type='revoke' AND (expires_at IS NULL OR expires_at > now()) }
```

`revoke` 优先级高于 `assign`（即使角色有，revoke 也强制删除）。

### [S2.4] api_keys 改造

| 字段 | 类型 | 改动 |
|---|---|---|
| 既有字段 | — | 不动 |
| owner_type | text NOT NULL DEFAULT 'system' | 新增：`system` / `user` / `integration` |
| owner_id | int NULL | 新增：当 owner_type='user' 时填用户 id |
| rate_limit_per_minute | int NULL | 新增：NULL = 不限 |
| quota_daily | int NULL | 新增：NULL = 不限 |
| quota_monthly | int NULL | 新增：NULL = 不限 |
| ip_whitelist | text NULL | 新增：JSON 数组，CIDR/IP 列表 |
| webhook_url | text NULL | 新增：出站回调地址 |
| webhook_secret | text NULL | 新增：HMAC-SHA256 签名密钥（生成时一次性返回明文） |
| created_by_user_id | int FK | 既有；保留 |

迁移策略：现有 8 项 API 权限字符串（`card-codes:read` 等）写入 `permissions` 表，key 用 `card-codes.read` 点分风格；旧 `apiKeyPermissions.permission` 值在读取时做归一化映射。新写入一律使用点分风格。

### [S2.5] 路由权限映射注册中心

`server/utils/rbac/routePermissionMap.ts`：

```ts
export type RouteRule = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  permission: string // permissions.key
  scopeKind?: 'system' | 'self' // 预留
}

export const routePermissionMap: Array<{ matcher: RegExp | string; rule: RouteRule }> = [
  { matcher: /^\/api\/admin\/users(\/|$)/, rule: { method: 'POST', permission: 'user.manage' } },
  // ...
]
```

匹配算法：第一条命中的规则胜出（顺序敏感，资源路由在通配之前）。`api-auth.ts` 替换 `getRequiredPermission` 为 `resolveRoutePermission(pathname, method)`。

## [S3] 现有角色 → 权限矩阵（seed）

| 角色 | 权限 |
|---|---|
| USER | （无管理权限） |
| SONG_ADMIN | `song.read` `song.write` `song.reject` `schedule.read` `schedule.write` `schedule.publish` `playtimes.manage` `request_times.manage` `semester.manage` `stats.read` `card_codes.read` `card_codes.write` |
| ADMIN | SONG_ADMIN 全集 + `user.read` `user.manage` `user.status` `blacklist.manage` `system_settings.read` `email_templates.manage` `smtp.manage` `grade_class.manage` `backup.execute` `notification.send` `api_keys.read` `api_keys.write` `api_keys.manage` |
| SUPER_ADMIN | ADMIN 全集 + `role.manage` `user_permissions.manage` `permissions.manage` `backup.export` `backup.restore` `database.reset` `system_settings.write` `api_keys.delete` |

## [S4] 后端实现

### [S4.1] 模块边界

新增模块 `server/utils/rbac/`：

```
rbac/
  index.ts              # 对外 export
  policies.ts           # 具名策略：canManageUsers(user), canEditSchedule(user) ...
  guards.ts             # requirePermission(event, key, opts?)
  resolvePermissions.ts # 单一权威：resolveUserPermissions(userId)
  routePermissionMap.ts # 路径 → 权限 路由注册中心
  cache.ts              # 进程内 LRU + 失效广播（基于 Nitro hook）
  permissionsSeed.ts    # 4 角色 seed 数据
  constants.ts          # 角色枚举、权限 key 枚举（保证类型对齐）
```

`server/utils/permissions.js` 删除；`server/utils/requireSongAdmin.ts` 保留为薄封装（`requirePermission(event, 'song.write')`）。

### [S4.2] guard 替换

替换规则：所有 `if (!user || !['ADMIN','SUPER_ADMIN'].includes(user.role))` → `await requirePermission(event, '<permission_key>')`。`requirePermission` 内部：

1. 取 `event.context.user`
2. 校验 `user.status === 'active'`（保持现状）
3. 调 `resolveUserPermissions(user.id)`（带缓存，命中即返回）
4. 不在集合内 → 抛 `createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, ...)`

### [S4.3] API Key 中间件改造

`server/middleware/api-auth.ts` 改造点：

1. 路径 → 权限解析改用 `routePermissionMap`
2. 顺序检查：IP 白名单 → 是否激活 → 是否过期 → 速率限制（滑动窗口，Redis 计数器）→ 日配额 → 月配额 → 权限
3. 速率限制键格式 `apikey:rl:{api_key_id}:{minute_bucket}`，TTL 90s
4. 日配额键 `apikey:qd:{api_key_id}:{yyyymmdd}`，月配额键 `apikey:qm:{api_key_id}:{yyyymm}`
5. 超限写 `ApiLogService.logAccess` 且返回 `429`，附 `Retry-After` 头
6. Webhook 出站：`apiKey.webhook_url` 非空时，请求成功后异步发送 `POST`，body 包含 `event` / `payload` / `timestamp` / `signature: HMAC_SHA256(secret, timestamp + '.' + body)`

### [S4.4] 数据库迁移

完全通过 `pnpm db:generate` 自动生成，按 AGENTS.md 4.2 规范。手动仅修改 `permissionsSeed.ts` 的内容（写在 drizzle seed 脚本里，不写裸 SQL）。

迁移脚本调用顺序：
1. `drizzle/schema.ts` 加表 → `pnpm db:generate`
2. 写 `scripts/seed-permissions.ts`，在首次迁移后由 `pnpm db:seed` 触发
3. 旧 `apiKeyPermissions.permission` 字符串归一化在 seed 后由一次性脚本完成（`scripts/normalize-api-permissions.ts`）

### [S4.5] API Key 管理权限

- 创建 / 列表：需要 `api_keys.write`
- 删除：需要 `api_keys.delete`
- 查看日志 / 统计：需要 `api_keys.manage`

ADMIN 默认有 `api_keys.read/write`，但 `api_keys.delete` 仅 SUPER_ADMIN。

## [S5] 前端实现

### [S5.1] 策略镜像模块

`app/utils/rbac.ts`（纯 JS，无 lang="ts"）：

- 镜像 `policies.ts` 的具名函数
- 后端通过 `useFetch('/api/admin/rbac/my-permissions')` 拉当前用户的有效权限集合，缓存到 `useRbac()` composable
- 组件内 `const rbac = useRbac(); rbac.can('user.manage')` 返回 boolean
- `Sidebar.vue` 改用 `rbac.canAccess(page)`，page → 权限映射写在 `app/utils/rbac/routes.ts`

### [S5.2] ApiKeyManager.vue 改造

- 表单增加：所有者类型选择（系统 / 用户）、速率限制输入、日配额、月配额、IP 白名单（多行输入）、Webhook URL + Secret 生成
- 列表卡片增加：当前速率配额使用条（拉 `/api/admin/api-keys/:id/stats`）
- 创建成功弹窗：除 API Key 明文外，还需展示 webhook_secret 明文（一次性）

### [S5.3] 新增 RbacManager.vue

放在 `app/components/Admin/RbacManager.vue`，路由到 `/admin/rbac`：

- 三个标签页：权限总览（只读）/ 角色管理 / 个人加授
- 权限总览：从 `/api/admin/rbac/permissions` 拉，按 category 分组
- 角色管理：四角色一行，每个角色可勾选权限（仅 SUPER_ADMIN 可见）
- 个人加授：搜索用户 → 勾选权限 + 过期时间 + 理由 → 提交；列表展示历史授权，可撤销

## [S6] API 接口清单（新增 / 改造）

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | /api/admin/rbac/permissions | permissions.read | 列出所有权限定义 |
| GET | /api/admin/rbac/roles | permissions.read | 列出角色 × 权限矩阵 |
| PUT | /api/admin/rbac/roles/:role | permissions.manage | 更新角色权限（覆盖式） |
| GET | /api/admin/rbac/user-permissions | permissions.manage | 列出所有用户加授 |
| POST | /api/admin/rbac/user-permissions | permissions.manage | 新增加授（含 assign/revoke/expires_at） |
| DELETE | /api/admin/rbac/user-permissions/:id | permissions.manage | 撤销加授 |
| GET | /api/admin/rbac/my-permissions | （任意登录用户） | 返回当前用户有效权限集合 |
| GET | /api/admin/api-keys/:id/stats | api_keys.read | 速率 / 配额 / Top endpoint |
| GET | /api/admin/api-keys/:id/abnormal-logs | api_keys.manage | 429 / 鉴权失败等异常调用 |
| POST | /api/open/webhook/test | api_keys.manage | 触发一次测试回调 |

现有 API Key 接口改造：POST/PUT 请求体扩展 owner / rate_limit / quota / ip_whitelist / webhook 字段，权限校验改走 `requirePermission(event, 'api_keys.write')`。

## [S7] 数据迁移与回滚

### [S7.1] 迁移步骤

1. 部署新代码（含新表结构，但保留旧 `apiKeyPermissions` 表）
2. `pnpm db:generate` + `pnpm db:migrate` 创建 `permissions` / `role_permissions` / `user_permissions`
3. `pnpm db:seed` 写入 4 角色 × 权限矩阵 + 把旧 8 项 API 权限字符串插入 `permissions` 表
4. `scripts/normalize-api-permissions.ts` 把 `apiKeyPermissions.permission` 旧值（冒号风格）更新为新值（点分风格），记录变更日志
5. 后端启动时双读：旧表先读，命中即返回；新表读路径在 feature flag 后切换
6. `apiKeyPermissions` 表保留 30 天后由 `scripts/drop-legacy-api-permissions.ts` 删除

### [S7.2] 回滚

- 迁移第 1–4 步可逆：保留所有 migration down 脚本
- 代码层 feature flag `RBAC_ENABLED`，关闭即回到旧 `permissions.js` 判断路径
- 数据层 `user_permissions` 表删除不影响功能（默认空）

## [S8] 错误处理与边界

- 权限缓存失效：`user_permissions` 任何 CUD 操作触发 `rbac.cache.invalidate(userId)`；角色权限矩阵变更触发 `rbac.cache.invalidateAll()`
- 权限 key 命名错（DB 里有但代码无引用）：`routePermissionMap` 匹配命中但 `permissions.key` 在 DB 找不到 → 中间件打 ERROR 日志，按拒绝处理
- IP 白名单格式非法：创建时拒绝（CIDR 校验），错误码 `API_KEY_INVALID_IP_WHITELIST`
- Webhook 回调失败：重试 3 次（指数退避），失败入 `webhook_failures` 日志表
- 日 / 月配额耗尽：返回 429 + `X-RateLimit-Reset` 头，客户端可解析
- 速率限制窗口边界：使用 Redis `INCR` + `EXPIRE` 原子操作，避免滑动窗口实现复杂度

## [S9] 验证计划

### [S9.1] 单元测试

新增 `tests/server/rbac/`：

- `resolvePermissions.test.ts`：角色矩阵 / 加授 / 减授 / 过期 / revoke 优先级
- `routePermissionMap.test.ts`：路径匹配顺序 / 通配 / 排除
- `api-rate-limit.test.ts`：滑动窗口边界 / 配额耗尽 / 多 Key 并发

### [S9.2] 集成测试

- `tests/integration/api-auth-rbac.test.ts`：模拟 4 种角色 × 关键 API 的允许/拒绝矩阵
- `tests/integration/api-key-quota.test.ts`：并发打到配额耗尽，验证 429 触发
- `tests/integration/user-permissions.test.ts`：临时投权到期后自动失效

### [S9.3] 手工验证

- `pnpm typecheck`
- `pnpm lint`
- 跑 `pnpm db:generate` 看新增 4 张表 + snapshot
- 浏览器走查：Sidebar 按角色显隐、RbacManager 页面加授 / 撤销流程、ApiKeyManager 新字段填写 + 速率配额展示

## [S10] 风险与缓解

| 风险 | 缓解 |
|---|---|
| 124+ 处权限判断迁移漏改 | 写 ESLint 规则禁止 `user.role` 字面量出现在 `server/api/**`；CI 检查；保留旧 `permissions.js` 作为 fallback 30 天 |
| 权限缓存与 DB 不一致 | 缓存 TTL 60s + 主动失效双保险；`/api/admin/rbac/my-permissions` 不缓存，强制实时 |
| 旧 API Key 权限字符串不兼容 | seed 脚本显式列映射表；旧 Key 一次性转换日志入审计表 |
| 速率限制被绕过（Key 重建） | API Key 创建需要 SUPER_ADMIN 审批；首次创建后 24h 内不可删除 |
| Webhook 回调拖慢主请求 | 异步发送 + 重试；主路径不 await |
| 用户加授误操作 | 列表展示 granted_by + reason + expires_at；撤销操作二次确认 |

## [S11] 实施切片

预计拆 5 个 PR，每个独立可上线：

1. **PR1 数据骨架**：schema + 4 张表 + seed + 迁移脚本（无业务影响）
2. **PR2 后端 RBAC 内核**：rbac 模块 + guards + 全量替换 124+ 处（feature flag 关闭时走旧路径）
3. **PR3 前端策略镜像**：rbac.ts + composable + Sidebar 改造
4. **PR4 API Key 增强**：owner / rate limit / quota / ip 白名单 / webhook + 中间件改造 + ApiKeyManager 表单
5. **PR5 RbacManager 页面 + 移除旧路径**：UI 上线 + 关闭 feature flag + 旧表清理

每个 PR 之间可独立部署、独立验证、独立回滚。
