# tools/server — Linux 测试服务器脚本

这些脚本用于在**独立 Linux 服务器**上验证本机无法验证的部分（本机无 PostgreSQL / docker / WSL）。它们不参与构建与运行时，删掉不影响项目。

## 前置条件

- Ubuntu 24.04 x86_64，root 或 sudo 可用
- 出站可达 npm registry 与 GitHub
- 有 swap（2GB 内存的机器跑 `nuxt build` 需要，脚本会自动建 4G）

## 脚本用途

| 脚本 | 作用 |
|---|---|
| `srv-inventory.sh` | 环境盘点：OS/CPU/内存/磁盘/工具/端口/出口连通性；并检查是否已存在 voicehub 部署目录（避免误碰别人的实例） |
| `srv-setup.sh` | 环境准备：4G swap、apt 基础工具、Node 22（NodeSource）、pnpm 10.29.3（corepack）、PostgreSQL 16、建隔离测试库 |
| `srv-pg.sh` | 只装 PostgreSQL（等 apt 空闲后执行），启动服务并建测试库/角色 |
| `srv-pg-fix.sh` | 幂等修正测试角色密码与测试库（角色被半成品安装留下时用） |
| `srv-status.sh` | 状态检查：工具版本、内存/swap、磁盘、`voicehub*` 角色与库、连接自测 |
| `srv-verify.sh` | **主验证脚本**：克隆 fork → install → 迁移到真实 PG → 幂等复跑 → 单元测试 → 时间口径抽查 |
| `migrations-probe.sql` | 只读 SQL 探针：迁移记录条数、`api_keys` 列清单、RBAC 表是否存在 |

## S1（RBAC 数据骨架）验证：用 git bundle 传输本地分支

S1 分支**只存在于本机**（按用户要求不 push，fork 远程仍只有 `main`），服务器侧用 bundle 还原：

```powershell
# 1) 本机仓库根：打包分支
git bundle create "$env:TEMP\voicehub-s1.bundle" rbac/S1-integration

# 2) 传到服务器并克隆出该分支
& sshpass -e scp -P <port> -o StrictHostKeyChecking=no "$env:TEMP\voicehub-s1.bundle" root@<host>:/root/
& sshpass -e ssh -p <port> -o StrictHostKeyChecking=no root@<host> 'rm -rf /root/voicehub && git clone -q -b rbac/S1-integration /root/voicehub-s1.bundle /root/voicehub && git -C /root/voicehub log --oneline -1'

# 3) 传验证脚本并执行（SKIP_GATE=1 可只跑 PG 部分）
& sshpass -e scp -P <port> -o StrictHostKeyChecking=no tools/server/srv-verify-s1.sh root@<host>:/root/srv-verify-s1.sh
& sshpass -e ssh -p <port> -o StrictHostKeyChecking=no root@<host> 'bash /root/srv-verify-s1.sh'

# 4) 取回日志（证据回填到 verification-s1.md）
& sshpass -e scp -P <port> -o StrictHostKeyChecking=no root@<host>:/root/s1-verify.log tools/server/logs/s1-verify.log
```

`srv-verify-s1.sh` 覆盖：迁移前基线 → `pnpm db:migrate`（链）→ 表数/迁移记录/矩阵计数 → 唯一约束 `pg_indexes` 断言 → seed 连跑 3 次不变量 → 删一项重跑收敛 → 42P10 探针 → 回滚往返（40→32→40）→ `pnpm test` → `pnpm gate`。

## 安全约定

- 只用专用测试库 `voicehub_gate_test` / `voicehub_migrate_test`，**不碰任何其它库**
- 只建 `voicehub_test` 角色，不改系统用户、不动别人的站点
- 不修改 `.github/workflows/`（CI 策略见仓库根 `AGENTS.md` 与门禁脚本注释）

## 执行方式（在 Windows 侧）

脚本必须**以 LF + 无 BOM** 传输，否则 bash 会报 `#!/usr/bin/env: No such file or directory` 或 `$'\r': command not found`：

```powershell
# 1) 规范化编码（PowerShell 写文件默认会带 CRLF）
$raw = [System.IO.File]::ReadAllText($f)
[System.IO.File]::WriteAllText($f, ($raw -replace "`r`n","`n"), (New-Object System.Text.UTF8Encoding($false)))

# 2) scp 传文件（不要用 Get-Content | ssh，管道会插入 BOM）
& sshpass -e scp -P <port> -o StrictHostKeyChecking=no $f root@<host>:/root/script.sh

# 3) ssh 执行
& sshpass -e ssh -p <port> -o StrictHostKeyChecking=no root@<host> 'bash /root/script.sh'
```

## 已验证结果（2026-09-26，Ubuntu 24.04 / PG 16.15 / Node 22.23.3 / pnpm 10.29.3）

`srv-verify.sh` 在 fork `main`（`cc882ed`）上跑出的真实结果：

| 检查 | 结果 |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| 迁移前 `public` 表数 | 0 |
| `drizzle-kit check` | `Everything's fine` |
| **真实 PG 上执行迁移** | exit 0，`migrations applied successfully` |
| 迁移后 `public` 表数 | 32（含 `Song` / `User` / `api_keys` / `api_key_permissions`） |
| **迁移幂等性：再跑一次** | exit 0，表数仍为 32（无重复建表） |
| 迁移记录条数 | 52（与 `_journal.json` 的 52 条一致） |
| `api_keys` 列数 | 12 |
| RBAC 表（`permissions` / `role_permissions`） | **不存在**——符合 main 现状（S1 才引入） |
| 单元测试（真实 PG 环境） | 189 / 189 pass |
| `createdAt` / `updatedAt` 列类型 | `timestamp without time zone`（符合「DB 存 UTC」设计口径） |
| 数据库时区 | `Etc/UTC` |

这些是本机（无 PG）拿不到的证据，也是后续 S1 迁移与幂等断言的基线。
