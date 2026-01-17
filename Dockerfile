# 第一阶段：构建阶段
FROM node:25-alpine AS builder
WORKDIR /app

# 复制依赖文件和 scripts 目录
COPY package*.json ./
COPY scripts ./scripts

# 安装所有依赖（含开发依赖）
RUN npm install

# 复制源代码并构建应用
COPY . .
RUN npm run build

# 第二阶段：运行阶段
FROM node:25-alpine

# 切换到非root用户
USER root
WORKDIR /app

# 从构建阶段复制运行所需文件
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts

# 环境变量配置
ENV NODE_ENV=production \
    ENABLE_IDLE_MODE=false \
    NODE_OPTIONS="--experimental-specifier-resolution=node" \
    PORT=3000

# 暴露端口并设置启动命令
EXPOSE $PORT
CMD ["sh", "-c", "npm run setup && npm start"]
