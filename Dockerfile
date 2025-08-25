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

# 暴露端口
EXPOSE 3000

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# 启动应用
CMD ["npm", "run", "start"]