#!/usr/bin/env bash
# 服务器状态检查（每次执行都会重新生成 .nuxt）
echo "== 工具版本 =="
printf 'node  : %s\n' "$(node --version 2>&1)"
printf 'pnpm  : %s\n' "$(pnpm --version 2>&1)"
printf 'psql  : %s\n' "$(psql --version 2>&1)"
printf 'pg svc: %s\n' "$(systemctl is-active postgresql 2>&1)"
echo "== 内存/swap =="
free -m | awk '/^Mem:|^Swap:/{printf "%-6s %s MB total, %s MB free\n", $1, $2, $4}'
echo "== 磁盘 =="
df -h / | tail -1
echo "== 测试库（只应看到 voicehub_gate_test / voicehub_migrate_test）=="
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'voicehub%'" 2>&1
echo "== 测试角色 =="
sudo -u postgres psql -tAc "SELECT rolname FROM pg_roles WHERE rolname LIKE 'voicehub%'" 2>&1
echo "== 连接串自测 =="
PGPASSWORD=voicehub_test_pw psql -h 127.0.0.1 -U voicehub_test -d voicehub_gate_test -tAc "SELECT 'connect OK', current_database(), version()" 2>&1 | head -2
echo "== 安装脚本是否跑完 =="
grep -c "SETUP DONE" /root/s0-setup.out 2>/dev/null || echo "0"
tail -3 /root/s0-setup.out 2>/dev/null
