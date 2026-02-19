# VoiceHub 升级指南

本文档介绍如何将 VoiceHub 项目从旧版本升级到最新版本。请根据您的部署方式选择相应的升级步骤。

> ⚠️ **升级前请务必备份数据库和配置文件！**

## 1. 备份数据

无论使用何种部署方式，升级前请先备份数据库。

### 1.1 使用管理后台备份（推荐）

1. 登录管理员后台
2. 进入"数据库管理"页面
3. 点击"创建备份" -> 选择"完整备份"
4. 待备份完成后，下载备份文件到本地保存

### 1.2 使用命令行备份

也可以使用 PostgreSQL 命令行工具：

```bash
# Docker 部署用户
docker exec voicehub-postgres-1 pg_dump -U user voicehub > backup_$(date +%Y%m%d).sql

# 源码部署用户
pg_dump -h localhost -U your_username -d voicehub > backup_$(date +%Y%m%d).sql
```

---

## 2. Docker 部署升级

### 2.1 使用 Docker Compose（推荐）

如果您使用 `docker-compose.yml` 部署：

1. **拉取最新代码**

   ```bash
   git pull
   ```

2. **拉取/构建最新镜像**

   ```bash
   # 如果使用预构建镜像
   docker-compose pull

   # 如果是本地构建
   docker-compose build --no-cache
   ```

3. **重启服务**

   ```bash
   # 这会自动应用数据库迁移
   docker-compose up -d
   ```

4. **验证升级**
   ```bash
   docker-compose logs -f voicehub
   ```
   查看日志确认没有报错，且显示 "部署完成"。

### 2.2 使用 Docker Run 命令

如果您直接使用 `docker run` 命令：

1. **停止并删除旧容器**

   ```bash
   docker stop voicehub
   docker rm voicehub
   ```

2. **拉取最新镜像**

   ```bash
   docker pull ghcr.io/laoshuikaixue/voicehub:latest
   # 或
   docker pull ghcr.nju.edu.cn/laoshuikaixue/voicehub:latest
   ```

3. **启动新容器**
   使用与之前相同的环境变量启动：
   ```bash
   docker run -d \
     -p 3000:3000 \
     -e DATABASE_URL="..." \
     -e JWT_SECRET="..." \
     --name voicehub \
     ghcr.io/laoshuikaixue/voicehub:latest
   ```

---

## 3. 源码/本地部署升级

### 3.1 停止运行中的服务

```bash
# 如果使用 PM2
pm2 stop voicehub

# 如果使用 systemd
sudo systemctl stop voicehub

# 如果直接运行（Ctrl+C 停止进程）
```

### 3.2 获取最新代码

```bash
# 拉取最新代码
git pull origin main

# 或指定分支
# git pull origin <branch-name>
```

### 3.3 更新依赖

```bash
# 安装最新依赖
npm install
```

### 3.4 数据库迁移

**重要**：新版本通常包含数据库结构变更，必须执行迁移。

```bash
# 方式 1：使用自动同步脚本（推荐）
node scripts/db-sync.js

# 方式 2：手动执行迁移
npm run db:migrate

# 方式 3：如果迁移失败，且确信可以覆盖（仅开发环境）
# npm run db:push
```

**迁移说明**：

- `db-sync.js` 脚本会自动检测数据库状态并选择合适的迁移方式
- 空数据库会执行完整迁移
- 已有数据的数据库会使用 push 方式同步结构

### 3.5 重新构建应用

```bash
# 清理旧的构建文件（可选）
rm -rf .nuxt .output

# 构建生产版本
npm run build
```

构建完成后，会在 `.output` 目录生成生产环境文件。

### 3.6 重启服务

根据您的部署方式选择：

#### 使用 PM2（推荐）

```bash
# 重启服务
pm2 restart voicehub

# 查看日志
pm2 logs voicehub

# 查看状态
pm2 status
```

如果是首次使用 PM2：

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start npm --name voicehub -- run start

# 设置开机自启
pm2 startup
pm2 save
```

#### 使用 systemd

```bash
# 重启服务
sudo systemctl restart voicehub

# 查看状态
sudo systemctl status voicehub

# 查看日志
sudo journalctl -u voicehub -f
```

#### 直接运行

```bash
# 生产模式启动
npm run start

# 或使用 nohup 后台运行
nohup npm run start > voicehub.log 2>&1 &
```
