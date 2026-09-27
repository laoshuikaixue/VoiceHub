#!/usr/bin/env bash
# 幂等地修正测试角色/库（只看 voicehub* 前缀，不碰其它对象）
set -u
echo "== PG 安装脚本日志尾部 =="
tail -12 /root/s0-pg.out 2>/dev/null || echo "(无 s0-pg.out)"
echo "== 现有角色 =="
sudo -u postgres psql -tAc "SELECT rolname || ' / super=' || rolsuper FROM pg_roles WHERE rolname LIKE 'voicehub%'"
echo "== 现有库 =="
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'voicehub%'"
echo "== 全部库（确认没有别人的库被误建）=="
sudo -u postgres psql -tAc "SELECT datname FROM pg_database ORDER BY 1" | head -10
echo "== 修正密码（幂等）=="
sudo -u postgres psql -c "ALTER ROLE voicehub_test WITH LOGIN PASSWORD 'voicehub_test_pw' SUPERUSER" 2>&1
echo "== 确保测试库存在 =="
for db in voicehub_gate_test voicehub_migrate_test; do
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
    echo "  $db 已存在"
  else
    sudo -u postgres createdb -O voicehub_test "$db" && echo "  $db 已创建"
  fi
done
echo "== 连接自测 =="
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc "SELECT 'connect OK', current_database()" 2>&1
echo "== 最终 voicehub* 对象 =="
sudo -u postgres psql -tAc "SELECT rolname FROM pg_roles WHERE rolname LIKE 'voicehub%'"
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'voicehub%'"
echo "== FIX DONE =="
