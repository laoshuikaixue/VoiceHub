#!/bin/bash

# 确保以 bash 运行
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

# VoiceHub 日常维护管理脚本
# 支持上下键选择菜单

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 默认安装目录
PROJECT_DIR="/opt/voicehub"

# 检查项目目录
check_project() {
    if [[ ! -d "$PROJECT_DIR" ]]; then
        echo -e "${RED}错误: 项目目录不存在: $PROJECT_DIR${NC}"
        echo -e "${RED}请先运行部署脚本安装 VoiceHub${NC}"
        exit 1
    fi
    cd "$PROJECT_DIR"
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

# 查看状态
cmd_status() {
    check_project
    echo -e "${BLUE}检查服务状态...${NC}"
    
    local service_type=$(detect_service_manager)
    
    if [[ "$service_type" == "pm2" ]]; then
        if command -v pm2 &> /dev/null && pm2 list | grep -q "voicehub"; then
            echo -e "${GREEN}PM2 服务状态:${NC}"
            pm2 list | grep voicehub
        else
            echo -e "${YELLOW}PM2 服务未运行${NC}"
        fi
    elif [[ "$service_type" == "systemd" ]]; then
        echo -e "${GREEN}systemctl 服务状态:${NC}"
        sudo systemctl status voicehub
    else
        echo -e "${YELLOW}未检测到服务配置${NC}"
    fi
}

# 启动服务
cmd_start() {
    check_project
    echo -e "${BLUE}启动服务...${NC}"
    
    local service_type=$(detect_service_manager)
    
    if [[ "$service_type" == "pm2" ]]; then
        if [[ -f "ecosystem.config.cjs" ]]; then
            pm2 start ecosystem.config.cjs
        else
            pm2 start ecosystem.config.js
        fi
        echo -e "${GREEN}✓ PM2 服务已启动${NC}"
    elif [[ "$service_type" == "systemd" ]]; then
        sudo systemctl start voicehub
        echo -e "${GREEN}✓ systemctl 服务已启动${NC}"
    else
        echo -e "${YELLOW}未找到服务配置，请先运行部署脚本配置服务${NC}"
        exit 1
    fi
}

# 停止服务
cmd_stop() {
    check_project
    echo -e "${BLUE}停止服务...${NC}"
    
    local service_type=$(detect_service_manager)
    
    if [[ "$service_type" == "pm2" ]]; then
        pm2 stop voicehub
        echo -e "${GREEN}✓ PM2 服务已停止${NC}"
    elif [[ "$service_type" == "systemd" ]]; then
        sudo systemctl stop voicehub
        echo -e "${GREEN}✓ systemctl 服务已停止${NC}"
    else
        echo -e "${YELLOW}未找到服务配置${NC}"
    fi
}

# 重启服务
cmd_restart() {
    check_project
    echo -e "${BLUE}重启服务...${NC}"
    
    local service_type=$(detect_service_manager)
    
    if [[ "$service_type" == "pm2" ]]; then
        pm2 restart voicehub
        echo -e "${GREEN}✓ PM2 服务已重启${NC}"
    elif [[ "$service_type" == "systemd" ]]; then
        sudo systemctl restart voicehub
        echo -e "${GREEN}✓ systemctl 服务已重启${NC}"
    else
        echo -e "${YELLOW}未找到服务配置，请先运行部署脚本配置服务${NC}"
        exit 1
    fi
}

# 更新
cmd_update() {
    check_project
    if [[ -f "$PROJECT_DIR/sh/update.sh" ]]; then
        bash "$PROJECT_DIR/sh/update.sh"
    else
        echo -e "${RED}错误: 找不到更新脚本 $PROJECT_DIR/sh/update.sh${NC}"
        exit 1
    fi
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

# 重新安装
cmd_reinstall() {
    check_project
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}       VoiceHub 重新安装${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    cmd_stop
    
    echo -e "${YELLOW}[1/4] 更新代码...${NC}"
    git fetch origin main
    git stash
    git reset --hard origin/main
    echo -e "${GREEN}✓ 代码更新完成${NC}"
    
    echo -e "${YELLOW}[2/4] 重装依赖...${NC}"
    rm -rf node_modules
    npm install
    echo -e "${GREEN}✓ 依赖重装完成${NC}"
    
    echo -e "${YELLOW}[3/4] 重新编译...${NC}"
    npm run build
    echo -e "${GREEN}✓ 编译完成${NC}"
    
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
    
    local service_type=$(detect_service_manager)
    
    if [[ "$service_type" == "pm2" ]]; then
        pm2 logs voicehub
    elif [[ "$service_type" == "systemd" ]]; then
        sudo journalctl -u voicehub -f
    else
        echo -e "${YELLOW}未找到服务配置，无法查看日志${NC}"
        exit 1
    fi
}

# 交互式菜单
show_menu() {
    # 菜单选项
    local options=(
        "查看服务状态"
        "启动服务"
        "停止服务"
        "重启服务"
        "更新"
        "重新安装"
        "重装依赖"
        "重新编译"
        "查看日志"
        "退出"
    )
    
    local selected=0
    local total=${#options[@]}
    
    # 打印菜单
    print_menu() {
        clear
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}       VoiceHub 管理面板${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo ""
        
        for i in "${!options[@]}"; do
            if [[ $i -eq $selected ]]; then
                echo -e "${GREEN}► ${options[$i]}${NC}"
            else
                echo -e "  ${options[$i]}"
            fi
        done
        
        echo ""
        echo -e "${YELLOW}使用 ↑↓ 选择，Enter 确认${NC}"
    }
    
    # 临时关闭 set -e，防止 read 超时或非零返回导致脚本退出
    set +e

    while true; do
        print_menu
        
        # 读取 1 个字符
        read -rsn1 key
        
        # 检查是否是转义序列 (方向键)
        if [[ "$key" == $'\x1b' ]]; then
            # 使用 || true 防止超时导致 set -e 触发（虽然已关闭，但保持习惯）
            read -rsn2 -t 0.01 chars || true
            key="$key$chars"
        fi

        case "$key" in
            $'\x1b[A'|$'\x1bOA'|k|K) # 上
                ((selected--))
                if [[ $selected -lt 0 ]]; then
                    selected=$((total - 1))
                fi
                ;;
            $'\x1b[B'|$'\x1bOB'|j|J) # 下
                ((selected++))
                if [[ $selected -ge $total ]]; then
                    selected=0
                fi
                ;;
            "") # Enter
                break
                ;;
        esac
    done
    
    # 恢复 set -e
    set -e
    
    echo ""
    
    # 执行选择的操作
    case $selected in
        0)
            cmd_status
            ;;
        1)
            cmd_start
            ;;
        2)
            cmd_stop
            ;;
        3)
            cmd_restart
            ;;
        4)
            cmd_update
            ;;
        5)
            cmd_reinstall
            ;;
        6)
            cmd_deps
            ;;
        7)
            cmd_build
            ;;
        8)
            cmd_logs
            ;;
        9)
            echo -e "${CYAN}退出${NC}"
            exit 0
            ;;
    esac
}

# 检查是否有交互式终端
if [[ ! -t 0 ]]; then
    # 非交互模式，显示帮助
    echo -e "${BLUE}VoiceHub 管理脚本${NC}"
    echo ""
    echo "用法: voicehub"
    echo ""
    echo "运行脚本后使用上下键选择操作"
    echo ""
    echo "或在非交互环境中使用以下命令："
    echo "  bash $0 status    # 查看状态"
    echo "  bash $0 start    # 启动服务"
    echo "  bash $0 stop     # 停止服务"
    echo "  bash $0 restart  # 重启服务"
    echo "  bash $0 update   # 更新代码"
    echo "  bash $0 reinstall # 重新安装"
    echo "  bash $0 deps     # 重装依赖"
    echo "  bash $0 build    # 重新编译"
    echo "  bash $0 logs     # 查看日志"
    exit 0
fi

# 如果有参数，直接执行对应命令
if [[ -n "$1" ]]; then
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
            echo -e "${BLUE}VoiceHub 管理脚本${NC}"
            echo ""
            echo "用法: voicehub"
            echo ""
            echo "直接运行脚本可使用交互式菜单（上下键选择）"
            echo ""
            echo "或使用以下命令："
            echo "  voicehub status     # 查看状态"
            echo "  voicehub start      # 启动服务"
            echo "  voicehub stop       # 停止服务"
            echo "  voicehub restart    # 重启服务"
            echo "  voicehub update     # 更新代码"
            echo "  voicehub reinstall  # 重新安装"
            echo "  voicehub deps       # 重装依赖"
            echo "  voicehub build      # 重新编译"
            echo "  voicehub logs       # 查看日志"
            ;;
        *)
            echo -e "${RED}未知命令: $1${NC}"
            exit 1
            ;;
    esac
else
    # 无参数，显示交互式菜单
    show_menu
fi
