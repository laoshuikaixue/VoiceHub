#!/bin/bash
set -euo pipefail

# ==================== 配置常量 ====================
COMPOSE_DIR="/opt/voicehub"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"

# 数据库固定账号库名（可自行修改）
PG_USER="user"
PG_DB_NAME="voicehub"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ==================== root 提权 ====================
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${YELLOW}当前非 root 用户，正在通过 sudo 提权执行...${NC}"
    exec sudo "$0" "$@"
fi

# ==================== 系统信息展示 ====================

# 输出系统名称
OS_NAME=$(grep -oP 'PRETTY_NAME="\K[^"]+' /etc/os-release)
echo -e "兼容性：操作系统：${GREEN}${OS_NAME}${NC}"

# 检查架构
valid_archs=("x86_64" "armv6l" "armv7l" "aarch64" "ppc64le" "s90x")
current_arch=$(uname -m)
found=false

for arch in "${valid_archs[@]}"; do
    if [ "$arch" = "$current_arch" ]; then
        found=true
        break
    fi
done

if $found; then
    echo -e "兼容性：系统架构：${GREEN}${current_arch}（符合要求）${NC}"
else
    echo -e "兼容性：系统架构：${RED}${current_arch}（不支持）${NC}，${RED}支持的架构：${valid_archs[*]}${NC}"
    exit 1
fi

# ==================== 检查依赖 ====================

# 检查 docker
if command -v docker &> /dev/null; then
    echo -e "依赖：docker：${GREEN}已安装${NC}"
else
    echo -e "依赖：docker：${RED}未安装，请先安装 Docker${NC}"
    exit 1
fi

# 检查 docker-compose / docker compose
DOCKER_COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
    echo -e "依赖：docker-compose：${GREEN}已安装${NC}"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
    echo -e "依赖：docker compose：${GREEN}已安装${NC}"
else
    echo -e "依赖：docker-compose：${RED}未安装${NC}"
    exit 1
fi

# ==================== 随机密钥生成逻辑：openssl优先，无则bash内置降级 ====================
gen_bash_random() {
    local length="$1"
    local charset='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    local str=""
    for ((i=0; i<length; i++)); do
        str+=${charset:$(( RANDOM % ${#charset} )):1}
    done
    echo "$str"
}

# 判定openssl可用性
if command -v openssl &> /dev/null; then
    echo -e "依赖：openssl：${GREEN}已安装${NC}"
    gen_openssl() {
        local LEN="$1"
        openssl rand -base64 $((LEN*2)) | tr -dc 'A-Za-z0-9' | head -c "$LEN"
        echo
    }
    JWT_SECRET=$(gen_openssl 64)
    PG_PASSWORD=$(gen_openssl 32)
else
    echo -e "${YELLOW}警告：未找到openssl，降级使用Bash内置RANDOM生成${NC}"
    JWT_SECRET=$(gen_bash_random 64)
    PG_PASSWORD=$(gen_bash_random 32)
fi

# ==================== 生成配置 ====================

# 创建工作目录
if [ ! -d "${COMPOSE_DIR}" ]; then
    echo -e "${YELLOW}未检测到工作目录，正在创建：${COMPOSE_DIR}${NC}"
    mkdir -p "${COMPOSE_DIR}"
    chmod 755 "${COMPOSE_DIR}"
else
    echo -e "环境：工作目录：${GREEN}已存在${NC}"
fi

# 生成 compose 文件模板
generate_compose_template() {
    cat > "${COMPOSE_FILE}" <<'EOF'
services:
  voicehub:
    image: ghcr.nju.edu.cn/laoshuikaixue/voicehub:latest
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://user:PG_PWD_PLACEHOLDER@postgres:5432/voicehub?sslmode=disable
      - JWT_SECRET=JWT_SECRET_PLACEHOLDER
      - NODE_ENV=production
      - SKIP_BUILD=true
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: ghcr.nju.edu.cn/laoshuikaixue/voicehub-postgres:latest
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=PG_PWD_PLACEHOLDER
      - POSTGRES_DB=voicehub
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U user -d voicehub']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
EOF
}

# 生成配置文件
generate_config() {
    echo -e "${YELLOW}正在生成全新配置文件...${NC}"
    generate_compose_template

    # sed 批量替换占位符
    sed -i "s|PG_PWD_PLACEHOLDER|${PG_PASSWORD}|g" "${COMPOSE_FILE}"
    sed -i "s|JWT_SECRET_PLACEHOLDER|${JWT_SECRET}|g" "${COMPOSE_FILE}"

    echo -e "环境：配置文件：${GREEN}已生成并填充密钥${NC}"
    echo -e "       JWT_SECRET：${BLUE}${JWT_SECRET}${NC}"
    echo -e "       数据库密码：${BLUE}${PG_PASSWORD}${NC}"
}

# ==================== 服务控制函数 ====================
start_service() {
    echo -e "\n${GREEN}=== 正在启动 VoiceHub 服务 ===${NC}"
    cd "${COMPOSE_DIR}" && ${DOCKER_COMPOSE_CMD} up -d
}

stop_service() {
    echo -e "\n${RED}=== 正在停止 VoiceHub 服务 ===${NC}"
    cd "${COMPOSE_DIR}" && ${DOCKER_COMPOSE_CMD} down
}

restart_service() {
    echo -e "\n${YELLOW}=== 正在重启 VoiceHub 服务 ===${NC}"
    cd "${COMPOSE_DIR}" && ${DOCKER_COMPOSE_CMD} restart
}

status_service() {
    echo -e "\n${BLUE}=== 当前服务状态 ===${NC}"
    cd "${COMPOSE_DIR}" && ${DOCKER_COMPOSE_CMD} ps
}

# ==================== 重新部署功能 ====================
redeploy_service() {
    echo -e "\n${RED}=================================================="
    echo -e "警告：即将执行【重新部署】"
    echo -e "==================================================${NC}"
    read -p "确定继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消重新部署${NC}"
        return
    fi

    # 1. 停止服务
    stop_service
    sleep 2

    # 2. 删除旧配置文件
    if [ -f "${COMPOSE_FILE}" ]; then
        echo -e "${YELLOW}删除旧 docker-compose.yml...${NC}"
        rm -f "${COMPOSE_FILE}"
    fi

    # 3. 删除数据库 volume
    echo -e "${YELLOW}删除数据库数据卷 voicehub_postgres_data...${NC}"
    docker volume rm voicehub_postgres_data 2>/dev/null || true

    # 4. 重新生成配置
    generate_config

    # 5. 启动服务
    start_service

    # 6. 等待容器启动完成
    echo -e "\n${YELLOW}等待容器启动完成（10秒）...${NC}"
    sleep 10

    # 7. 进入容器执行初始化命令
    echo -e "${GREEN}正在执行：进入 Voicehub...${NC}"
    echo -e "${YELLOW}可能需要一直按回车{NC}"
    cd "${COMPOSE_DIR}" && ${DOCKER_COMPOSE_CMD} exec voicehub pnpm run init-help

    echo -e "\n${GREEN}✅ 重新部署完成！${NC}"
    status_service
}

# ==================== 主菜单 ====================
show_menu() {
    echo -e "\n========================================"
    echo -e "           VoiceHub 管理菜单"
    echo -e "========================================"
    echo -e "  1. 启动服务"
    echo -e "  2. 停止服务"
    echo -e "  3. 重启服务"
    echo -e "  4. 查看服务状态"
    echo -e "  5. 重新部署"
    echo -e "  0. 退出脚本"
    echo -e "========================================"
    echo -n "请输入数字选择操作："
}

# 循环菜单
while true; do
    show_menu
    read -r choice
    case $choice in
        1) start_service ;;
        2) stop_service ;;
        3) restart_service ;;
        4) status_service ;;
        5) redeploy_service ;;
        0) echo -e "\n${GREEN}退出脚本${NC}"; exit 0 ;;
        *) echo -e "\n${RED}输入错误，请输入有效数字！${NC}" ;;
    esac
done
