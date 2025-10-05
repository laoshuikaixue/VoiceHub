# 使用官方Node.js运行时作为基础镜像（锁定版本，避免兼容问题）
FROM node:20.19.5-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json（优先利用Docker缓存）
# 关键：确保package-lock.json被复制到容器内
COPY package*.json ./

# 安装依赖：优先用npm ci（依赖锁定文件），缺失时降级用npm install
RUN echo "Node version:" && node --version && \
    echo "NPM version:" && npm --version && \
    echo "Current directory contents (check lock file):" && ls -la && \
    echo "Checking npm config:" && npm config list && \
    # 检查package-lock.json是否存在，存在则用npm ci，否则用npm install
    if [ -f "package-lock.json" ]; then \
        echo "Found package-lock.json, using npm ci..." && \
        (npm ci --prefer-offline --no-audit --force 2>&1 | tee npm-install.log) || \
        (echo "npm ci failed, falling back to npm install..." && \
         npm install --prefer-offline --no-audit --force 2>&1 | tee npm-install.log); \
    else \
        echo "No package-lock.json found, using npm install..." && \
        npm install --prefer-offline --no-audit --force 2>&1 | tee npm-install.log; \
    fi || \
    # 最终降级：用unsafe-perm解决权限问题
    (echo "npm install failed, trying with unsafe-perm..." && \
     npm install --prefer-offline --no-audit --unsafe-perm --force 2>&1 | tee npm-install.log) || \
    (echo "All npm install methods failed, showing detailed log:" && \
     echo "=== NPM DEBUG INFO ===" && \
     echo "Node version:" && node --version && \
     echo "NPM version:" && npm --version && \
     echo "NPM config:" && npm config list && \
     echo "Directory contents:" && ls -la && \
     echo "=== NPM INSTALL LOG ===" && cat npm-install.log && \
     echo "=== END OF LOGS ===" && false)

# 后续步骤与之前优化版一致（复制代码、环境变量、Drizzle检查、构建、权限、启动）
COPY . .

ENV NODE_ENV=production \
    ENABLE_IDLE_MODE=false \
    NODE_OPTIONS="--experimental-specifier-resolution=node"

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
     echo "=== END OF LOGS ===" && false) && \
    # 验证dotenv是否安装成功
    echo "Verifying dotenv installation..." && \
    if [ ! -d "node_modules/dotenv" ]; then \
        echo "ERROR: dotenv not found in node_modules!" && \
        ls -la node_modules/ | grep dotenv && \
        npm list dotenv && \
        false; \
    else \
        echo "dotenv installed successfully."; \
        npm list dotenv; \
    fi

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

EXPOSE 3000

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app && \
    chmod -R 755 /app && \
    chmod -R 775 /app/drizzle /app/.output

USER nextjs

CMD ["sh", "-c", "npm run db:migrate && node --experimental-specifier-resolution=node scripts/deploy.js && npm run start"]