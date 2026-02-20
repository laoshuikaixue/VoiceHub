#!/bin/bash

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
echo -e "执行: git pull origin main"
echo ""

git pull origin main

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
# 步骤 4: npm run build 重新构建
# ============================================
echo -e "${YELLOW}[4/6] 重新构建项目...${NC}"
echo -e "执行: npm run build"
echo ""

npm run build

echo -e "${GREEN}✓ 项目构建完成${NC}"
echo ""

# ============================================
# 步骤 5: 重启服务
# ============================================
echo -e "${YELLOW}[5/6] 重启服务...${NC}"
echo ""

# 检查 PM2 是否在运行
if command -v pm2 &> /dev/null && pm2 list | grep -q "voicehub"; then
    echo -e "${BLUE}检测到 PM2 服务，正在重启...${NC}"
    pm2 restart voicehub
    echo -e "${GREEN}✓ PM2 服务已重启${NC}"
# 检查 systemctl 是否在运行
elif sudo systemctl is-active --quiet voicehub 2>/dev/null; then
    echo -e "${BLUE}检测到 systemctl 服务，正在重启...${NC}"
    sudo systemctl restart voicehub
    echo -e "${GREEN}✓ systemctl 服务已重启${NC}"
else
    echo -e "${YELLOW}⚠ 未检测到运行中的服务${NC}"
    echo -e "${YELLOW}请手动启动服务:${NC}"
    echo -e "  PM2:   pm2 start ecosystem.config.js"
    echo -e "  systemctl: sudo systemctl start voicehub"
fi

echo ""

# ============================================
# 步骤 6: 显示状态
# ============================================
echo -e "${YELLOW}[6/6] 服务状态...${NC}"
echo ""

if command -v pm2 &> /dev/null && pm2 list | grep -q "voicehub"; then
    pm2 status voicehub
elif sudo systemctl is-active --quiet voicehub 2>/dev/null; then
    sudo systemctl status voicehub
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
