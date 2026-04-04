#!/bin/bash

# 确保以 bash 运行
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

# VoiceHub 更新脚本
# 用于更新已部署的 VoiceHub 项目

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认安装目录
PROJECT_DIR="/opt/voicehub"

ensure_pnpm() {
    export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    mkdir -p "$PNPM_HOME"
    export PATH="$PNPM_HOME:$PATH"

    if ! command -v corepack &> /dev/null; then
        npm install -g corepack
        hash -r
    fi

    corepack enable

    local package_manager=""
    if [[ -f "$PROJECT_DIR/package.json" ]]; then
        package_manager=$(node -p "try { JSON.parse(require('fs').readFileSync('$PROJECT_DIR/package.json', 'utf8')).packageManager || '' } catch { '' }")
    fi

    if [[ -n "$package_manager" ]]; then
        corepack prepare "$package_manager" --activate
    fi

    hash -r

    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}错误: pnpm 不可用${NC}"
        exit 1
    fi
}

persist_pm2_binary() {
    if [[ ! -f "/usr/local/bin/pm2" ]]; then
        return 0
    fi

    echo -e "${YELLOW}正在更新系统 pm2 脚本...${NC}"

    sudo tee /usr/local/bin/pm2 > /dev/null << 'EOF'
#!/bin/bash
set -e

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
mkdir -p "$PNPM_HOME"
export PATH="$PNPM_HOME:$PATH"

if ! command -v corepack &> /dev/null; then
    echo "错误: corepack 不可用，请重新运行部署脚本" >&2
    exit 1
fi

corepack enable > /dev/null 2>&1 || true

if [[ -f "/opt/voicehub/package.json" ]]; then
    package_manager=$(node -p "try { JSON.parse(require('fs').readFileSync('/opt/voicehub/package.json', 'utf8')).packageManager || '' } catch { '' }" 2>/dev/null || true)
    if [[ -n "$package_manager" ]]; then
        corepack prepare "$package_manager" --activate > /dev/null 2>&1 || true
    fi
fi

hash -r 2>/dev/null || true

if ! command -v pnpm &> /dev/null; then
    echo "错误: pnpm 不可用，请检查 corepack 配置或重新运行部署脚本" >&2
    exit 1
fi

PM2_ROOT="$(pnpm root -g 2>/dev/null || true)"
PM2_BIN="$PM2_ROOT/pm2/bin/pm2"

if [[ ! -f "$PM2_BIN" ]]; then
    echo "错误: PM2 未正确安装，请重新运行部署脚本" >&2
    exit 1
fi

exec node "$PM2_BIN" "$@"
EOF
    sudo chmod +x /usr/local/bin/pm2
    echo -e "${GREEN}✓ 系统 pm2 脚本已更新${NC}"
}

has_working_pm2() {
    local pm2_root
    local pm2_bin

    pm2_root=$(pnpm root -g 2>/dev/null || true)
    pm2_bin="$pm2_root/pm2/bin/pm2"

    if [[ -f "$pm2_bin" ]]; then
        node "$pm2_bin" -v > /dev/null 2>&1
        return $?
    fi

    if command -v pm2 &> /dev/null; then
        pm2 -v > /dev/null 2>&1
        return $?
    fi

    return 1
}

run_pm2() {
    local pm2_root
    local pm2_bin

    pm2_root=$(pnpm root -g 2>/dev/null || true)
    pm2_bin="$pm2_root/pm2/bin/pm2"

    if [[ -f "$pm2_bin" ]]; then
        node "$pm2_bin" "$@"
        return $?
    fi

    if command -v pm2 &> /dev/null; then
        pm2 "$@"
        return $?
    fi

    echo -e "${RED}错误: PM2 不可用，请重新运行部署脚本修复 PM2${NC}"
    return 1
}

# 检测服务管理器类型
detect_service_manager() {
    if [[ -f "$PROJECT_DIR/ecosystem.config.cjs" || -f "$PROJECT_DIR/ecosystem.config.js" ]]; then
        echo "pm2"
    elif [[ -f "/etc/systemd/system/voicehub.service" ]]; then
        echo "systemd"
    else
        echo "none"
    fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}       VoiceHub 更新脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 步骤 1: 检查项目目录
# ============================================
echo -e "${YELLOW}[1/7] 检查项目目录...${NC}"

if [[ -d "$PROJECT_DIR" ]]; then
    echo -e "${GREEN}✓ 项目目录存在: $PROJECT_DIR${NC}"
else
    echo -e "${RED}错误: 项目目录不存在: $PROJECT_DIR${NC}"
    echo -e "${RED}请先运行部署脚本安装 VoiceHub${NC}"
    exit 1
fi

cd "$PROJECT_DIR"
echo ""

# ============================================
# 步骤 2: Git Pull 更新代码
# ============================================
echo -e "${YELLOW}[2/7] 更新代码...${NC}"
echo -e "执行: git fetch && git reset --hard origin/main"
echo ""

git stash
git pull origin main

# 恢复脚本执行权限
if [[ -f "$PROJECT_DIR/sh/main.sh" ]]; then
    chmod +x "$PROJECT_DIR/sh/main.sh"
fi
if [[ -f "$PROJECT_DIR/sh/update.sh" ]]; then
    chmod +x "$PROJECT_DIR/sh/update.sh"
fi

echo -e "${GREEN}✓ 代码更新完成${NC}"
echo ""

ensure_pnpm

# ============================================
# 步骤 3: 更新系统脚本
# ============================================
echo -e "${YELLOW}[3/7] 更新系统脚本...${NC}"
echo ""

persist_pm2_binary

echo ""

# ============================================
# 步骤 4: pnpm install 更新依赖
# ============================================
echo -e "${YELLOW}[4/7] 更新依赖...${NC}"
echo -e "执行: pnpm install --frozen-lockfile"
echo ""

pnpm install --frozen-lockfile || pnpm install

echo -e "${GREEN}✓ 依赖更新完成${NC}"
echo ""

# ============================================
# 步骤 5: 重新部署
# ============================================
echo -e "${YELLOW}[5/7] 重新部署项目...${NC}"
echo -e "执行: pnpm run deploy"
echo ""

# 尝试执行 pnpm run deploy (包含数据库迁移、管理员创建、构建)
if pnpm run deploy; then
    echo -e "${GREEN}✓ 部署更新脚本执行成功${NC}"
else
    echo -e "${RED}部署更新脚本执行失败，尝试仅执行构建...${NC}"
    echo -e "${YELLOW}注意: 数据库迁移可能未完成，请检查日志${NC}"
    pnpm run build
fi

echo -e "${GREEN}✓ 项目更新构建完成${NC}"
echo ""

# ============================================
# 步骤 6: 重启服务
# ============================================
echo -e "${YELLOW}[6/7] 重启服务...${NC}"
echo ""

service_type=$(detect_service_manager)

if [[ "$service_type" == "pm2" ]]; then
    echo -e "${BLUE}检测到 PM2 服务，正在重启...${NC}"
    run_pm2 restart voicehub
    echo -e "${GREEN}✓ PM2 服务已重启${NC}"
elif [[ "$service_type" == "systemd" ]]; then
    echo -e "${BLUE}检测到 systemctl 服务，正在重启...${NC}"
    sudo systemctl restart voicehub
    echo -e "${GREEN}✓ systemctl 服务已重启${NC}"
else
    echo -e "${YELLOW}⚠ 未检测到服务配置${NC}"
    echo -e "${YELLOW}请先运行部署脚本配置服务${NC}"
fi

echo ""

# ============================================
# 步骤 7: 显示状态
# ============================================
echo -e "${YELLOW}[7/7] 服务状态...${NC}"
echo ""

if [[ "$service_type" == "pm2" ]]; then
    if has_working_pm2; then
        run_pm2 list | grep voicehub
    else
        echo -e "${YELLOW}PM2 命令异常，请重新运行部署脚本修复 PM2${NC}"
    fi
elif [[ "$service_type" == "systemd" ]]; then
    sudo systemctl status voicehub
else
    echo -e "${YELLOW}未检测到服务配置${NC}"
fi

echo ""

# ============================================
# 更新完成
# ============================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}       更新完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}项目目录: $PROJECT_DIR${NC}"
echo ""
echo -e "${YELLOW}提示: 如需查看日志，请运行:${NC}"
if has_working_pm2; then
    echo -e "${YELLOW}  pm2 logs voicehub${NC}"
else
    echo -e "${YELLOW}  sudo journalctl -u voicehub -f${NC}"
fi
echo ""
