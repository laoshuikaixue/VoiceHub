# 使用官方Node.js运行时作为基础镜像
FROM node:20-alpine

# 以root用户执行初始设置
# 创建应用目录并设置权限
RUN mkdir -p /app && chown -R root:root /app

# 安装必要的系统工具
RUN apk add --no-cache bash shadow

# 创建nextjs用户和组
RUN addgroup -g 1001 -S nextjs && \
    adduser -S nextjs -u 1001 -G nextjs -h /app -s /bin/bash

# 切换到nextjs用户
USER nextjs

# 设置工作目录
WORKDIR /app

# 复制package文件并安装依赖
COPY --chown=nextjs:nextjs package*.json ./

# 复制scripts目录
COPY --chown=nextjs:nextjs scripts/ ./scripts/

# 设置环境变量
ENV NODE_ENV=production \
    ENABLE_IDLE_MODE=false \
    NODE_OPTIONS="--experimental-specifier-resolution=node"

# 安装依赖
RUN npm ci --omit=dev --silent

# 复制源代码
COPY --chown=nextjs:nextjs . .

# 检查drizzle目录
RUN if [ ! -d "drizzle" ]; then \
      echo "Error: drizzle directory not found"; \
      exit 1; \
    fi

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["sh", "-c", "npm run db:migrate && node scripts/deploy.js && npm run start"]
