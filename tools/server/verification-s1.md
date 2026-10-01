# S1（RBAC 数据骨架）真实 PG 验证记录

> 状态：**⏳ 待执行** —— 本机无 PostgreSQL / docker / WSL，下列各项必须在测试服务器上跑完并回填真实输出。
> 执行脚本：`tools/server/srv-verify-s1.sh`（日志 `/root/s1-verify.log`）
> 分支传输：`git bundle`（S1 分支只在本机，不 push，见 `README.md`）

## 基线（`main @ cc882ed`，2026-09-26 已实测，见 `README.md`）

| 项 | 基线值 |
|---|---|
| `public` 表数 | 32 |
| 迁移记录（`public.__drizzle_migrations__`） | 52 |
| RBAC 表 | 不存在 |
| 单元测试 | 189 / 189 pass |

## 执行记录

| 项 | 值 |
|---|---|
| 服务器 | Ubuntu 24.04.1 LTS / 2 vCPU / 2048 MB RAM + **4 GB swap** / 40 GB 磁盘（30 GB 可用） |
| 工具链 | Node **v22.23.3** / pnpm **10.29.3** / psql **16.15** / PostgreSQL 服务 active |
| 测试库 | `voicehub_gate_test`（专用，未触碰任何其它库） |
| 代码 | `rbac/S1-integration @ 57fe9eae`（经 `git bundle` 传输，本机未 push） |
| 主脚本 | `tools/server/srv-verify-s1.sh`（服务器日志 `/root/s1-verify.log`） |

## 验收项与证据

| # | 验收项（S1 交付定义） | 期望 | 实测（2026-09-27，真实 PG） | 状态 |
|---|---|---|---|---|
| 1 | 唯一迁移链 `pnpm db:migrate`（migrate → seed）在既有库上跑通 | exit 0 | `migrate+seed exit=0`，输出 `[✓] migrations applied successfully!` + `[db-migrate] ✔ 迁移链完成` | ✅ |
| 2 | 迁移后表数 32 → **40**（8 张新表） | 40 | `tables=40（期望 40）` | ✅ |
| 3 | 迁移记录 52 → **53**（与 journal 条目数一致） | 53 | `records=53（期望 53）` | ✅ |
| 4 | `permissions = 35`；`role_permissions` 按角色 **0/12/25/35** | 35 / 0-12-25-35 | `permissions / role_permissions = 35 / 0-12-25-35` | ✅ |
| 5 | 唯一约束在 `pg_indexes` 真实存在 | 6 个全命中 | `role_permissions_role_permissionId_pk`（`USING btree (role, "permissionId")`）、`api_rate_limit_counters_key_bucket_unique`、`api_usage_daily_key_date_unique`、`api_usage_monthly_key_month_unique`、`user_permissions_user_permission_unique`、`permissions_key_unique` → 计数 `6` | ✅ |
| 6 | seed 连跑 3 次行数不变量完全一致（幂等） | 3 次相同 | `run#1/#2/#3 exit=0 -> 35 / 0-12-25-35` | ✅ |
| 7 | 删掉一项权限后重跑 seed，数据自动回来（收敛） | 恢复 35 / 0-12-25-35 | 删除后 `34 / 0-11-24-34` → 重跑后 `35 / 0-12-25-35` | ✅ |
| 8 | `ON CONFLICT (role, "permissionId")` 显式 target 不再报 **42P10** | exit 0 | `BEGIN; INSERT … ON CONFLICT (role, "permissionId") DO UPDATE …; ROLLBACK;` → `INSERT 0 1` + `ROLLBACK`，探针 exit=0 | ✅ |
| 9 | `pnpm rbac:rollback` 往返 40 → 32 → 40，8 列移除后重迁移恢复 | 32 / 40 | 回滚后 `tables=32 / records=52 / 残留列=0`；重迁移后 `tables=40 / records=53 / 数据=35 / 0-12-25-35` | ✅ |
| 10 | 真实 PG 环境下 `pnpm test`（含 `tests/contract/permission-catalog.test.ts`） | 全 pass | `# tests 195 / # pass 195 / # fail 0`（首轮 194/195，见下方「失败与修复」） | ✅ |
| 11 | `pnpm gate` 六步全绿（install/db:check/lint/test/contract/build） | exit 0 | `install 6.0s / db:check 1.9s / lint 41.3s / test 7.3s / contract 0.2s / build 182.4s`，`✔ 门禁通过（6 步）`，`GATE_EXIT=0` | ✅ |
| 12 | `.github/` 零改动（D23） | `git status --porcelain .github` 无输出 | 命令无输出；gate 亦打印 `✔ .github/ 无改动（D23 守约）` | ✅ |

## 门禁六步明细（最终提交 `3cc36afc`）

```
=== 门禁汇总 ===
  ✔ install   exit=0  6.0s      ✔ db:check  exit=0  1.9s
  ✔ lint      exit=0  41.3s     ✔ test      exit=0  7.3s
  ✔ contract  exit=0  0.2s      ✔ build     exit=0  182.4s
✔ .github/ 无改动（D23 守约）
✔ 门禁通过（6 步）            GATE_EXIT=0
```

| 步骤 | 关键输出 |
|---|---|
| lint（ratchet） | 无新增 error（修掉首轮 1 条后） |
| test | `收集测试文件 28 个`；`# tests 195 / # pass 195 / # fail 0` |
| contract | `✔ contract: 13 checks passed (4 module(s))` |
| build | 182.4s（2 vCPU / 2GB RAM + 4GB swap；本机估算的 612.8s 是 Windows 侧数字） |

**DB 终态（验证结束时）**：`tables=40`、`records=53`、`permissions=35`、`matrix=ADMIN=25 SONG_ADMIN=12 SUPER_ADMIN=35`（USER 无行，即 0）、`unique_indexes=6`、`api_keys_new_columns=8`。

**服务器工作树**：`rbac/S1-integration @ 3cc36afc`，`git status --short` 无输出，`.github/` 无输出。

## 失败与修复（首轮真实记录，不隐藏）

| 现象 | 根因 | 处置 |
|---|---|---|
| 首轮 `pnpm test` = `# tests 195 / # pass 194 / # fail 1` | `tests/contract/permission-catalog.test.ts` 的**负例清单写错一条**：把合法 catalog key `card_codes.read`（下划线是目录键正字法）当成「近似 key」期望 `null` | 改为真正该测的连字符形 `card-codes.read` / `card_code.read`；`scripts/contract-checks/legacy-map.mjs` 的冻结负例同步补齐；提交 `57fe9eae`，服务器 fast-forward 后复跑 **195/195 pass** |
| 首轮 `pnpm gate` = `✖ lint 新增 error 1 条（当前 186，基线 185）` | 我新增的 `scripts/deploy.js` 在 catch 中重抛错误未挂 `cause`，违反 ESLint 9 的 `preserve-caught-error`（ratchet 机制按设计拦住，不是误报） | 改为 `new Error(msg, { cause: error })`；本地定向 `pnpm exec eslint scripts/deploy.js` exit 0、`node scripts/eslint-baseline.mjs --check` → `errors=185（基线 185, delta +0）`；提交 `3cc36afc` 后服务器 gate 六步全绿 |


## 回填方式

1. 本机：`git bundle create voicehub-s1.bundle rbac/S1-integration` → `scp` 到服务器 → `git clone -b rbac/S1-integration voicehub-s1.bundle voicehub`
2. 服务器：`scp tools/server/srv-verify-s1.sh /root/ && bash /root/srv-verify-s1.sh`
3. 把 `/root/s1-verify.log` 的关键段落逐项贴入上表「实测」列；原始日志取回后放 `tools/server/logs/s1-verify.log`（该目录被 `.gitignore` 的 `logs` 规则忽略，仅本地留档，**回填进本文件的文字才算提交证据**）
4. 任何一项失败：在此文件追加「失败分析」小节，写明现象、复现命令与根因，不得静默改成「已通过」
