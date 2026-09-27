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

## 验收项与证据（待回填）

| # | 验收项（S1 交付定义） | 期望 | 实测 | 状态 |
|---|---|---|---|---|
| 1 | 唯一迁移链 `pnpm db:migrate`（migrate → seed）在空库/既有库上跑通 | exit 0 | | ⏳ |
| 2 | 迁移后表数 32 → **40**（8 张新表） | 40 | | ⏳ |
| 3 | 迁移记录 52 → **53**（journal 条目数一致） | 53 | | ⏳ |
| 4 | `permissions = 35`；`role_permissions` 按角色 **0/12/25/35** | 35 / 0-12-25-35 | | ⏳ |
| 5 | 4 个唯一约束（`role_permissions` 复合键 + 三张配额/限流表）在 `pg_indexes` 中真实存在 | 6 个唯一索引全命中 | | ⏳ |
| 6 | seed 连跑 3 次行数不变量完全一致（幂等） | 3 次相同 | | ⏳ |
| 7 | 删掉一项权限后重跑 seed，数据自动回来（收敛） | 恢复 35 / 0-12-25-35 | | ⏳ |
| 8 | `ON CONFLICT (role, "permissionId")` 显式 target 不再报 **42P10** | exit 0 | | ⏳ |
| 9 | `pnpm rbac:rollback` 往返 40 → 32 → 40，8 列移除后重迁移恢复 | 32 / 40 | | ⏳ |
| 10 | 真实 PG 环境下 `pnpm test`（含 `tests/contract/permission-catalog.test.ts`） | 全 pass | | ⏳ |
| 11 | `pnpm gate` 六步全绿（install/db:check/lint/test/contract/build） | exit 0 | | ⏳ |
| 12 | `.github/` 零改动（D23） | `git status --porcelain .github` 无输出 | | ⏳ |

## 回填方式

1. 本机：`git bundle create voicehub-s1.bundle rbac/S1-integration` → `scp` 到服务器 → `git clone -b rbac/S1-integration voicehub-s1.bundle voicehub`
2. 服务器：`scp tools/server/srv-verify-s1.sh /root/ && bash /root/srv-verify-s1.sh`
3. 把 `/root/s1-verify.log` 的关键段落逐项贴入上表「实测」列；原始日志取回后放 `tools/server/logs/s1-verify.log`（该目录被 `.gitignore` 的 `logs` 规则忽略，仅本地留档，**回填进本文件的文字才算提交证据**）
4. 任何一项失败：在此文件追加「失败分析」小节，写明现象、复现命令与根因，不得静默改成「已通过」
