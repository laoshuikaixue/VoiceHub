# --- 阶段 1: 依赖安装 (专门用于缓存 node_modules) ---
FROM node:20-alpine AS deps
WORKDIR /app

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
RUN npm config set registry https://registry.npmmirror.com/

COPY package.json package-lock.json ./

RUN npm ci

# --- 阶段 2: 构建应用 ---
FROM node:20-alpine AS builder
WORKDIR /app

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN if [ ! -d "drizzle" ]; then \
      echo "Error: drizzle directory not found"; \
      exit 1; \
    fi

RUN npm run build

# --- 阶段 3: 生产环境 ---
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup -h /app
USER appuser

ENV NODE_ENV=production \
    ENABLE_IDLE_MODE=false \
    NODE_OPTIONS="--experimental-specifier-resolution=node"

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/.next ./.next
COPY --from=builder --chown=appuser:appgroup /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/drizzle ./drizzle
COPY --from=builder --chown=appuser:appgroup /app/scripts ./scripts

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && node scripts/deploy.js && npm run start"]
