# 构建阶段
FROM --platform=$BUILDPLATFORM node:26-alpine AS builder

WORKDIR /app

# 依赖安装阶段只复制 postinstall 所需脚本，避免其他脚本变更使依赖缓存失效
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/postinstall.js ./scripts/postinstall.js
# 设置npmmirror镜像源，加速国内和国际下载
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    set -eux; \
    export CI=true; \
    npm install -g pnpm@latest-10; \
    pnpm config set store-dir /pnpm/store; \
    pnpm install --frozen-lockfile

# 复制所有源代码并构建
COPY . .
RUN pnpm run build

# 运行阶段
FROM node:26-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/postinstall.js ./scripts/postinstall.js
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    set -eux; \
    export CI=true; \
    npm install -g pnpm@latest-10; \
    pnpm config set store-dir /pnpm/store; \
    pnpm install --prod --frozen-lockfile

# 从构建阶段复制必要文件
COPY --from=builder /app/drizzle.config.ts /app/.output /app/app/drizzle /app/scripts ./

# 环境变量配置
ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PREBUILT=true

# 暴露端口
EXPOSE $PORT

# 启动命令：先执行数据库迁移，再启动应用
CMD ["sh", "-c", "node scripts/deploy.js && node .output/server/index.mjs"]
