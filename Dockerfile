# 使用官方Node.js运行时作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

COPY package*.json ./

# 安装依赖
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

COPY . .

ENV NODE_ENV=production \
    ENABLE_IDLE_MODE=false \
    NODE_OPTIONS="--experimental-specifier-resolution=node"

RUN echo "Checking Drizzle configuration..." && \
    echo "Directory contents:" && ls -la && \
    echo "Checking drizzle directory..." && \
    if [ -d "drizzle" ]; then \
        echo "Drizzle directory exists, listing contents:" && \
        ls -la drizzle/ && \
        echo "Drizzle configuration check passed."; \
    else \
        echo "Drizzle directory not found, creating it..." && \
        mkdir -p drizzle && \
        echo "Drizzle directory created."; \
    fi && \
    echo "Checking drizzle.config.ts..." && \
    if [ -f "drizzle.config.ts" ]; then \
        echo "drizzle.config.ts exists."; \
    else \
        echo "ERROR: drizzle.config.ts not found!" && \
        false; \
    fi && \
    echo "Verifying dotenv installation..." && \
    if [ -d "node_modules/dotenv" ]; then \
        echo "dotenv installed successfully." && \
        npm list dotenv; \
    else \
        echo "WARNING: dotenv not found in node_modules, but may be available through other packages." && \
        npm list | grep dotenv || echo "No dotenv packages found."; \
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
