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

**Lint 强制**：新增 ESLint 规则 `no-raw-role-check`（`eslint-rules/no-raw-role-check.js`），禁止 `server/api/**/*.ts` 中出现 `user.role === '...'` / `roles.includes(...)` / `requireAdmin(` / `requireSongAdmin(` 等模式。CI 阶段 `pnpm lint:ci` 必须通过；违规即构建失败。旧路径 fallback 仅在 `RBAC_ENABLED=false` 时启用（`server/utils/permissions.js` 保留 30 天后删除）。

### [S4.3] API Key 中间件改造

`server/middleware/api-auth.ts` 改造点：

1. 路径 → 权限解析改用 `routePermissionMap`
2. 顺序检查：IP 白名单 → 是否激活 → 是否过期 → 速率限制 → 日配额 → 月配额 → 权限
3. 速率限制与配额：**默认 PostgreSQL 实现**（`server/utils/ratelimit/`），与 Redis 实现并列，由环境变量 `RATELIMIT_BACKEND=pg|redis` 切换。当前部署未启用 Redis，因此 pg 是默认且唯一投产路径；redis 仅作可选增强。
4. **速率限制算法**：pg 路径使用"固定窗口（按分钟对齐）"原子累加；若生产压测 [S11.2] 显示边界突发不可接受，则切换到滑动窗口（pg 实现：`api_rate_limit_counters` 表 + 90 秒 TTL + 累计求和）。选择标准由 [S11.2] 性能基线决定。
5. 超限写 `ApiLogService.logAccess` 且返回 `429`，附 `Retry-After` 与 `X-RateLimit-Remaining` 响应头
6. **Webhook 出站**：用 Nitro 的 `event.waitUntil(...)` 异步发送，不阻塞主请求。`webhook_secret` 落库前 `bcrypt` 哈希存储（与 API Key 同款），但创建响应中一次性返回明文用于接收方验签。

### [S4.4] 数据库迁移

完全通过 `pnpm db:generate` 自动生成，按 AGENTS.md 4.2 规范。手动仅修改 `permissionsSeed.ts` 的内容（写在 drizzle seed 脚本里，不写裸 SQL）。

迁移脚本调用顺序：
1. `drizzle/schema.ts` 加表 → `pnpm db:generate`
2. 写 `scripts/seed-permissions.ts`，在首次迁移后由 `pnpm db:seed` 触发
3. 旧 `apiKeyPermissions.permission` 字符串归一化在 seed 后由一次性脚本完成（`scripts/normalize-api-permissions.ts`），**映射字典显式列在脚本顶部**：

```ts
// scripts/normalize-api-permissions.ts
export const LEGACY_PERMISSION_MAP: Record<string, string> = {
  'schedules:read': 'schedules.read',
  'songs:read': 'songs.read',
  'songs:request': 'songs.request',
  'songs:write': 'songs.write',
  'card-codes:read': 'card-codes.read',
  'card-codes:write': 'card-codes.write',
  'card-codes:delete': 'card-codes.delete',
  'backup:execute': 'backup.execute'
}
// 写入 permission_migration_log 表（id, old, new, api_key_id, migrated_at）
```

4. 完成后 `SELECT COUNT(*) FROM apiKeyPermissions WHERE permission LIKE '%:%'` 必须为 0

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

- **权限缓存失效**：`user_permissions` 任何 CUD 操作触发 `rbac.cache.invalidate(userId)`；角色权限矩阵变更触发 `rbac.cache.invalidateAll()`。**单实例部署**使用进程内 LRU + 60s TTL + 主动失效双保险；**多实例部署**（未来场景）需引入 Redis Pub/Sub 广播失效事件，本期暂不实现。
- 权限 key 命名错（DB 里有但代码无引用）：`routePermissionMap` 匹配命中但 `permissions.key` 在 DB 找不到 → 中间件打 ERROR 日志，按拒绝处理
- **IP 白名单格式非法**：创建时拒绝（CIDR/IP 校验），错误码 `API_KEY_INVALID_IP_WHITELIST`
- **Webhook 签名规范**：签名置于请求头 `X-Signature: sha256=<hex>`；请求体只含 `event` / `payload` / `timestamp`，避免接收方解析歧义。签名计算 `HMAC_SHA256(secret, timestamp + '.' + body)`。
- **Webhook 异步发送**：使用 Nitro `event.waitUntil(promise)`，主响应不 await。失败重试 3 次（指数退避 1s/4s/16s），失败入 `webhook_failures` 日志表。
- 日 / 月配额耗尽：返回 `429` + `Retry-After` + `X-RateLimit-Reset` 头，客户端可解析
- **速率限制原子性（pg 实现）**：使用 `INSERT ... ON CONFLICT (api_key_id, bucket_minute) DO UPDATE SET count = count + 1 RETURNING count`，单 SQL 原子操作，无应用层竞态
- **Webhook Secret 存储**：`webhook_secret` 落库前用 `bcrypt` 哈希，明文仅创建响应一次性返回；接收方验证时用明文比对哈希（单向验签不能解哈希，因此**接收方本地比对需保留明文**，设计需文档化告知管理员）。
- 配额字段语义：`NULL` = 不限；`0` = 拒绝（视为无效值，创建时 `quota_daily <= 0` 直接 `400` 拒绝，不允许"零配额"的歧义）

## [S9] 验证计划

### [S9.1] 单元测试（Windows 本地可执行）

新增 `tests/server/rbac/`：

- `resolvePermissions.test.ts`：角色矩阵 / 加授 / 减授 / 过期 / revoke 优先级 / 多重组合
- `routePermissionMap.test.ts`：精确匹配 / 通配符 / 顺序敏感 / 不匹配返回 null
- `api-rate-limit-pg.test.ts`：pg 实现固定窗口边界 / 配额耗尽返回 429 / 并发安全（多 goroutine 累加）
- `webhook-signature.test.ts`：HMAC 计算正确性 / 头位置正确 / 时间戳防重放（±5min 容忍）

### [S9.2] 集成测试（Windows 本地 + Postman/Apifox）

- `tests/integration/api-auth-rbac.test.ts`：4 角色 × 关键 API 的允许/拒绝矩阵（覆盖 `user.manage` / `api_keys.delete` / `role.manage` 等关键差异）
- `tests/integration/api-key-quota.test.ts`：配额耗尽 429 + `Retry-After` 头验证
- `tests/integration/user-permissions.test.ts`：临时投权 `expires_at` 到期自动失效；revoke 覆盖 assign
- **手工验证（Postman）**：使用 USER / SONG_ADMIN / ADMIN / SUPER_ADMIN 四种 Token，对照 [S12] 矩阵请求管理接口，验证返回码

### [S9.3] 手工走查

- `pnpm typecheck`
- `pnpm lint:ci`（含 `no-raw-role-check` 规则）
- 跑 `pnpm db:generate` 看新增 4 张表 + snapshot
- 浏览器走查：Sidebar 按权限显隐、RbacManager 页面加授 / 撤销流程、ApiKeyManager 新字段填写 + 速率配额展示 + Webhook Secret 一次性展示

### [S9.4] 极端边界（Windows 本地）

| 场景 | 操作 | 预期 |
|---|---|---|
| 非法 IP 白名单 | `ip_whitelist` 填 `999.999.999.999` | 创建返回 `API_KEY_INVALID_IP_WHITELIST` |
| 过期时间过去 | 给用户加授 `expires_at = yesterday` | `resolveUserPermissions` 不返回该权限 |
| 配额为 0 | `quota_daily = 0` | 创建返回 `400`，不允许歧义 |
| Webhook 签名 | `node webhook-receiver.js` + ngrok | 接收端用相同 secret 重算 HMAC 一致；缺 `X-Signature` 头拒绝 |
| 权限提升 | USER Token 调 `PUT /api/admin/rbac/roles/USER` | `403` |
| SQL 注入 | `id=1' OR '1'='1` 在 ORM 参数化字段 | 不抛 SQL 异常 |

## [S10] 风险与缓解

| 风险 | 缓解 |
|---|---|
| 124+ 处权限判断迁移漏改 | ESLint `no-raw-role-check` 规则禁止 `user.role` 字面量在 `server/api/**`；CI 强制；保留旧 `permissions.js` fallback 30 天；`RBAC_ENABLED` feature flag 控制切换 |
| 权限缓存与 DB 不一致 | 单实例：进程内 LRU + 60s TTL + 主动失效双保险；多实例留作后续增强（标 [future]） |
| 旧 API Key 权限字符串不兼容 | `scripts/normalize-api-permissions.ts` 显式映射字典；变更入 `permission_migration_log` 审计表 |
| 速率限制被绕过（Key 重建） | API Key 创建 24h 内不可删除；`created_by` 审计完整 |
| Webhook 回调拖慢主请求 | `event.waitUntil` 异步发送 + 重试 + `webhook_failures` 表 |
| Webhook 签名歧义 | 签名固定在 `X-Signature: sha256=<hex>` 头，body 仅含业务字段 |
| 用户加授误操作 | 列表展示 `granted_by` + `reason` + `expires_at`；撤销二次确认；过期自动失效 |
| 速率限制边界突发 | pg 实现固定窗口；若 [S11.2] 压测不通过切换为滑动窗口（pg `api_rate_limit_counters` + 90s TTL 累计） |
| 多实例缓存不一致 | 文档明确当前为单实例假设；多实例需引入 Redis Pub/Sub 广播失效（标 [future]） |

## [S11] 性能与运维（生产环境）

### [S11.1] 数据库索引（迁移必建）

```sql
-- 角色权限矩阵
CREATE INDEX idx_role_permissions_role ON role_permissions(role);

-- 个人加授（按用户查、按权限反查）
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX idx_user_permissions_expires_at ON user_permissions(expires_at) WHERE expires_at IS NOT NULL;

-- 速率限制与配额（pg 实现）
CREATE INDEX idx_api_rate_limit_counters_lookup ON api_rate_limit_counters(api_key_id, bucket_minute);
CREATE INDEX idx_api_usage_daily_lookup ON api_usage_daily(api_key_id, usage_date);
CREATE INDEX idx_api_usage_monthly_lookup ON api_usage_monthly(api_key_id, usage_month);
```

### [S11.2] 生产压测（Linux 环境，Windows 不可执行）

**安全铁律**：
- 只压 GET 请求（避免脏数据）
- 使用 `owner_type='integration'` 的测试专用 Key，IP 白名单限制为压测跳板机
- 业务低峰期（凌晨 2:00–4:00）+ 系统公告
- 数据库连接 > 80% 立即停止并 `RBAC_ENABLED=false` 回滚
- 测试后清理测试 Key 与测试计数

**三项核心压测**：

1. **速率限制原子累加**：`ab -n 200 -c 50 -H "X-API-Key: test_key" /api/songs`
   - 观测：`pg_stat_activity` 锁等待 / `pg_stat_statements` 慢查询
   - 通过：PG CPU < 70%，平均响应时间增幅 < 20%
   - **若 PG CPU > 80%** → 必须引入 Redis 做限流计数器，方案不通过

2. **权限解析缓存击穿**：100 个不同用户 Token 并发打 `/api/admin/rbac/my-permissions`（此接口不缓存）
   - 观测：`role_permissions` + `user_permissions` JOIN 耗时 < 30ms
   - 通过：所有查询走索引、无全表扫描

3. **日/月配额耗尽**：`quota_daily=5` Key 发 10 次请求
   - 观测：第 6 次起返回 `429`，响应头 `Retry-After` 存在
   - 通过：第 2 天配额自动重置

**压测记录模板**：

| 项目 | 内容 |
|---|---|
| 压测时间 | `YYYY-MM-DD HH:MM` |
| 压测人员 | `xxx` |
| 压测工具 | `ab -n 500 -c 50` |
| 测试 API Key | `vhub_test_xxxxx` |
| 目标接口 | `GET /api/songs` |
| DB CPU 峰值 | `xx%` |
| P95 响应 | `xxms` |
| 错误率 | `xx%` |
| 限流触发 | `是 / 否` |
| 结论 | `通过 / 不通过` |

### [S11.3] 监控告警（建议阈值）

| 告警项 | 阈值 | 处理 |
|---|---|---|
| 429 错误率 | > 5% | 检查 Key 配额/限流配置 |
| Webhook 回调失败率 | > 10% | 检查目标服务可用性 |
| 数据库连接池 | > 80% | 扩容或优化查询 |
| 权限缓存命中率 | < 90% | 检查 TTL 或失效逻辑 |
| PG 慢查询（>100ms） | > 10 条/分钟 | 分析索引 |

## [S12] PR 审计检查清单

| PR | 阶段 | 检查重点 |
|---|---|---|
| PR1 | 数据骨架 | 迁移 up/down / Seed 正确 / 旧表保留 / Drizzle schema 一致 / [S11.1] 索引创建 |
| PR2 | 后端 RBAC 内核 | Feature Flag / `resolveUserPermissions` 单测 / `routePermissionMap` 全覆盖 / ESLint 规则 / 旧 `permissions.js` fallback |
| PR3 | 前端策略镜像 | `useRbac()` 正确调用 / Sidebar 按权限显隐 / 未授权 403 友好提示 |
| PR4 | API Key 增强 | 新字段校验 / 中间件顺序 / Webhook 异步 / 速率限制原子操作 / `webhook_secret` bcrypt 存储 |
| PR5 | RbacManager UI | 仅 SUPER_ADMIN 可见 / `expires_at` + `reason` + `granted_by` / 撤销二次确认 / 审计日志 |

## [S13] 回滚验证

```bash
# 关闭 Feature Flag
export RBAC_ENABLED=false

# 验证旧权限逻辑生效
curl -X GET /api/admin/users -H "Authorization: Bearer <admin_token>"
# 应返回 200（旧逻辑允许）

# 数据库回滚（如需要）
pnpm db:migrate down

# 确认旧权限字符串仍可读
pnpm tsx scripts/verify-legacy-permissions.ts
```

## [S14] 审计命令速查

| 审计项 | 命令 |
|---|---|
| 搜索旧权限判断 | `grep -rn "user\.role" server/api/` |
| 搜索冒号风格权限 | `grep -rn ":" server/utils/rbac/` |
| 运行单元测试 | `pnpm test tests/server/rbac/` |
| 检查数据库表结构 | `psql -c "\dt permissions"` |
| 检查 Seed 数据 | `psql -c "SELECT key, category FROM permissions;"` |
| 检查旧权限迁移 | `psql -c "SELECT * FROM apiKeyPermissions WHERE permission LIKE '%:%';"` |
| 开启 PG 慢查询日志 | `psql -c "SET log_min_duration_statement = 50;"` |
| 查看活跃连接 | `psql -c "SELECT count(*) FROM pg_stat_activity WHERE state='active';"` |
| 压测命令（ab） | `ab -n 500 -c 50 -H "X-API-Key: xxx" <url>` |
| 关闭 Feature Flag | `export RBAC_ENABLED=false` |

## [S15] 实施切片

预计拆 5 个 PR，每个独立可上线：

1. **PR1 数据骨架**：schema + 4 张表 + seed + 迁移脚本（含 [S11.1] 索引）（无业务影响）
2. **PR2 后端 RBAC 内核**：rbac 模块 + guards + ESLint 规则 + 全量替换 124+ 处（feature flag `RBAC_ENABLED=false` 时走旧路径）
3. **PR3 前端策略镜像**：rbac.ts + composable + Sidebar 改造
4. **PR4 API Key 增强**：owner / rate limit(pg) / quota / ip 白名单 / webhook + 中间件改造 + ApiKeyManager 表单
5. **PR5 RbacManager 页面 + 移除旧路径**：UI 上线 + 关闭 feature flag + 旧表清理（30 天观察期后）

每个 PR 之间可独立部署、独立验证、独立回滚。

## [S16] 审计结论模板（实施完成后填写）

| 维度 | 结论 | 备注 |
|---|---|---|
| 设计合理性 | ☐ 通过 ☐ 有条件 ☐ 不通过 | |
| 代码质量 | ☐ 通过 ☐ 有条件 ☐ 不通过 | |
| 数据库实现 | ☐ 通过 ☐ 有条件 ☐ 不通过 | |
| 功能完整性 | ☐ 通过 ☐ 有条件 ☐ 不通过 | |
| 安全性 | ☐ 通过 ☐ 有条件 ☐ 不通过 | |
| 性能（生产压测） | ☐ 通过 ☐ 有条件 ☐ 不通过 | 仅 Linux 环境可执行 |
| 运维可观测性 | ☐ 通过 ☐ 有条件 ☐ 不通过 | |

**最终建议**：☐ 批准上线 ☐ 有条件批准 ☐ 拒绝上线

**遗留问题**：

| 编号 | 描述 | 严重度 | 计划解决时间 |
|---|---|---|---|
