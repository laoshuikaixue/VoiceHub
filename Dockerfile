# 使用官方Node.js运行时作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 安装依赖，增加错误处理和重试机制
RUN npm ci --only=production || \
    (echo "npm ci failed, trying npm install..." && npm install --only=production) || \
    (echo "npm install failed, trying with unsafe-perm..." && npm install --only=production --unsafe-perm)

# 复制应用代码
COPY . .

# 生成Prisma客户端，增加错误处理
RUN npx prisma generate || \
    (echo "Prisma generate failed, trying with force..." && npx prisma generate --force) || \
    (echo "Prisma generate still failed, installing prisma and trying again..." && \
     npm install prisma @prisma/client && npx prisma generate)

# 暴露端口
EXPOSE 3000

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# 启动应用
CMD ["npm", "run", "start"]