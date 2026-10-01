#!/usr/bin/env bash
# 环境准备：swap / Node 22 / pnpm / PostgreSQL（纯测试用途）
set -u
LOG=/root/s0-setup.log
exec > >(tee "$LOG") 2>&1

echo "===== 1. 内存与 swap ====="
free -m | head -2
if ! swapon --show | grep -q .; then
  echo "创建 4G swap（2GB 内存跑 nuxt build 需要）..."
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "swap 已启用"
else
  echo "已存在 swap"
fi
free -m | head -2

echo "===== 2. apt 可用性 ====="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && echo "apt update OK" || { echo "apt update 失败"; exit 1; }

echo "===== 3. 基础工具 ====="
apt-get install -y -qq curl ca-certificates gnupg git >/dev/null && echo "基础工具 OK"

echo "===== 4. Node 22（NodeSource）====="
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh && bash /tmp/nodesource_setup.sh >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
echo "node: $(node --version 2>&1)  npm: $(npm --version 2>&1)"

echo "===== 5. pnpm（随 packageManager 字段，corepack 管理）====="
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@10.29.3 --activate >/dev/null 2>&1 || npm i -g pnpm@10.29.3 >/dev/null 2>&1
echo "pnpm: $(pnpm --version 2>&1)"

echo "===== 6. PostgreSQL 16 ====="
if ! command -v psql >/dev/null 2>&1; then
  apt-get install -y -qq postgresql postgresql-contrib >/dev/null
fi
systemctl enable --now postgresql >/dev/null 2>&1
sleep 2
psql --version
echo "服务状态: $(systemctl is-active postgresql)"

echo "===== 7. 隔离测试库（只建专用库，不碰任何其它库）====="
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='voicehub_test'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE voicehub_test LOGIN PASSWORD 'voicehub_test_pw' SUPERUSER" >/dev/null
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='voicehub_gate_test'" | grep -q 1 \
  || sudo -u postgres createdb -O voicehub_test voicehub_gate_test
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='voicehub_migrate_test'" | grep -q 1 \
  || sudo -u postgres createdb -O voicehub_test voicehub_migrate_test
echo "库列表（仅确认我们的测试库）:"
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'voicehub%'"
echo "连接串: postgresql://voicehub_test:voicehub_test_pw@127.0.0.1:5432/voicehub_gate_test"

echo "===== 8. 汇总 ====="
echo "OS      : $(. /etc/os-release; echo $PRETTY_NAME)"
echo "CPU/RAM : $(nproc) vCPU / $(free -m | awk '/^Mem:/{print $2}') MB (+swap $(free -m | awk '/^Swap:/{print $2}') MB)"
echo "DISK    : $(df -h / | awk 'NR==2{print $4}') free"
echo "node    : $(node --version)"
echo "pnpm    : $(pnpm --version)"
echo "psql    : $(psql --version)"
echo "===== SETUP DONE ====="
