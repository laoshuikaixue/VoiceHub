# 支持: linux/amd64, linux/arm64, linux/arm/v7

# 默认使用 node:24-alpine (amd64/arm64)
ARG BASE_IMAGE=node:24-alpine

# ==========================================
# 第一阶段：构建阶段
# ==========================================
FROM ${BASE_IMAGE} AS builder

WORKDIR /app

# 复制依赖文件和 scripts 目录
COPY package*.json ./
COPY scripts ./scripts

# 安装所有依赖
RUN npm ci || npm install

# 复制所有源代码
COPY . .

# 构建应用
RUN npm run build

# ==========================================
# 第二阶段：运行阶段
# ==========================================
# 预定义各架构的运行时镜像
FROM node:24-alpine AS runtime-amd64
FROM node:24-alpine AS runtime-arm64
FROM arm32v7/node:22-alpine AS runtime-armv7

# 根据 TARGETARCH 选择对应的运行时镜像
# arm64 和 amd64 使用 node:24-alpine
# arm/v7 使用 arm32v7/node:22-alpine
FROM runtime-${TARGETARCH} AS runtime

USER root
WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/app/drizzle ./app/drizzle
COPY --from=builder /app/scripts ./scripts

# 环境变量配置
ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# 暴露端口
EXPOSE 3000

# 启动命令：先执行数据库迁移，再启动应用
CMD ["sh", "-c", "node scripts/deploy.js && node .output/server/index.mjs"]
