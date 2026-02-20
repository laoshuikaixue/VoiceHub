#!/bin/bash

# 确保以 bash 运行
if [ -z "$BASH_VERSION" ]; then
    exec bash "$0" "$@"
fi

# VoiceHub 一键部署脚本
# 支持 Ubuntu/Debian 系统

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
REPO_URL="https://github.com/laoshuikaixue/VoiceHub.git"
PROJECT_DIR="/opt/voicehub"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}       VoiceHub 一键部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 步骤 1: 检查系统是否为 Ubuntu 或 Debian
# ============================================
echo -e "${YELLOW}[1/9] 检查系统类型...${NC}"

if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}错误: 无法检测操作系统${NC}"
    exit 1
fi

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    echo -e "${RED}错误: 此脚本仅支持 Ubuntu 或 Debian 系统${NC}"
    echo -e "${RED}当前系统: $OS $VER${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 检测到系统: $OS $VER${NC}"
echo ""
echo -e "${BLUE}安装目录: $PROJECT_DIR${NC}"
echo ""

# ============================================
# 步骤 2: 检查并安装 Node.js 22+
# ============================================
echo -e "${YELLOW}[2/9] 检查 Node.js 版本...${NC}"

# 检查是否已安装 node
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    echo -e "当前 Node.js 版本: $(node -v)"
    
    if [[ $NODE_VERSION -ge 22 ]]; then
        echo -e "${GREEN}✓ Node.js 版本满足要求 (>= 22)${NC}"
    else
        echo -e "${YELLOW}! Node.js 版本过低，需要升级到 22+${NC}"
        NODE_NEED_INSTALL=true
    fi
else
    echo -e "${YELLOW}未检测到 Node.js，需要安装${NC}"
    NODE_NEED_INSTALL=true
fi

if [[ "$NODE_NEED_INSTALL" == "true" ]]; then
    echo -e "${YELLOW}正在安装 Node.js 22...${NC}"
    
    # 安装 NodeSource Node.js 22.x
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    
    # 安装 Node.js
    sudo apt-get install -y nodejs
    
    echo -e "${GREEN}✓ Node.js 安装完成: $(node -v)${NC}"
fi

echo ""

# ============================================
# 步骤 3: 询问是否切换 npm 国内源
# ============================================
echo -e "${YELLOW}[3/9] npm 镜像源配置${NC}"
echo -e "是否需要将 npm 切换为国内淘宝源？"
echo -e "${BLUE}  y - 使用淘宝镜像 (https://registry.npmmirror.com)${NC}"
echo -e "${BLUE}  n - 使用官方源 (https://registry.npmjs.org)${NC}"
read -p "请选择 (y/n): " USE_TAOBAO

if [[ "$USE_TAOBAO" == "y" || "$USE_TAOBAO" == "Y" ]]; then
    npm config set registry https://registry.npmmirror.com
    echo -e "${GREEN}✓ 已切换为淘宝镜像源${NC}"
else
    npm config set registry https://registry.npmjs.org
    echo -e "${GREEN}✓ 已使用官方 npm 源${NC}"
fi

echo ""

# ============================================
# 步骤 4: Git Clone 项目
# ============================================
echo -e "${YELLOW}[4/9] 克隆项目...${NC}"

if [[ -d "$PROJECT_DIR" ]]; then
    echo -e "${YELLOW}项目目录已存在: $PROJECT_DIR${NC}"
    read -p "是否更新现有项目? (y/n): " UPDATE_PROJECT
    if [[ "$UPDATE_PROJECT" == "y" || "$UPDATE_PROJECT" == "Y" ]]; then
        cd "$PROJECT_DIR"
        git fetch origin main
        git stash
        git reset --hard origin/main
        echo -e "${GREEN}✓ 项目已更新${NC}"
    fi
else
    sudo mkdir -p "$PROJECT_DIR"
    sudo chown -R $(whoami) "$PROJECT_DIR"
    
    echo -e "正在克隆项目到: $PROJECT_DIR"
    git clone "$REPO_URL" "$PROJECT_DIR"
    echo -e "${GREEN}✓ 项目克隆完成${NC}"
fi

# [开发调试] 如果远程仓库还没合并 sh 目录，尝试从本地拷贝
if [[ ! -d "$PROJECT_DIR/sh" ]]; then
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    if [[ -f "$SCRIPT_DIR/main.sh" ]]; then
        echo -e "${YELLOW}提示: 正在从本地拷贝 sh 脚本到项目目录...${NC}"
        mkdir -p "$PROJECT_DIR/sh"
        cp "$SCRIPT_DIR/"*.sh "$PROJECT_DIR/sh/"
    fi
fi

cd "$PROJECT_DIR"
echo ""

# ============================================
# 步骤 5: 配置 .env 文件
# ============================================
echo -e "${YELLOW}[5/9] 配置环境变量...${NC}"

if [[ -f "$PROJECT_DIR/.env" ]]; then
    read -p ".env 文件已存在，是否重新配置? (y/n): " REBUILD_ENV
    if [[ "$REBUILD_ENV" != "y" && "$REBUILD_ENV" != "Y" ]]; then
        echo -e "${GREEN}✓ 使用现有的 .env 配置${NC}"
        echo ""
    else
        NEED_CONFIG=true
    fi
else
    NEED_CONFIG=true
fi

if [[ "$NEED_CONFIG" == "true" ]]; then
    echo -e "${YELLOW}请根据 .env.example 配置以下环境变量:${NC}"
    echo ""
    
    # 读取 .env.example 获取必填字段
    if [[ -f "$PROJECT_DIR/.env.example" ]]; then
        echo -e "${BLUE}===== .env.example 参考 =====${NC}"
        cat "$PROJECT_DIR/.env.example"
        echo -e "${BLUE}==============================${NC}"
        echo ""
    fi
    
    # 创建 .env 文件
    echo "# VoiceHub 环境配置" > "$PROJECT_DIR/.env"
    echo "" >> "$PROJECT_DIR/.env"
    
    # DATABASE_URL (必填)
    read -p "请输入 DATABASE_URL (数据库连接地址): " DATABASE_URL
    while [[ -z "$DATABASE_URL" ]]; do
        echo -e "${RED}DATABASE_URL 是必填项，不能为空${NC}"
        read -p "请输入 DATABASE_URL: " DATABASE_URL
    done
    echo "DATABASE_URL=\"$DATABASE_URL\"" >> "$PROJECT_DIR/.env"
    
    # JWT_SECRET (必填)
    read -p "请输入 JWT_SECRET (JWT密钥，建议至少32位字符): " JWT_SECRET
    while [[ -z "$JWT_SECRET" ]]; do
        echo -e "${RED}JWT_SECRET 是必填项，不能为空${NC}"
        read -p "请输入 JWT_SECRET: " JWT_SECRET
    done
    echo "JWT_SECRET=\"$JWT_SECRET\"" >> "$PROJECT_DIR/.env"
    
    # NODE_ENV
    read -p "请输入 NODE_ENV (development/production，默认 production): " NODE_ENV
    NODE_ENV=${NODE_ENV:-production}
    echo "NODE_ENV=\"$NODE_ENV\"" >> "$PROJECT_DIR/.env"
    
    echo "" >> "$PROJECT_DIR/.env"
    echo "# WebAuthn 配置 (可选)" >> "$PROJECT_DIR/.env"
    
    # WEBAUTHN_RP_ID (可选)
    read -p "请输入 WEBAUTHN_RP_ID (WebAuthn依赖方ID，可直接回车跳过): " WEBAUTHN_RP_ID
    if [[ -n "$WEBAUTHN_RP_ID" ]]; then  
        echo "WEBAUTHN_RP_ID=\"$WEBAUTHN_RP_ID\"" >> "$PROJECT_DIR/.env"  
    fi
    
    # WEBAUTHN_ORIGIN (可选)
    read -p "请输入 WEBAUTHN_ORIGIN (允许的Origin列表，可直接回车跳过): " WEBAUTHN_ORIGIN
    if [[ -n "$WEBAUTHN_ORIGIN" ]]; then
        echo "WEBAUTHN_ORIGIN=\"$WEBAUTHN_ORIGIN\"" >> "$PROJECT_DIR/.env"
    fi
    
    echo "" >> "$PROJECT_DIR/.env"
    echo "# OAuth 配置 (可选)" >> "$PROJECT_DIR/.env"
    
    # OAUTH_REDIRECT_URI (可选)
    read -p "请输入 OAUTH_REDIRECT_URI (OAuth回调地址，可直接回车跳过): " OAUTH_REDIRECT_URI
    if [[ -n "$OAUTH_REDIRECT_URI" ]]; then
        echo "OAUTH_REDIRECT_URI=\"$OAUTH_REDIRECT_URI\"" >> "$PROJECT_DIR/.env"
    fi
    
    # OAUTH_STATE_SECRET (可选)
    read -p "请输入 OAUTH_STATE_SECRET (OAuth state加密密钥，可直接回车跳过): " OAUTH_STATE_SECRET
    if [[ -n "$OAUTH_STATE_SECRET" ]]; then
        echo "OAUTH_STATE_SECRET=\"$OAUTH_STATE_SECRET\"" >> "$PROJECT_DIR/.env"
    fi
    
    # GitHub OAuth (可选)
    read -p "请输入 GITHUB_CLIENT_ID (GitHub OAuth Client ID，可直接回车跳过): " GITHUB_CLIENT_ID
    if [[ -n "$GITHUB_CLIENT_ID" ]]; then
        echo "GITHUB_CLIENT_ID=\"$GITHUB_CLIENT_ID\"" >> "$PROJECT_DIR/.env"
    fi
    read -p "请输入 GITHUB_CLIENT_SECRET (GitHub OAuth Client Secret，可直接回车跳过): " GITHUB_CLIENT_SECRET
    if [[ -n "$GITHUB_CLIENT_SECRET" ]]; then
        echo "GITHUB_CLIENT_SECRET=\"$GITHUB_CLIENT_SECRET\"" >> "$PROJECT_DIR/.env"
    fi
    
    # Google OAuth (可选)
    read -p "请输入 GOOGLE_CLIENT_ID (Google OAuth Client ID，可直接回车跳过): " GOOGLE_CLIENT_ID
    if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
        echo "GOOGLE_CLIENT_ID=\"$GOOGLE_CLIENT_ID\"" >> "$PROJECT_DIR/.env"
    fi
    read -p "请输入 GOOGLE_CLIENT_SECRET (Google OAuth Client Secret，可直接回车跳过): " GOOGLE_CLIENT_SECRET
    if [[ -n "$GOOGLE_CLIENT_SECRET" ]]; then
        echo "GOOGLE_CLIENT_SECRET=\"$GOOGLE_CLIENT_SECRET\"" >> "$PROJECT_DIR/.env"
    fi
    
    # Redis (可选)
    read -p "请输入 REDIS_URL (Redis连接地址，可直接回车跳过): " REDIS_URL
    if [[ -n "$REDIS_URL" ]]; then
        echo "REDIS_URL=\"$REDIS_URL\"" >> "$PROJECT_DIR/.env"
    fi
    
    echo -e "${GREEN}✓ .env 文件配置完成${NC}"
fi

echo ""

# ============================================
# 步骤 6: npm install
# ============================================
echo -e "${YELLOW}[6/9] 安装项目依赖...${NC}"
echo -e "执行: npm install"
echo ""

cd "$PROJECT_DIR"
npm install

echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# ============================================
# 步骤 7: 部署 (数据库迁移 + 构建)
# ============================================
echo -e "${YELLOW}[7/9] 执行部署脚本...${NC}"
echo -e "执行: npm run deploy"
echo ""

# 尝试执行 npm run deploy (包含数据库迁移、管理员创建、构建)
if npm run deploy; then
    echo -e "${GREEN}✓ 部署脚本执行成功${NC}"
else
    echo -e "${RED}部署脚本执行失败，尝试仅执行构建...${NC}"
    echo -e "${YELLOW}注意: 数据库迁移可能未完成，请检查日志${NC}"
    npm run build
fi

echo -e "${GREEN}✓ 项目准备完成${NC}"
echo ""

# ============================================
# 步骤 8: 配置服务管理 (pm2 或 systemctl)
# ============================================
echo -e "${YELLOW}配置服务管理...${NC}"
echo ""
echo -e "请选择服务管理方式:"
echo -e "${BLUE}  1 - 使用 pm2 管理 (推荐)${NC}"
echo -e "${BLUE}  2 - 使用 systemctl 管理${NC}"
echo -e "${BLUE}  3 - 不配置，自行管理${NC}"
read -p "请选择 (1/2/3): " SERVICE_CHOICE

if [[ "$SERVICE_CHOICE" == "1" ]]; then
    # PM2 管理
    echo -e "${YELLOW}正在配置 PM2...${NC}"
    
    # 检查并安装 pm2
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}正在安装 PM2...${NC}"
        sudo npm install -g pm2
        echo -e "${GREEN}✓ PM2 安装完成${NC}"
    else
        echo -e "${GREEN}✓ PM2 已安装${NC}"
    fi
    
    # 创建日志目录
    mkdir -p "$PROJECT_DIR/logs"
    
    # 生成 ecosystem.config.cjs
    echo -e "${YELLOW}正在生成 ecosystem.config.cjs...${NC}"
    cat > "$PROJECT_DIR/ecosystem.config.cjs" << EOF
module.exports = {
  apps: [{
    name: 'voicehub',
    script: '.output/server/index.mjs',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: 'logs/voicehub-error.log',
    out_file: 'logs/voicehub-out.log'
  }]
}
EOF

    # 启动服务
    cd "$PROJECT_DIR"
    echo -e "${YELLOW}正在启动 VoiceHub 服务...${NC}"
    pm2 start ecosystem.config.cjs
    pm2 save
    echo -e "${YELLOW}正在设置 PM2 开机自起...${NC}"
    PM2_CMD=$(pm2 startup 2>&1 | grep -E '^sudo ' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'); [ -n "$PM2_CMD" ] && eval "$PM2_CMD" && pm2 save || echo "Failed to setup PM2 startup"
    echo -e "${GREEN}✓ PM2 已开机自起${NC}"

    echo -e "${GREEN}✓ PM2 配置完成${NC}"
    echo ""
    echo -e "${GREEN}✓ VoiceHub 服务已启动${NC}"
    echo ""
    echo -e "${BLUE}常用命令:${NC}"
    echo -e "  pm2 status        - 查看状态"
    echo -e "  pm2 logs voicehub - 查看日志"
    echo -e "  pm2 restart voicehub - 重启服务"
    echo -e "  pm2 stop voicehub    - 停止服务"

elif [[ "$SERVICE_CHOICE" == "2" ]]; then
    # Systemctl 管理
    echo -e "${YELLOW}正在配置 systemctl...${NC}"
    
    # 动态获取 node 路径
    NODE_PATH=$(which node)
    if [[ -z "$NODE_PATH" ]]; then
        echo -e "${RED}错误: 无法找到 node 可执行文件${NC}"
        exit 1
    fi
    echo -e "${BLUE}Node 路径: $NODE_PATH${NC}"
    
    # 创建 systemd 服务文件
    CURRENT_USER=$(whoami)
    sudo tee /etc/systemd/system/voicehub.service > /dev/null << EOF
[Unit]
Description=VoiceHub - 校园广播站点歌系统
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
ExecStart=$NODE_PATH $PROJECT_DIR/.output/server/index.mjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # 修改项目目录权限
    echo -e "${BLUE}正在设置项目目录权限...${NC}"
    # 使用 find 分别设置目录和文件的权限
    # 目录设置为 755 (rwxr-xr-x) - 所有用户可读可进入
    sudo find "$PROJECT_DIR" -type d -exec chmod 755 {} +
    # 文件设置为 644 (rw-r--r--) - 所有用户可读
    sudo find "$PROJECT_DIR" -type f -exec chmod 644 {} +
    
    # 重新加载 systemd
    sudo systemctl daemon-reload
    
    # 启动服务
    sudo systemctl start voicehub
    sudo systemctl enable voicehub
    
    echo -e "${GREEN}✓ systemctl 配置完成${NC}"
    echo ""
    echo -e "${GREEN}✓ VoiceHub 服务已启动${NC}"
    echo ""
    echo -e "${BLUE}常用命令:${NC}"
    echo -e "  sudo systemctl status voicehub - 查看状态"
    echo -e "  sudo journalctl -u voicehub -f   - 查看日志"
    echo -e "  sudo systemctl restart voicehub - 重启服务"
    echo -e "  sudo systemctl stop voicehub    - 停止服务"
else
    echo -e "${YELLOW}跳过服务配置${NC}"
fi

echo ""

# ============================================
# 步骤 9: 安装 voicehub 命令快捷方式
# ============================================
echo -e "${YELLOW}配置 voicehub 命令快捷方式...${NC}"
echo ""

chmod +x "$PROJECT_DIR/sh/main.sh"
chmod +x "$PROJECT_DIR/sh/update.sh"

# 创建 /usr/local/bin/voicehub 软链接
echo -e "${BLUE}是否安装 voicehub 命令到系统？(输入 y 安装)${NC}"
read -p "请选择 (y/n): " INSTALL_CMD

if [[ "$INSTALL_CMD" == "y" || "$INSTALL_CMD" == "Y" ]]; then
    # 创建软链接
    sudo ln -sf "$PROJECT_DIR/sh/main.sh" /usr/local/bin/voicehub
    echo -e "${GREEN}✓ voicehub 命令已安装${NC}"
    echo ""
    echo -e "${BLUE}现在可以使用以下命令管理 VoiceHub:${NC}"
    echo -e "  voicehub status    # 查看状态"
    echo -e "  voicehub start    # 启动服务"
    echo -e "  voicehub stop     # 停止服务"
    echo -e "  voicehub restart  # 重启服务"
    echo -e "  voicehub update   # 更新代码"
    echo -e "  voicehub reinstall # 重新安装"
    echo -e "  voicehub logs     # 查看日志"
    echo -e "  voicehub help     # 查看帮助"
else
    echo -e "${YELLOW}跳过命令安装${NC}"
    echo -e "${BLUE}如需手动使用，可运行:${NC}"
    echo -e "  bash $PROJECT_DIR/voicehub.sh status"
    echo -e "  bash $PROJECT_DIR/voicehub.sh restart"
    echo -e "  ..."
fi

echo ""

# ============================================
# 部署完成
# ============================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}       部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}项目目录: $PROJECT_DIR${NC}"
echo ""

if [[ "$SERVICE_CHOICE" == "1" ]]; then
    echo -e "${BLUE}服务管理: PM2${NC}"
    echo -e "${YELLOW}常用命令:${NC}"
    echo -e "  pm2 status        - 查看状态"
    echo -e "  pm2 logs voicehub - 查看日志"
    echo -e "  pm2 restart voicehub - 重启服务"
    echo -e "  pm2 stop voicehub    - 停止服务"
elif [[ "$SERVICE_CHOICE" == "2" ]]; then
    echo -e "${BLUE}服务管理: systemd${NC}"
    echo -e "${YELLOW}常用命令:${NC}"
    echo -e "  sudo systemctl status voicehub - 查看状态"
    echo -e "  sudo journalctl -u voicehub -f   - 查看日志"
    echo -e "  sudo systemctl restart voicehub  - 重启服务"
    echo -e "  sudo systemctl stop voicehub     - 停止服务"
else
    echo -e "${BLUE}启动命令: npm run dev (开发) 或 npm run start (生产)${NC}"
fi

echo ""
