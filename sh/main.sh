#!/bin/bash

# VoiceHub 日常维护管理脚本
# 支持快捷重装、查看状态、开启、更新、停止、重装依赖、重新编译

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认安装目录
PROJECT_DIR="/opt/voicehub"

# 帮助信息
show_help() {
    echo -e "${BLUE}VoiceHub 管理脚本${NC}"
    echo ""
    echo "用法: voicehub <命令>"
    echo ""
    echo "命令:"
    echo "  status     查看服务状态"
    echo "  start      启动服务"
    echo "  stop       停止服务"
    echo "  restart    重启服务"
    echo "  update     更新代码并重启"
    echo "  reinstall  重新安装（代码更新+依赖+编译+重启）"
    echo "  deps       重装依赖"
    echo "  build      重新编译"
    echo "  logs       查看日志"
    echo "  help       显示帮助信息"
    echo ""
    echo "示例:"
    echo "  voicehub status    # 查看状态"
    echo "  voicehub restart   # 重启服务"
    echo "  voicehub update    # 更新并重启"
}

# 检查项目目录
check_project() {
    if [[ ! -d "$PROJECT_DIR" ]]; then
        echo -e "${RED}错误: 项目目录不存在: $PROJECT_DIR${NC}"
        echo -e "${RED}请先运行部署脚本安装 VoiceHub${NC}"
        exit 1
    fi
    cd "$PROJECT_DIR"
}

# 查看状态
cmd_status() {
    check_project
    echo -e "${BLUE}检查服务状态...${NC}"
    
    if command -v pm2 &> /dev/null && pm2 list | grep -q "voicehub"; then
        echo -e "${GREEN}PM2 服务状态:${NC}"
        pm2 list | grep voicehub
    elif sudo systemctl is-active --quiet voicehub 2>/dev/null; then
        echo -e "${GREEN}systemctl 服务状态:${NC}"
        sudo systemctl status voicehub
    else
        echo -e "${YELLOW}服务未运行${NC}"
    fi
}

# 启动服务
cmd_start() {
    check_project
    echo -e "${BLUE}启动服务...${NC}"
    
    if command -v pm2 &> /dev/null && pm2 list | grep -q "voicehub"; then
        pm2 start voicehub
        echo -e "${GREEN}✓ PM2 服务已启动${NC}"
    elif sudo systemctl is-active --quiet voicehub 2>/dev/null; then
        sudo systemctl start voicehub
        echo -e "${GREEN}✓ systemctl 服务已启动${NC}"
    else
        # 尝试自动启动
        if [[ -f "$PROJECT_DIR/ecosystem.config.js" ]]; then
            pm2 start ecosystem.config.js
            echo -e "${GREEN}✓ PM2 服务已启动${NC}"
        else
            echo -e "${YELLOW}未找到服务配置，请手动启动${NC}"
        fi
    fi
}

# 停止服务
cmd_stop() {
    check_project
    echo -e "${BLUE}停止服务...${NC}"
    
    if command -v pm2 &> /dev/null && pm2 list | grep -q "voicehub"; then
        pm2 stop voicehub
        echo -e "${GREEN}✓ PM2 服务已停止${NC}"
    elif sudo systemctl is-active --quiet voicehub 2>/dev/null; then
        sudo systemctl stop voicehub
        echo -e "${GREEN}✓ systemctl 服务已停止${NC}"
    else
        echo -e "${YELLOW}服务未运行${NC}"
    fi
}

# 重启服务
cmd_restart() {
    check_project
    echo -e "${BLUE}重启服务...${NC}"
    
    if command -v pm2 &> /dev/null && pm2 list | grep -q "voicehub"; then
        pm2 restart voicehub
        echo -e "${GREEN}✓ PM2 服务已重启${NC}"
    elif sudo systemctl is-active --quiet voicehub 2>/dev/null; then
        sudo systemctl restart voicehub
        echo -e "${GREEN}✓ systemctl 服务已重启${NC}"
    else
        cmd_start
    fi
}

# 更新
cmd_update() {
    check_project
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}       VoiceHub 更新${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    # Git Pull
    echo -e "${YELLOW}[1/3] 更新代码...${NC}"
    git pull origin main
    echo -e "${GREEN}✓ 代码更新完成${NC}"
    
    # npm install
    echo -e "${YELLOW}[2/3] 更新依赖...${NC}"
    npm install
    echo -e "${GREEN}✓ 依赖更新完成${NC}"
    
    # npm run build
    echo -e "${YELLOW}[3/3] 重新构建...${NC}"
    npm run build
    echo -e "${GREEN}✓ 构建完成${NC}"
    
    # 重启服务
    cmd_restart
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}       更新完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# 重装依赖
cmd_deps() {
    check_project
    echo -e "${BLUE}重新安装依赖...${NC}"
    
    rm -rf node_modules
    npm install
    
    echo -e "${GREEN}✓ 依赖重装完成${NC}"
}

# 重新编译
cmd_build() {
    check_project
    echo -e "${BLUE}重新编译项目...${NC}"
    
    npm run build
    
    echo -e "${GREEN}✓ 编译完成${NC}"
}

# 重新安装（更新+依赖+编译+重启）
cmd_reinstall() {
    check_project
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}       VoiceHub 重新安装${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    # 停止服务
    cmd_stop
    
    # Git Pull
    echo -e "${YELLOW}[1/4] 更新代码...${NC}"
    git pull origin main
    echo -e "${GREEN}✓ 代码更新完成${NC}"
    
    # 重装依赖
    echo -e "${YELLOW}[2/4] 重装依赖...${NC}"
    rm -rf node_modules
    npm install
    echo -e "${GREEN}✓ 依赖重装完成${NC}"
    
    # 重新编译
    echo -e "${YELLOW}[3/4] 重新编译...${NC}"
    npm run build
    echo -e "${GREEN}✓ 编译完成${NC}"
    
    # 启动服务
    echo -e "${YELLOW}[4/4] 启动服务...${NC}"
    cmd_start
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}       重新安装完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# 查看日志
cmd_logs() {
    check_project
    
    if command -v pm2 &> /dev/null && pm2 list | grep -q "voicehub"; then
        pm2 logs voicehub
    elif sudo systemctl is-active --quiet voicehub 2>/dev/null; then
        sudo journalctl -u voicehub -f
    else
        echo -e "${YELLOW}服务未运行，无法查看日志${NC}"
        exit 1
    fi
}

# 主命令处理
case "$1" in
    status)
        cmd_status
        ;;
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    update)
        cmd_update
        ;;
    reinstall)
        cmd_reinstall
        ;;
    deps)
        cmd_deps
        ;;
    build)
        cmd_build
        ;;
    logs)
        cmd_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
