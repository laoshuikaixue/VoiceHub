#!/usr/bin/env bash
# 只做 PostgreSQL：安装 + 启动 + 建隔离测试库
set -u
LOG=/root/pg-setup.log
exec > >(tee "$LOG") 2>&1

echo "===== 0. 检查是否有 apt/dpkg 占用 ====="
for i in 1 2 3 4 5 6 7 8 9 10; do
  if pgrep -x apt-get >/dev/null || pgrep -x dpkg >/dev/null || pgrep -x apt >/dev/null; then
    echo "apt/dpkg 仍在运行，等待 15s（第 $i 次）"
    sleep 15
  else
    echo "无占用，继续"
    break
  fi
done

export DEBIAN_FRONTEND=noninteractive

echo "===== 1. 安装 PostgreSQL ====="
apt-get install -y -qq postgresql postgresql-contrib || { echo "安装失败"; exit 1; }
echo "psql: $(psql --version 2>&1)"

echo "===== 2. 启动服务 ====="
systemctl enable --now postgresql >/dev/null 2>&1 || pg_ctlcluster 16 main start || true
sleep 3
echo "服务状态: $(systemctl is-active postgresql 2>&1)"
ss -lntp 2>/dev/null | grep 5432 || echo "警告：5432 未监听"

echo "===== 3. 建隔离测试角色与库（绝不碰其它库）====="
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='voicehub_test'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE voicehub_test LOGIN PASSWORD 'voicehub_test_pw' SUPERUSER" >/dev/null
for db in voicehub_gate_test voicehub_migrate_test; do
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
    || sudo -u postgres createdb -O voicehub_test "$db"
done
echo "现有 voicehub* 库（应只有上面两个）:"
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'voicehub%'"

echo "===== 4. 连接自测 ====="
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc "SELECT 'connect OK', current_database()"

echo "===== PG SETUP DONE ====="
