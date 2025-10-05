# 第一阶段：构建阶段
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖文件并安装所有依赖（含开发依赖）
COPY package*.json ./
RUN npm ci

# 复制源代码并构建应用
COPY . .
COPY scripts ./scripts
RUN npm run build

# 第二阶段：运行阶段
FROM node:20-alpine

# 创建非root用户和应用目录
RUN addgroup -g 1001 -S nextjs && \
    adduser -S nextjs -u 1001 -G nextjs -h /app -s /sbin/nologin && \
    mkdir -p /app && chown -R nextjs:nextjs /app

# 切换到非root用户
USER nextjs
WORKDIR /app

# 从构建阶段复制运行所需文件
COPY --from=builder --chown=nextjs:nextjs /app/package*.json ./
COPY --from=builder --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /app/.next ./.next  # 修正路径
COPY --from=builder --chown=nextjs:nextjs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nextjs /app/scripts ./scripts

# 环境变量配置（已修复语法错误）
ENV NODE_ENV=production \
    ENABLE_IDLE_MODE=false \
    NODE_OPTIONS="--experimental-specifier-resolution=node" \
    PORT=3000

# 暴露端口并设置启动命令
EXPOSE $PORT
CMD ["sh", "-c", "npm run db:migrate && node scripts/deploy.js && npm run start"]
