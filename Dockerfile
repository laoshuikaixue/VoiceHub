# 使用官方Node.js运行时作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制package文件并安装依赖
COPY package*.json ./

# 复制scripts目录
COPY scripts/ ./scripts/

# 安装依赖
RUN npm ci --silent || npm install --silent

# 复制源代码
COPY . .

# 设置环境变量
ENV NODE_ENV=production \
    ENABLE_IDLE_MODE=false \
    NODE_OPTIONS="--experimental-specifier-resolution=node"

# Drizzle配置检查
RUN echo "Checking Drizzle configuration..." && \
    (ls -la drizzle/ 2>&1 | tee drizzle-check.log) || \
    (echo "Drizzle directory check failed, showing log:" && cat drizzle-check.log && \
     echo "Creating drizzle directory if needed..." && \
     mkdir -p drizzle 2>&1 | tee drizzle-check.log) || \
    (echo "Drizzle setup failed, showing detailed log:" && \
     echo "=== DRIZZLE DEBUG INFO ===" && \
     echo "Directory contents:" && ls -la && \
     echo "Drizzle config:" && cat drizzle.config.ts && \
     echo "=== DRIZZLE CHECK LOG ===" && cat drizzle-check.log && \
     echo "=== END OF LOGS ===" && false)

# 构建应用
RUN npm run build

# 创建用户和设置权限
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app && \
    chmod -R 755 /app

USER nextjs

EXPOSE 3000

# 启动命令 - 使用强制迁移避免交互式提示
CMD ["sh", "-c", "npm run force-migrate && npm run start"]
