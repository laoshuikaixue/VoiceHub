# 第一阶段：构建阶段（使用完整的node镜像，含构建工具）
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent  # 安装所有依赖（含开发依赖，用于构建）
COPY . .
RUN npm run build    # 生成构建产物

# 第二阶段：运行阶段（仅保留运行所需文件）
FROM node:20-alpine
RUN addgroup -g 1001 -S nextjs && adduser -S nextjs -u 1001 -G nextjs -h /app -s /bin/bash
USER nextjs
WORKDIR /app

# 从构建阶段复制仅需的文件（排除node_modules、源代码等）
COPY --from=builder --chown=nextjs:nextjs /app/package*.json ./
COPY --from=builder --chown=nextjs:nextjs /app/node_modules ./node_modules  # 仅复制生产依赖（需在builder阶段执行npm ci --omit=dev）
COPY --from=builder --chown=nextjs:nextjs /app/.next ./next  # Next.js构建产物（根据实际产物目录调整）
COPY --from=builder --chown=nextjs:nextjs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nextjs /app/scripts ./scripts

# 后续环境变量、EXPOSE、CMD与原文件一致
ENV NODE_ENV=production ...
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && node scripts/deploy.js && npm run start"]
