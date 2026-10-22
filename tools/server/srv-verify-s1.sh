#!/usr/bin/env bash
# VoiceHub S1（RBAC 数据骨架）在真实 PostgreSQL 上的验证脚本
# 只使用专用测试库 voicehub_gate_test，不碰任何其它库。
#
# 前置：仓库已放到 $REPO 且切到 rbac/S1-integration（用 git bundle 传输，见 tools/server/README.md）
# 执行：bash /root/srv-verify-s1.sh            （完整：迁移/seed/约束/回滚往返 + pnpm gate 六步）
#       SKIP_GATE=1 bash /root/srv-verify-s1.sh（只跑 PG 部分）
set -u

REPO=/root/voicehub
DB_URL='postgresql://voicehub_test:voicehub_test_pw@127.0.0.1:5432/voicehub_gate_test'
PSQL="psql $DB_URL -tAc"
LOG=/root/s1-verify.log
exec > >(tee "$LOG") 2>&1

hr() { echo; echo "===== $* ====="; }
q() { PGPASSWORD=voicehub_test_pw $PSQL "$1"; }
tables() { q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"; }
records() { q "SELECT count(*) FROM public.__drizzle_migrations__"; }
rbac_counts() { q "SELECT (SELECT count(*) FROM permissions) || ' / ' || (SELECT count(*) FROM role_permissions WHERE role='USER') || '-' || (SELECT count(*) FROM role_permissions WHERE role='SONG_ADMIN') || '-' || (SELECT count(*) FROM role_permissions WHERE role='ADMIN') || '-' || (SELECT count(*) FROM role_permissions WHERE role='SUPER_ADMIN')"; }

hr "0. 环境与分支"
node --version; pnpm --version; psql --version | awk '{print $3}'
cd "$REPO" || { echo "仓库不存在：$REPO"; exit 1; }
echo "HEAD: $(git rev-parse HEAD)  branch: $(git rev-parse --abbrev-ref HEAD)"

hr "1. 迁移前基线（期望 32 表 / 52 条迁移记录 / RBAC 表不存在）"
echo "tables=$(tables)  records=$(records)"
q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('permissions','role_permissions')"

hr "2. pnpm db:check（drizzle-kit check）"
pnpm db:check 2>&1 | tail -2

hr "3. 唯一迁移链：pnpm db:migrate（= drizzle-kit migrate + seed）"
DATABASE_URL="$DB_URL" pnpm db:migrate 2>&1 | tail -12
echo "migrate+seed exit=$?"
echo "tables=$(tables)（期望 40）  records=$(records)（期望 53）"
echo "permissions / role_permissions(USER-SONG_ADMIN-ADMIN-SUPER_ADMIN) = $(rbac_counts)（期望 35 / 0-12-25-35）"

hr "4. 唯一约束真实存在（pg_indexes 断言，4+2 个）"
q "SELECT indexname || ' :: ' || indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('role_permissions_role_permissionId_pk','api_rate_limit_counters_key_bucket_unique','api_usage_daily_key_date_unique','api_usage_monthly_key_month_unique','user_permissions_user_permission_unique','permissions_key_unique') ORDER BY indexname"
q "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('role_permissions_role_permissionId_pk','api_rate_limit_counters_key_bucket_unique','api_usage_daily_key_date_unique','api_usage_monthly_key_month_unique','user_permissions_user_permission_unique','permissions_key_unique')"

hr "5. seed 幂等：连跑 3 次，行数不变量必须完全相同"
for i in 1 2 3; do
  DATABASE_URL="$DB_URL" pnpm db:seed > /dev/null 2>&1
  echo "run#$i exit=$? -> $(rbac_counts)"
done

hr "6. 收敛性：删掉一项权限后重跑 seed 必须回来"
q "DELETE FROM permissions WHERE key='song.read'"
echo "删除后 = $(rbac_counts)"
DATABASE_URL="$DB_URL" pnpm db:seed > /dev/null 2>&1
echo "重跑后 = $(rbac_counts)（期望恢复 35 / 0-12-25-35）"

hr "7. ON CONFLICT (role, permissionId) 显式 target 不再报 42P10"
q "BEGIN; INSERT INTO role_permissions (role, \"permissionId\") SELECT 'USER', id FROM permissions ORDER BY id LIMIT 1 ON CONFLICT (role, \"permissionId\") DO UPDATE SET role = EXCLUDED.role; ROLLBACK;"
echo "42P10 探针 exit=$?（0=未报错；错误码 42P10 会在这里显形）"
echo "探针后仍应为 $(rbac_counts)"

hr "8. 回滚往返：40 → 32 → 40"
DATABASE_URL="$DB_URL" pnpm rbac:rollback 2>&1 | tail -6
echo "回滚后 tables=$(tables)（期望 32）  records=$(records)（期望 52）"
q "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name IN ('ownerType','ownerId','rateLimitPerMinute','quotaDaily','quotaMonthly','ipWhitelist','webhookUrl','webhookSecretHash')"
DATABASE_URL="$DB_URL" pnpm db:migrate 2>&1 | tail -6
echo "重新迁移后 tables=$(tables)（期望 40）  records=$(records)（期望 53）  数据=$(rbac_counts)"

hr "9. 单元测试（真实 PG 环境）"
CI=true pnpm test 2>&1 | grep -E '^# (tests|pass|fail)' || echo "测试输出解析失败"

hr "10. 本地门禁六步（install/db:check/lint/test/contract/build）"
if [ "${SKIP_GATE:-0}" = "1" ]; then
  echo "SKIP_GATE=1，跳过 pnpm gate"
else
  DATABASE_URL="$DB_URL" pnpm gate 2>&1 | tail -20
  echo "gate exit=$?"
fi

hr "DONE —— 证据已写入 $LOG"
