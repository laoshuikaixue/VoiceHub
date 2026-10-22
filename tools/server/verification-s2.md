# S2（后端 RBAC 内核）真实环境验证记录

> 状态：**✅ 已完成**（2026-09-27，测试服务器 Ubuntu 24.04 / PG 16.15）
> 代码：`rbac/S2-kernel @ dc6ad4d1`（经 `git bundle` 传输，本机未 push）
> 日志：`/root/s2-verify.log`（全量验证）、`/root/gate-s2.log`（六步门禁）

## 验收项与证据

| # | 验收项（S2 交付定义） | 期望 | 实测 | 状态 |
|---|---|---|---|---|
| 1 | 内核零调用方（部署后行为 100% 不变） | `git grep -n "utils/rbac" -- server/api` 无输出 | 无输出；契约检查「内核隔离 A」独立断言 | ✅ |
| 2 | 内核单测：角色矩阵 / assign / revoke / 过期语义 / 缓存 TTL / in-flight / guard 三态 / 空表 fail-open | 全 pass | 新增 **27 例**；全量 `# tests 222 / # pass 222 / # fail 0` | ✅ |
| 3 | `server/utils/rbac/` 零 `Date.now()` / `new Date(` | 无输出 | 无输出（时钟走 `../serverTime.ts` 或测试注入） | ✅ |
| 4 | ESLint 规则反证（含 `includes(x.role)`、解构、可选链、计算属性、对象字面量） | 逐条按预期 | 规则单测 7 条 valid / 7 条 invalid + lang="ts" 4 例 | ✅ |
| 5 | 两条规则一次落 error 后基线再冻结，`--check` 绿 | exit 0 | `errors 185 → 391`（+187 裸读 + **19 存量 `lang="ts"`**，与规划实测的 19 个一致）；`--check`：`errors=391 delta +0` | ✅ |
| 6 | `--report voicehub/no-raw-role-check` 登记为 S3 输入基线 | 有数值 | **187** | ✅ |
| 7 | S2-4 契约检查 + 反证 | CONTRACT 0；反证非 0 | `contract: 17 checks passed (5 module(s))`；在 `server/api/admin/db-status.get.ts` 临时加 `import '~~/server/utils/rbac'` → CONTRACT **exit=1**；恢复 → **exit=0**；工作树 0 处改动 | ✅ |
| 8 | 六步门禁全绿 | exit 0 | `install 6.2s / db:check 1.9s / lint 40.4s / test 9.3s / contract 0.3s / build 154.4s` → `✔ 门禁通过（6 步）`，`GATE_EXIT=0` | ✅ |
| 9 | 服务器工作树干净 | `git status --short` 无输出 | 0 处改动 | ✅ |

## 期间发现并修复的真实问题

| 现象 | 根因 | 处置 |
|---|---|---|
| 服务器 gate 的 lint 步 exit=1：`扫描文件数 662 < 基线 665` | 基线在 **Windows** 冻结（665），同一份代码在 **Linux** 只扫到 662 → 「≥ 基线」断言对跨平台过严 | `scripts/eslint-baseline.mjs` 改为「基线 − 跨平台容差 10」，并把 `filesTolerance` / `frozenOn` 写入基线文件（策略即数据）；提交 `dc6ad4d1`，重跑 gate 后 `files=662` 通过 |
| CONTRACT 4 个 check 失败（内核隔离 B/C、单一来源、legacy 字面量） | 检查把**注释里**的 `role_permissions` / `role.manage` 示例、以及内核单测里的**冻结期望值**当成违规 | 扫描前剥离注释（`stripComments`）；把 `tests/server/rbac/` 登记进单一来源允许名单（与 `tests/contract/` 同理：测试里的 key 是「有意字面量」） |

## S2 交付物清单（`git diff --stat 9ec159f..dc6ad4d1`）

```
server/utils/rbac/{cache,resolvePermissions,legacyRoleCheck,fallback,guards,index}.ts   内核 6 文件
eslint-rules/{no-raw-role-check,no-lang-ts}.js + eslint.config.mjs + eslint-baseline.json
tests/server/rbac/kernel/{resolve-permissions,cache,guards,legacy-fallback,eslint-rules}.test.ts  27 例
scripts/contract-checks/kernel-isolation.mjs（新增 4 检查）+ single-source.mjs（剥注释/允许名单）
README.md / AGENTS.md（结构同步 + §4.9 判权口径）
```

## 与上一轮 PR#559 的差异（改造点）

| 项 | 上一轮 | 本次 |
|---|---|---|
| 未知 key 处理 | `toPermissionKey` 只校验「含点」→ 错拼 key 静默入集合 | 一律过 catalog 白名单，未知丢弃并记入 `unknownKeys` |
| `requireAnyPermission` 回滚开关 | **漏了** `isRbacEnabled()` 分叉（开关对它无效） | 两个 `require*` 都分叉，并有回归单测 |
| legacy minRole 矩阵 | 手抄 35 条（第二份字面量，会漂移） | 从 catalog 派生（`roleHasPermission`），契约检查禁止再手抄 |
| seed 未就位 | 全员 403（生产事故） | degraded ⇒ catalog minRole 兜底 + ERROR 日志（60s 节流），与 `RBAC_ENABLED=false` 逐条等价（有单测） |
| 缓存 | 只缓存权限集合 | 缓存 `PermissionState`；degraded **不缓存**（修复后立即恢复） |
| 时钟 | `Date.now()` | `getServerTimestamp()` / 可注入假时钟（单测不等待） |
