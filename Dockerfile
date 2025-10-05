# 第一阶段：构建阶段
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖文件和 scripts 目录 (解决之前 postinstall 的问题)
COPY package*.json ./
COPY scripts ./scripts

# 安装所有依赖（含开发依赖）
RUN npm ci

# 复制源代码并构建应用
COPY . .
RUN npm run build

# 第二阶段：运行阶段
FROM node:20-alpine

# 创建非root用户和应用目录
RUN addgroup -g 1001 -S nuxtjs && \
    adduser -S nuxtjs -u 1001 -G nuxtjs -h /app -s /sbin/nologin && \
    mkdir -p /app && \
    chown -R nuxtjs:nuxtjs /app && \
    chmod -R 755 /app

# 切换到非root用户
USER nuxtjs
WORKDIR /app

# 从构建阶段复制运行所需文件
COPY --from=builder --chown=nuxtjs:nuxtjs /app/package*.json ./
COPY --from=builder --chown=nuxtjs:nuxtjs /app/node_modules ./node_modules
COPY --from=builder --chown=nuxtjs:nuxtjs /app/.output ./.output
COPY --from=builder --chown=nuxtjs:nuxtjs /app/drizzle ./drizzle
COPY --from=builder --chown=nuxtjs:nuxtjs /app/scripts ./scripts

# 环境变量配置
ENV NODE_ENV=production \
    ENABLE_IDLE_MODE=false \
    NODE_OPTIONS="--experimental-specifier-resolution=node" \
    PORT=3000

# 暴露端口并设置启动命令
EXPOSE $PORT
CMD ["sh", "-c", "npm run db:migrate && npm run deploy && npm run dev"]
