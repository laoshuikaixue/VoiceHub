# ==========================================
# 第一阶段：构建阶段
# ==========================================
# Nuxt/Vite 使用原生构建器。始终在 CI runner 的原生平台编译，避免 QEMU
# 执行 Rolldown 时崩溃；生成的 Nitro 输出不包含目标架构原生二进制。
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

WORKDIR /app

# 依赖安装阶段只复制 postinstall 所需脚本，避免其他脚本变更使依赖缓存失效
COPY package.json pnpm-lock.yaml ./
COPY scripts/postinstall.js ./scripts/postinstall.js

# 安装所有依赖
RUN set -eux; \
    export CI=true; \
    npm install -g pnpm@10.29.3; \
    pnpm config set fetch-retries 5; \
    pnpm config set fetch-retry-mintimeout 20000; \
    pnpm config set fetch-retry-maxtimeout 120000; \
    pnpm install --frozen-lockfile || ( \
      rm -rf node_modules; \
      pnpm install --no-frozen-lockfile || ( \
        pnpm config set registry https://registry.npmmirror.com; \
        pnpm install --no-frozen-lockfile \
      ) \
    )

# 复制所有源代码
COPY . .

# 构建应用
RUN pnpm run build

# ==========================================
# 第二阶段：运行阶段
# ==========================================
# 预定义各架构的运行时镜像
FROM node:24-alpine AS runtime-amd64
FROM node:24-alpine AS runtime-arm64
FROM node:20-alpine AS runtime-arm
FROM node:24-trixie-slim AS runtime-s390x
FROM node:24-trixie-slim AS runtime-ppc64le

# 根据 TARGETARCH 选择对应的运行时镜像
FROM runtime-${TARGETARCH} AS runtime

USER root
WORKDIR /app

# 运行依赖必须在目标平台安装，不能从构建平台复制 node_modules。
COPY package.json pnpm-lock.yaml ./
COPY scripts/postinstall.js ./scripts/postinstall.js
RUN set -eux; \
    export CI=true; \
    npm install -g pnpm@10.29.3; \
    pnpm config set fetch-retries 5; \
    pnpm config set fetch-retry-mintimeout 20000; \
    pnpm config set fetch-retry-maxtimeout 120000; \
    pnpm install --prod --frozen-lockfile

# 从构建阶段复制必要文件
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/app/drizzle ./app/drizzle
COPY --from=builder /app/scripts ./scripts

# 环境变量配置
ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PREBUILT=true

# 暴露端口
EXPOSE $PORT

# 启动命令：先执行数据库迁移，再启动应用
CMD ["sh", "-c", "node scripts/deploy.js && node .output/server/index.mjs"]
