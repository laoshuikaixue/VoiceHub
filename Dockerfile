# 使用官方Node.js运行时作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 安装依赖，增加详细错误日志和更多重试机制
RUN echo "Node version:" && node --version && \
    echo "NPM version:" && npm --version && \
    echo "Current directory contents:" && ls -la && \
    echo "Checking npm config:" && npm config list && \
    echo "Installing dependencies with npm ci..." && \
    (npm ci --only=production --prefer-offline --no-audit 2>&1 | tee npm-install.log) || \
    (echo "npm ci failed, showing log:" && cat npm-install.log && \
     echo "Trying npm install..." && \
     npm install --only=production --prefer-offline --no-audit 2>&1 | tee npm-install.log) || \
    (echo "npm install failed, showing log:" && cat npm-install.log && \
     echo "Trying npm install with unsafe-perm..." && \
     npm install --only=production --prefer-offline --no-audit --unsafe-perm 2>&1 | tee npm-install.log) || \
    (echo "All npm install methods failed, showing detailed log:" && \
     echo "=== NPM DEBUG INFO ===" && \
     echo "Node version:" && node --version && \
     echo "NPM version:" && npm --version && \
     echo "NPM config:" && npm config list && \
     echo "Directory contents:" && ls -la && \
     echo "=== NPM INSTALL LOG ===" && cat npm-install.log && \
     echo "=== END OF LOGS ===" && false)

# 复制应用代码
COPY . .

# 设置环境变量
ENV NODE_ENV=production

# 生成Prisma客户端，增加详细错误日志
RUN echo "Generating Prisma client..." && \
    (npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tee prisma-generate.log) || \
    (echo "Prisma generate failed, showing log:" && cat prisma-generate.log && \
     echo "Trying Prisma generate with force..." && \
     npx prisma generate --schema=./prisma/schema.prisma --force 2>&1 | tee prisma-generate.log) || \
    (echo "Prisma generate still failed, showing log:" && cat prisma-generate.log && \
     echo "Installing prisma and @prisma/client..." && \
     npm install prisma @prisma/client && \
     echo "Trying Prisma generate after reinstall..." && \
     npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tee prisma-generate.log) || \
    (echo "All Prisma generate methods failed, showing detailed log:" && \
     echo "=== PRISMA DEBUG INFO ===" && \
     echo "Prisma version:" && npx prisma --version && \
     echo "Schema file contents:" && cat ./prisma/schema.prisma && \
     echo "=== PRISMA GENERATE LOG ===" && cat prisma-generate.log && \
     echo "=== END OF LOGS ===" && false)

# 构建应用
RUN echo "Building application..." && \
    (npm run build 2>&1 | tee build.log) || \
    (echo "Build failed, showing log:" && cat build.log && \
     echo "Trying build with unsafe-perm..." && \
     npm run build --unsafe-perm 2>&1 | tee build.log) || \
    (echo "Build still failed, showing detailed log:" && \
     echo "=== BUILD DEBUG INFO ===" && \
     echo "Node version:" && node --version && \
     echo "NPM version:" && npm --version && \
     echo "Directory contents:" && ls -la && \
     echo "=== BUILD LOG ===" && cat build.log && \
     echo "=== END OF LOGS ===" && false)

# 暴露端口
EXPOSE 3000

# 创建非root用户并设置目录权限
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    # 关键修复：将应用目录所有权赋予nextjs用户和nodejs组
    chown -R nextjs:nodejs /app && \
    # 确保需要写入的目录有适当权限
    chmod -R 755 /app

# 切换到非root用户
USER nextjs

# 启动应用
CMD ["sh", "-c", "node scripts/deploy.js && npm run dev"]
