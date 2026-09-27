# S3-B1（路由权限注册中心 + 具名策略）真实验证记录

> 状态：**✅ 已完成**（2026-09-27，测试服务器 Ubuntu 24.04 / PG 16.15）
> 代码：`rbac/S3-B1 @ c5675378`（经 `git bundle` 传输，本机未 push）
> 服务器日志：`/root/s3b1-verify.log`

## 验收项与证据

| # | 验收项（TASKS.md S3-B1） | 期望 | 实测 | 状态 |
|---|---|---|---|---|
| 1 | 覆盖 `server/api/**` 全部路由（未覆盖 = 拒绝，有测试） | 零 `unmapped` | `route-coverage.mjs` A 项遍历全部路由文件（含无方法后缀文件的 5 个方法）→ 零未分类；计数 = permission 138 / login 118 / public 9（见服务器日志） | ✅ |
| 2 | `/api/open/songs`、`/api/open/schedules` 精确路径已覆盖 | 有映射 | C 项断言 `GET /api/open/songs → song.read`、`GET /api/open/schedules → schedule.read` | ✅ |
| 3 | 客体策略有单测（ADMIN 对 SUPER_ADMIN 目标拒绝） | 拒绝 | `policies.test.ts`：`canMutateTarget(ADMIN, SUPER_ADMIN)=false`、`assertCanMutateTarget` 403、**开关关闭时仍拒绝** | ✅ |
| 4 | `index.ts` 只多一行 export | +1 行 | `git diff --stat 9ec159f..HEAD -- server/utils/rbac/index.ts` → `1 insertion(+)` | ✅ |
| 5 | `requireSongAdmin.ts` 语义修正 | 无第二份角色矩阵 | 委托内核（`requireActiveUser` + catalog 角色谓词 `isSongAdminRole`），角色数组已删除 | ✅ |
| 6 | 全量单测 | 全 pass | `# tests 237 / # pass 237 / # fail 0`（+15：route-permission-map 8 + policies 7） | ✅ |
| 7 | 契约检查 | exit 0 | `✔ contract: 21 checks passed (6 module(s))`（+4：路由覆盖 A–D） | ✅ |
| 8 | 六步门禁 | exit 0 | `install 6.9s / db:check 1.9s / lint 40.9s / test 9.8s / contract 0.4s / build 146.7s` → `GATE_EXIT=0` | ✅ |
| 9 | `no-raw-role-check` 违规数（S3 输入基线） | 仍为 187 | `187`（本片未接线任何路由，符合「B1 不改变运行时行为」的设计） | ✅ |
| 10 | 工作树干净 | 无输出 | 0 处改动 | ✅ |

## 用户指令收口：D-S1-a（硬编码 → 默认策略）

| 项 | 处置 |
|---|---|
| 现状 | `server/api/user/api-keys/` 4 个端点各自硬编码 `const PERSONAL_PERMISSION = 'songs:request'` |
| 现在 | 统一从 `server/utils/rbac/policies.ts` 取：`PERSONAL_INTEGRATION_PERMISSION`（目标 `song.read`）/ `_STORED`（过渡期 legacy 形）/ `_FORMS`（**由 catalog 派生**，SQL 用 `IN` 匹配全部等价写法） |
| 行为 | **不变**：写入仍存 legacy 形（`api-auth.ts` 仍按冒号词表精确比对，现在切点分会让新令牌全量 403 —— 词表统一归 S5-4） |
| 证据 | `git grep "songs:request" -- server/api/user` 零命中；`single-source.mjs` 的「允许名单只减不增」ratchet 强制移除了 4 条 D-S1-a 条目 |
| 附带 | catalog 新增具名常量 `PERSONAL_INTEGRATION_LEGACY_PERMISSION`（消除同串重复，且由它构造 `LEGACY_PERMISSION_MAP` 的第 3 条） |

## 期间发现并处理的问题

| 现象 | 根因 | 处置 |
|---|---|---|
| 契约抓到 53 处 key 字面量（内核隔离 C + 单一来源 A 同时报红） | 我最初在规则表里写的是 `'user.read'` 字符串（违反 R-32） | 用一次性 codemod 按 catalog 校验后批量替换为 `PERMISSIONS.*`；codemod 保留在 `planning/tools/codemod-route-map-keys.mjs` |
| 内核隔离 B 误报 `routePermissionMap.ts` 直查表 | `\buser_permissions\b` 命中了权限 key `user_permissions.manage` | 正则加负向断言 `(?!\.)`，只匹配表引用 |
| 未注册的 `/api/admin/**` 会落到 `login` 兜底（任何登录用户可访问） | 设计漏洞（我自查发现） | `classifyApiRoute` 对 `admin` / `open` 域**取消登录兜底** ⇒ `unmapped`（拒绝），并有单测钉死 |
| 契约抓出两个「放错位置」的辅助模块 | `server/api/admin/api-keys/permissions.ts`（zod 枚举）与 `server/api/admin/system-settings/secretMask.ts` 不是路由（无 `defineEventHandler`），但 Nitro 会把 api 目录每个 .ts 当路由 | 契约新增 `NON_ROUTE_MODULES` 显式登记（含责任人）：分别归 S5-5、S3-B4-1 迁出；**未登记的非路由模块会让检查失败**（防止真路由混入名单） |

## 需要 Lead 关注的偏差（B1 阶段不生效，各批接线时登记）

1. **权限漂移清单**（已写在 `routePermissionMap.ts` 文件头，共 6 条）：api-keys 放宽（归 S5-5）、backup 拆分（归 S3-B4-3）、database 收紧（归 S3-B4-4）、card-codes 删除收紧、system-settings 写入收紧（归 S3-B4-1）、无守卫端点收紧（归各批）。**B1 的映射表未接线，因此这些差异此刻不产生运行时行为变化。**
2. **`kernel-isolation.mjs` A 项升级**：由「`server/api` 零引用内核」（S2 判据）改为「只允许内核公共入口，禁止深层 import」。S2 的证据仍固化在 `verification-s2.md` 与 git 历史中。
3. **构建期警告**：`postinstall` 报 `Duplicated imports "ROLES"` —— 旧死代码 `server/utils/permissions.js` 也导出 `ROLES`，Nitro 自动导入选择了内核的 `constants.ts`（**内核胜出**）。建议在 S6 收官前删除 `server/utils/permissions.js`（S1 审计已确认它是 0 引用的死代码）。
