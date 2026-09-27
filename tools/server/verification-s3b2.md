# S3-B2（users 域接线）真实验证记录

> 状态：**✅ 已完成**（2026-09-27，测试服务器 Ubuntu 24.04 / PG 16.15）
> 代码：`rbac/redo @ f6c78ae`（= PR #593 的 head；单 PR 承载全部工作）
> 服务器日志：`/root/b2-verify.log`

## 验收项与证据

| # | 验收项（TASKS.md S3-B2-1 / S3-B2-2） | 期望 | 实测 | 状态 |
|---|---|---|---|---|
| 1 | users 域**读**端点 8 个接线（`canReadUsers` ×7 / `canReadSongs` ×1） | 零内联角色数组 | 单测 `users-read.test.ts`（5 例）覆盖 4 角色拒绝矩阵 + 静态接线 + 护栏回归 | ✅ |
| 2 | users 域**写/批量**端点 10 个接线 | 零角色比较 / 零字面量数组 / 零直读 `context.user` | 单测 `users-target-policy.test.ts`（10 例）逐文件断言 | ✅ |
| 3 | **8 处客体护栏**逐条 `file:line` 断言（D20 修订版） | 每条一个「ADMIN → SUPER_ADMIN 被拒」用例 | 锚点 1 `[id].put.ts:92`、2 `[id].delete.ts:53`、3 `[id]/status.put.ts:68`、4 `[id]/reset-password.post.ts:75`、5/6 `batch-status.put.ts:120/124`、7 `batch-update.post.ts:110`、8 `batch-grade-update.post.ts:122`（用例名内联锚点） | ✅ |
| 4 | `batch-update.post.ts` 的 (a)(b)(c) 三类语义分别处置 | 不混为一类 | 身份类（`user.manage`）/ 状态类（`user.status`）/ 客体类（`canMutateTarget`）分别接线，见 route map 与文件注释 | ✅ |
| 5 | 全量单测 | 全 pass | **`# tests 253 / # pass 253 / # fail 0`**（B1 的 237 + 读端点 5 + 写/批量 10 + 策略用例 1） | ✅ |
| 6 | 契约检查 | exit 0 | `✔ contract: 21 checks passed (6 module(s))` | ✅ |
| 7 | `no-raw-role-check` 违规数（S3 进展指标） | 下降 | **187 → 149**（本片 −38） | ✅ |
| 8 | lint ratchet | 无新增 error | `errors=353（基线 391, **delta -38**）files=669` | ✅ |
| 9 | 六步门禁 | exit 0 | `install 6.8s / db:check 1.9s / lint 41.3s / test 11.0s / contract 0.4s / build` → **`GATE_EXIT=0`** | ✅ |
| 10 | 工作树干净 | 无输出 | 服务器 `git status` 无改动 | ✅ |

## 本片修掉的真实缺陷

| 现象 | 现状（改动前） | 现在 |
|---|---|---|
| users **读**端点的权限错误 | `index.get.ts` / `options.get.ts` / `export.get.ts` 的 `catch` 把守卫的 403 **吞成 500**（客户端看到「服务器错误」） | 守卫异常原样抛出（403/401 带错误码）；单测 `S3-B2-1 护栏` 覆盖 |
| users **写**端点的登录态 | 未登录返回 403；`batch-update` / `batch-grade-update` 还返回英文文案（`Authentication required` / `Insufficient permissions`） | 统一为内核三态：401 `AUTH_UNAUTHORIZED` / 403 `AUTH_ACCOUNT_CURRENTLY_UNAVAILABLE` / 403 `COMMON_INSUFFICIENT_PERMISSION`（客户端按 code 本地化） |
| `[id].put.ts` 的角色变更分支 | `SUPER_ADMIN` / `ADMIN` / 其他 三分支硬编码（其中「其他」在顶层 `user.manage` 下**不可达**） | 收敛为 `assertCanAssignRole`（层级规则由 catalog `roleRank` 派生；不可达分支消失） |
| `batch.post.ts` 的角色矩阵 | 第二份手写矩阵 `{ SUPER_ADMIN: [...], ADMIN: [...] }` | `ROLE_ORDER + canAssignRole`（零第二份矩阵，且 `SUPER_ADMIN` 可设 `SUPER_ADMIN` 的行为保持） |

## 未改变的行为（等价性核对）

- **批量接口不抛错**：`batch-status` / `batch-update` / `batch-grade-update` / `batch.post` 逐条收集错误返回，因此用**不抛错的谓词**（`canMutateTarget` / `canAssignRole`），单条接口才用 `assert*`；单测断言批量文件里不出现 `assertCanMutateTarget(`。
- **`[id]/status.put.ts` 的「仅学生可改状态」** 是 400 域规则（不是越级护栏），改为 `isStudentUser(targetUser)` 后返回码与文案不变。
- **`[id]/songs.get.ts` 取 `song.read`**（而非「读类一律 `user.read`」）：该端点返回歌曲数据，旧行为允许 SONG_ADMIN，取 `song.read` 才逐条等价；已在测试注释与 PR 描述中记为偏差。
