#!/bin/bash
set -euo pipefail

# ==================== 配置常量 ====================
COMPOSE_DIR="/opt/voicehub"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"

# 数据库固定账号库名（可自行修改）
PG_USER="user"
PG_DB_NAME="voicehub"
GHCR_HOST="ghcr.nju.edu.cn"

# 镜像地址常量
VOICEHUB_IMAGE="ghcr.nju.edu.cn/laoshuikaixue/voicehub:latest"
POSTGRES_IMAGE="ghcr.nju.edu.cn/laoshuikaixue/voicehub-postgres:latest"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ==================== root 提权 ====================
if [ "$(id -u)" -ne 0 ]; then
    echo -e "权限：root 用户：${RED}非 root${NC}"
    exit 1
    # exec sudo "$0" "$@"
else
    echo -e "权限：root 用户：${GREEN}正常${NC}"
fi

# ==================== 系统信息展示 ====================
OS_NAME=$(grep -oP 'PRETTY_NAME="\K[^"]+' /etc/os-release)
echo -e "兼容性：操作系统：${GREEN}${OS_NAME}${NC}"

# 检查架构
valid_archs=("x86_64" "armv6l" "armv7l" "aarch64" "ppc64le" "s390x")
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
    PG_PASSWORD=$(gen_openssl 64)
else
    echo -e "${YELLOW}警告：未找到openssl，降级使用Bash内置RANDOM生成${NC}"
    JWT_SECRET=$(gen_bash_random 64)
    PG_PASSWORD=$(gen_bash_random 64)
fi

# ==================== 检查网络 ====================
echo -e "网络：${GHCR_HOST} ...${NC}"
if ping -c 4 -W 5 "${GHCR_HOST}" >/dev/null 2>&1; then
    echo -e "网络：${GHCR_HOST} ${GREEN}连通正常${NC}"
else
    echo -e "网络：${GHCR_HOST} ${RED}失败，网络无法连通该镜像仓库，退出执行${NC}"
    exit 1
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

# ==================== 检查/更新镜像函数（基于镜像ID对比） ====================
check_and_update_image() {
    local IMAGE_FULL="$1"
    local IMAGE_NAME="$2"

    # 1. 本地无镜像 → 直接拉取
    if [ -z "$(docker images -q "${IMAGE_FULL}")" ]; then
        echo -e "镜像版本：${YELLOW}${IMAGE_NAME}本地无镜像，开始拉取最新版${NC}"
        if docker pull "${IMAGE_FULL}"; then
            echo -e "镜像版本：${GREEN}${IMAGE_NAME}拉取成功${NC}"
            return 0
        else
            echo -e "镜像版本：${RED}${IMAGE_NAME}拉取失败${NC}"
            return 1
        fi
    fi

    # 2. 执行拉取并判断状态
    echo -e "镜像版本：${YELLOW}检测${IMAGE_NAME}更新状态${NC}"
    local PULL_OUTPUT
    PULL_OUTPUT=$(docker pull "${IMAGE_FULL}" 2>&1)
    if [ $? -ne 0 ]; then
        echo -e "镜像版本：${RED}${IMAGE_NAME}拉取失败：${PULL_OUTPUT}${NC}"
        return 1
    fi

    if echo "${PULL_OUTPUT}" | grep -q "Image is up to date"; then
        echo -e "镜像版本：${GREEN}${IMAGE_NAME}已是最新${NC}"
        return 0
    else
        echo -e "镜像版本：${YELLOW}${IMAGE_NAME}已更新至新版本${NC}"
        return 0
    fi
}

# ==================== 交互式初始化函数（仅重新部署使用） ====================
run_interactive_init() {
    echo -e "\n${BLUE}=== 进入交互式初始化环境 ===${NC}"
    echo -e "${YELLOW}提示：进入容器后执行可能需要按回车${NC}"

    cd "${COMPOSE_DIR}"
    # 临时启动容器进入bash，退出自动删除
    ${DOCKER_COMPOSE_CMD} run --rm voicehub pnpm run init-help
}

# ==================== 1.重新部署（清空数据卷 + 执行初始化） ====================
redeploy_service() {
    echo -e "\n${RED}=================================================="
    echo -e "警告：重新部署会清空所有数据库数据！"
    echo -e "==================================================${NC}"
    read -p "确定继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消重新部署${NC}"
        return
    fi

    # 停止服务
    echo -e "${YELLOW}停止旧的 voicehub (若有)${NC}"
    cd "${COMPOSE_DIR}" && ${DOCKER_COMPOSE_CMD} down 2>/dev/null || true
    sleep 2

    # 检查并更新两个镜像
    echo -e "\n${BLUE}=== 开始检查并更新镜像 ===${NC}"
    if ! check_and_update_image "${VOICEHUB_IMAGE}" "VoiceHub主程序"; then
        echo -e "${RED}镜像更新失败，终止重新部署${NC}"
        return 1
    fi
    if ! check_and_update_image "${POSTGRES_IMAGE}" "PostgreSQL数据库"; then
        echo -e "${RED}镜像更新失败，终止重新部署${NC}"
        return 1
    fi

    # 删除旧配置
    if [ -f "${COMPOSE_FILE}" ]; then
        echo -e "${YELLOW}删除旧 docker-compose.yml...${NC}"
        rm -f "${COMPOSE_FILE}"
    fi

    # 删除数据库数据卷（清空数据）
    echo -e "${YELLOW}删除数据库数据卷 voicehub_postgres_data...${NC}"
    docker volume rm voicehub_postgres_data 2>/dev/null || true

    # 生成新配置
    generate_config

    # 启动整套服务
    echo -e "\n${YELLOW}启动数据库服务...${NC}"
    start_service
    sleep 10

    # 执行交互式初始化
    run_interactive_init

    # 重启正式业务容器
    echo -e "\n${YELLOW}重启正式业务容器...${NC}"
    cd "${COMPOSE_DIR}" && ${DOCKER_COMPOSE_CMD} restart

    echo -e "\n${GREEN}✅ 重新部署完成（数据已清空，已执行初始化）${NC}"
    status_service
}

# ==================== 2.版本更新（保留原有数据卷，不执行初始化） ====================
update_version() {
    echo -e "\n${YELLOW}=================================================="
    echo -e "说明：版本更新【保留原有数据库数据，不执行初始化】"
    echo -e "==================================================${NC}"
    read -p "确定继续更新版本？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消版本更新${NC}"
        return
    fi

    # 停止服务（不删数据卷）
    echo -e "${YELLOW}停止当前服务${NC}"
    cd "${COMPOSE_DIR}" && ${DOCKER_COMPOSE_CMD} down 2>/dev/null || true
    sleep 2

    # 检查并更新镜像
    echo -e "\n${BLUE}=== 检查并拉取最新镜像 ===${NC}"
    if ! check_and_update_image "${VOICEHUB_IMAGE}" "VoiceHub主程序"; then
        echo -e "${RED}镜像更新失败，终止版本升级${NC}"
        return 1
    fi
    if ! check_and_update_image "${POSTGRES_IMAGE}" "PostgreSQL数据库"; then
        echo -e "${RED}镜像更新失败，终止版本升级${NC}"
        return 1
    fi

    # 直接启动服务，沿用旧数据、旧配置，跳过初始化
    echo -e "${YELLOW}使用现有配置与数据库，直接启动服务${NC}"
    start_service

    echo -e "\n${YELLOW}等待容器启动完成（10秒）...${NC}"
    sleep 10

    echo -e "\n${GREEN}✅ 版本更新完成（已保留原有数据库数据）${NC}"
    status_service
}

# ==================== 主菜单 ====================
show_menu() {
    echo -e "\n========================================"
    echo -e "           VoiceHub 管理菜单"
    echo -e "========================================"
    echo -e "  1. 重新部署（清空数据，全新安装+初始化）"
    echo -e "  2. 版本更新（保留旧数据，仅升级镜像）"
    echo -e "  3. 查看服务状态"
    echo -e "  0. 退出脚本"
    echo -e "========================================"
    echo -n "请输入数字选择操作："
}

# 循环菜单
while true; do
    show_menu
    read -r choice
    case $choice in
        1) redeploy_service ;;
        2) update_version ;;
        3) status_service ;;
        0) echo -e "\n${GREEN}退出脚本${NC}"; exit 0 ;;
        *) echo -e "\n${RED}输入错误，请输入有效数字！${NC}" ;;
    esac
done
