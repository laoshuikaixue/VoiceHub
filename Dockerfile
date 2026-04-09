# 支持: linux/amd64, linux/arm64, linux/arm/v7, linux/arm/v5, linux/ppc64le

# ==========================================
# 第一阶段：构建阶段
# ==========================================
# 预定义各架构的构建镜像
FROM node:24-alpine AS builder-amd64
FROM node:24-alpine AS builder-arm64
FROM snowdreamtech/node:22-alpine3.22 AS builder-armv7
# FROM snowdreamtech/node:22-alpine3.22 AS builder-s390x
FROM snowdreamtech/node:22-alpine3.22 AS builder-ppc64le
# FROM snowdreamtech/node:22-alpine3.22 AS builder-386
FROM snowdreamtech/node:22-alpine3.22 AS builder-armv5

# 根据 TARGETARCH 选择对应的构建镜像
FROM builder-${TARGETARCH} AS builder

WORKDIR /app

# 复制依赖文件和 scripts 目录
COPY package.json pnpm-lock.yaml ./
COPY scripts ./scripts

# 安装所有依赖
RUN set -eux; \
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
FROM snowdreamtech/node:22-alpine3.22 AS runtime-armv7
# FROM snowdreamtech/node:22-alpine3.22 AS runtime-s390x
FROM snowdreamtech/node:22-alpine3.22 AS runtime-ppc64le
# FROM snowdreamtech/node:22-alpine3.22 AS runtime-386
FROM snowdreamtech/node:22-alpine3.22 AS runtime-armv5

# 根据 TARGETARCH 选择对应的运行时镜像
FROM runtime-${TARGETARCH} AS runtime

USER root
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@10.29.3

# 从构建阶段复制必要文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/node_modules ./node_modules
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
