#!/usr/bin/env bash
# S0 验证环境盘点（在服务器上执行）
set -u
echo "== OS =="
. /etc/os-release; echo "$PRETTY_NAME  kernel=$(uname -r)"
echo "== CPU/RAM =="
nproc; free -m | head -2
echo "== DISK =="
df -h / | tail -1
echo "== SWAP =="
swapon --show 2>/dev/null || echo "(no swap)"
echo "== TOOLS =="
for c in git node npm pnpm psql docker curl make gcc python3 sudo; do
  printf '%-8s ' "$c"
  if command -v "$c" >/dev/null 2>&1; then "$c" --version 2>&1 | head -1; else echo MISSING; fi
done
echo "== POSTGRES =="
systemctl is-active postgresql 2>/dev/null || echo "service: inactive/absent"
ls /usr/lib/postgresql 2>/dev/null || echo "no /usr/lib/postgresql"
echo "== PORTS =="
ss -lntp 2>/dev/null | head -10
echo "== EGRESS: npm registry =="
curl -s -o /dev/null -w "registry.npmjs.org http=%{http_code} time=%{time_total}s\n" --max-time 15 https://registry.npmjs.org/ || echo "npm registry 不可达"
echo "== EGRESS: github =="
curl -s -o /dev/null -w "github.com http=%{http_code} time=%{time_total}s\n" --max-time 15 https://github.com/ || echo "github 不可达"
curl -s -o /dev/null -w "codeload http=%{http_code}\n" --max-time 15 https://codeload.github.com/ || echo "codeload 不可达"
echo "== EGRESS: ubuntu apt =="
curl -s -o /dev/null -w "archive.ubuntu.com http=%{http_code}\n" --max-time 15 http://archive.ubuntu.com/ || echo "apt 源不可达"
echo "== 已有 voicehub 实例？（避免误碰）=="
ls -d /opt/voicehub /root/voicehub /srv/voicehub 2>/dev/null || echo "未发现常见部署目录"
systemctl list-units --type=service --state=running 2>/dev/null | grep -iE 'voicehub|postgres|docker' || echo "无相关运行中服务"
echo "== DONE =="
