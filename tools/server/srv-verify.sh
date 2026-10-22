#!/usr/bin/env bash
# VoiceHub 主分支在真实 PostgreSQL 上的验证脚本（S0 服务器侧）
# 只使用专用测试库 voicehub_gate_test，不碰任何其它库。
set -u
REPO=/root/voicehub
FORK=https://github.com/TSS-Small-sunshine/VoiceHub.git
DB_URL='postgresql://voicehub_test:voicehub_test_pw@127.0.0.1:5432/voicehub_gate_test'
LOG=/root/s0-verify.log
exec > >(tee "$LOG") 2>&1

hr() { echo; echo "===== $* ====="; }

hr "0. 环境"
printf 'node %s / pnpm %s / psql %s\n' "$(node --version)" "$(pnpm --version)" "$(psql --version | awk '{print $3}')"
echo "swap: $(free -m | awk '/^Swap:/{print $2}') MB"

hr "1. 克隆 fork（main）"
if [ ! -d "$REPO/.git" ]; then
  git clone "$FORK" "$REPO" || { echo "clone 失败"; exit 1; }
else
  git -C "$REPO" fetch origin --quiet && git -C "$REPO" checkout main --quiet && git -C "$REPO" pull --ff-only --quiet
fi
echo "HEAD: $(git -C "$REPO" rev-parse HEAD)"
echo "branch: $(git -C "$REPO" rev-parse --abbrev-ref HEAD)"
cd "$REPO"

hr "2. pnpm install（CI 语义）"
CI=true pnpm install --frozen-lockfile 2>&1 | tail -3
echo "install exit=${PIPESTATUS[0]}"

hr "3. 库基线：可连接的库与表数量（迁移前）"
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"

hr "4. drizzle-kit check"
pnpm exec drizzle-kit check 2>&1 | tail -2

hr "5. 迁移到真实 PG（这是本机无法验证的部分）"
DATABASE_URL="$DB_URL" pnpm exec drizzle-kit migrate 2>&1 | tail -8
echo "migrate exit=$?"

hr "6. 迁移结果：表数量与关键表"
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('User','Song','api_keys','api_key_permissions','schedules') ORDER BY 1"

hr "7. 再跑一次 migrate（幂等性：不应报错、不应重复建表）"
DATABASE_URL="$DB_URL" pnpm exec drizzle-kit migrate 2>&1 | tail -4
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc \
  "SELECT count(*) FROM drizzle.__drizzle_migrations" 2>&1

hr "8. 单元测试（真实 PG 环境下）"
CI=true pnpm test 2>&1 | grep -E '^# (tests|pass|fail)' || echo "测试输出解析失败"

hr "9. 时间口径：timestamp 列类型抽查（设计口径为无时区 UTC）"
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc \
  "SELECT table_name || '.' || column_name || ' -> ' || data_type FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('createdAt','updatedAt') AND table_name IN ('User','Song') ORDER BY 1" 2>&1

hr "10. 数据库时区设置"
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc "SHOW timezone"

hr "DONE（保留测试库以便后续 S1 迁移验证；如需清理执行 DROP DATABASE）"
