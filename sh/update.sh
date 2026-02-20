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
echo -e "${YELLOW}[1/6] 检查项目目录...${NC}"

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
echo -e "${YELLOW}[2/6] 更新代码...${NC}"
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

# ============================================
# 步骤 3: npm install 更新依赖
# ============================================
echo -e "${YELLOW}[3/6] 更新依赖...${NC}"
echo -e "执行: npm install"
echo ""

npm install

echo -e "${GREEN}✓ 依赖更新完成${NC}"
echo ""

# ============================================
# 步骤 4: 重新部署
# ============================================
echo -e "${YELLOW}[4/6] 重新部署项目...${NC}"
echo -e "执行: npm run deploy"
echo ""

# 尝试执行 npm run deploy (包含数据库迁移、管理员创建、构建)
if npm run deploy; then
    echo -e "${GREEN}✓ 部署更新脚本执行成功${NC}"
else
    echo -e "${RED}部署更新脚本执行失败，尝试仅执行构建...${NC}"
    echo -e "${YELLOW}注意: 数据库迁移可能未完成，请检查日志${NC}"
    npm run build
fi

echo -e "${GREEN}✓ 项目更新构建完成${NC}"
echo ""

# ============================================
# 步骤 5: 重启服务
# ============================================
echo -e "${YELLOW}[5/6] 重启服务...${NC}"
echo ""

service_type=$(detect_service_manager)

if [[ "$service_type" == "pm2" ]]; then
    echo -e "${BLUE}检测到 PM2 服务，正在重启...${NC}"
    pm2 restart voicehub
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
# 步骤 6: 显示状态
# ============================================
echo -e "${YELLOW}[6/6] 服务状态...${NC}"
echo ""

if [[ "$service_type" == "pm2" ]]; then
    pm2 list | grep voicehub
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
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}  pm2 logs voicehub${NC}"
else
    echo -e "${YELLOW}  sudo journalctl -u voicehub -f${NC}"
fi
echo ""
