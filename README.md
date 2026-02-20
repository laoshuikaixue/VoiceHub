# VoiceHub - 校园广播站点歌系统

这是一个使用Nuxt 4全栈框架开发的现代化校园广播站点歌管理系统。系统提供完整的点歌、投票、排期管理、通知推送、数据分析、权限控制和数据库管理功能，支持多角色权限管理和灵活的系统配置。

## 项目截图

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/fef6970e-95eb-4cab-a11f-db4e71fc87b5" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/f76e912c-1263-424b-b379-72321de205f7" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/b5de5880-6635-4698-9fd9-dbea9642f06a" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/05472008-57d5-4586-b7ca-572bff8a30ae" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/c30f2e5a-4cc8-48cb-aca2-4d41daeaaaf8" />

## 主要功能

### 🎵 核心功能

- **智能点歌系统**：用户可以点歌或给已有歌曲投票，支持网易云音乐、QQ音乐和哔哩哔哩搜索，可选择期望播出时段
- **多平台登录支持**：
  - **网易云音乐登录**：支持扫码登录，登录后可搜索个人歌单、收藏及播客电台内容
    - **一键添加到歌单**：登录后支持将排期中的网易云音乐歌曲一键添加到个人歌单
    - **从歌单投稿**：支持从个人歌单中直接投稿歌曲到系统
    - **从最近播放投稿**：支持从最近播放记录中投稿歌曲
    - **播客电台投稿**：支持搜索和投稿播客电台内容
- **投稿限额管理**：灵活配置用户投稿限制，支持按时间段、用户角色设置不同的投稿额度，有效控制系统负载
- **歌曲去重功能**：智能识别重复歌曲，优化歌曲库管理，避免重复播放
- **歌曲管理**：按热度排序，避免重复播放，动态URL防止链接过期，支持黑名单管理
- **音乐播放器**：内置音乐播放器，支持进度控制和音质实时切换
- **音质切换**：支持多种音质选择（标准、HQ、无损、Hi-Res等），动态获取最新播放链接
- **音乐下载功能**：支持管理员下载歌曲到本地，提供多种音质选择和批量下载
- **歌曲重播功能**：支持用户对已播放过的歌曲发起重播申请，支持查看申请记录和撤回申请

### 👥 用户管理

- **用户管理**：管理员添加用户，支持按年级班级分类
- **权限控制**：多级权限管理，支持普通用户、管理员、超级管理员
- **黑名单管理**：支持歌曲和艺术家黑名单，自动过滤不当内容

### 📅 排期管理

- **排期管理**：管理员可以通过拖拽界面进行歌曲排期和顺序管理
- **排期草稿**：支持保存排期草稿功能，允许管理员分步完成排期安排
  - 草稿状态不影响公开展示，可随时修改和完善
  - 支持草稿发布为正式排期，确保排期质量
- **播出时段**：灵活配置播出时段，**支持多时段管理**
- **打印排期**：支持自定义纸张大小、内容选择、编写备注和PDF导出的打印功能
- **学期管理**：管理员可设置当前学期，自动关联点歌记录
- **公开展示**：公开展示歌曲播放排期，按日期分组展示

### 🔔 通知系统

- **实时通知**：歌曲被选中、投票和系统通知
- **通知设置**：用户可自定义通知偏好，支持独立页面设置
- **批量通知**：管理员可向特定用户群体发送通知
- **社交账号绑定**：支持绑定MeoW等账号，同步推送通知到外部平台
- **验证码验证**：安全的验证码验证机制，支持动态样式反馈

### 💾 数据管理

- **数据库备份**：完整的数据库备份和恢复功能
- **数据库重置**：支持安全的数据库重置操作，可选择性保留用户数据或完全重置
- **文件导入导出**：支持备份文件的上传、下载和管理
- **数据库自检**：自动数据库验证和修复机制，确保系统稳定性

### 🎨 用户体验

- **现代UI**：响应式设计，深色主题，流畅的动画效果
- **玻璃态设计**：现代化的视觉效果和交互体验
- **交互反馈**：hover效果，点击反馈，状态变化动画
- **移动端优化**：适配支持移动设备访问，触摸友好的交互设计

## 技术栈

### 前端技术

- **Nuxt 4**：Vue.js全栈框架，提供SSR和SPA支持
- **Vue 3**：响应式前端框架，使用Composition API
- **TypeScript**：类型安全的JavaScript，提供完整的类型定义
- **Tailwind CSS**：实用优先的CSS框架，响应式设计
- **Vue Router**：前端路由管理

### 后端技术

- **Nuxt Server API**：服务端API路由，支持中间件和认证
- **Drizzle ORM**：现代化数据库ORM，提供类型安全的数据库操作和高性能查询
- **Neon Database**：Serverless PostgreSQL数据库，支持自动启停和无缝扩展
- **PostgreSQL**：关系型数据库，支持复杂查询和事务处理
- **Redis**：高性能缓存数据库，提升系统响应速度（可选，暂不推荐，可能存在潜在的问题）
- **JWT**：标准JWT认证机制，支持24小时token有效期
- **bcrypt**：密码加密，安全的哈希算法
- **Multer**：文件上传处理，支持多种存储方式

## 系统架构

系统采用了现代化的 Serverless 全栈架构：

- **前端**：使用 Nuxt 4 + Vue 3 组合式API构建响应式用户界面
- **后端**：使用 Nuxt Server API 构建 RESTful API 服务
- **数据库**：使用 Drizzle ORM + Neon Database，提供类型安全和高性能的数据库操作
- **认证**：标准 JWT 认证系统
- **缓存**：可选的 Redis 缓存层，提升系统响应速度
- **部署**：支持 Vercel、Netlify、EdgeOne 等 Serverless 平台一键部署

## 部署指南

### 一键部署

本项目可以一键部署到Vercel/Netlify/EdgeOne平台：

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flaoshuikaixue%2FVoiceHub&env=DATABASE_URL,JWT_SECRET,NODE_ENV&envDefaults=%7B%22NODE_ENV%22%3A%22production%22%7D&envDescription=%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F%E8%AF%B4%E6%98%8E&envLink=https%3A%2F%2Fgithub.com%2Flaoshuikaixue%2FVoiceHub%23%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F%E8%AF%B4%E6%98%8E)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/laoshuikaixue/VoiceHub)
[![Deploy to EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https://github.com/laoshuikaixue/VoiceHub&env=DATABASE_URL,JWT_SECRET&env-description=%E9%9C%80%E8%A6%81%E9%85%8D%E7%BD%AE%E6%95%B0%E6%8D%AE%E5%BA%93%E5%9C%B0%E5%9D%80%E3%80%81JWT%E5%AF%86%E9%92%A5)

在部署过程中，需要输入必要的环境变量：

1. `DATABASE_URL`：PostgreSQL数据库连接地址
2. `JWT_SECRET`：JWT令牌签名密钥

### Claw 部署

[![Claw](https://ap-southeast-1.run.claw.cloud/logo.svg)](https://ap-southeast-1.run.claw.cloud/)

1. **点击部署按钮**：选择上方的 Claw 部署按钮
2. **打开应用程序启动板**：打开 App Launchpad （应用程序启动板）
3. **创建应用**：选 Create App （创建应用）
4. **相关配置**：
   ```
   Application Name：VoiceHub 或 其它
   Image Name: ghcr.io/laoshuikaixue/voicehub:latest
   Usage：按需调整
   Network：3000 ，开 Public Access
   Environment Variables：
      DATABASE_URL=postgresql://user:password@postgres:5432/voicehub
      JWT_SECRET=your-jwt-secret-here
      # 按实际情况填写
   ```
5. **等待部署**：平台会自动构建和部署应用
6. **访问应用**：部署完成后，您将获得一个可访问的 URL

### Docker 部署

VoiceHub 支持通过 Docker 进行容器化部署，提供了多种部署方式。

#### 方式一：使用 Docker Compose（推荐）

这是最简单的部署方式，会自动创建应用和数据库容器。

1. 克隆项目

```bash
git clone https://github.com/laoshuikaixue/VoiceHub.git
cd VoiceHub
```

2. 修改 docker-compose.yml 中的环境变量

```yaml
environment:
  - DATABASE_URL=postgresql://user:password@postgres:5432/voicehub
  - JWT_SECRET=your-jwt-secret-here # 请修改为强随机字符串
  - NODE_ENV=production
```

3. 启动服务

```bash
docker-compose up -d
```

4. 访问应用
   打开浏览器访问 http://localhost:3000

默认管理员账号：

- 用户名：admin
- 密码：admin123

#### 方式二：使用预构建镜像

如果你已有 PostgreSQL 数据库，可以直接使用预构建的镜像。

使用 GitHub 镜像源：

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require" \
  -e JWT_SECRET="your-very-secure-jwt-secret-key" \
  -e NODE_ENV=production \
  --name voicehub \
  ghcr.io/laoshuikaixue/voicehub:latest
```

使用南京大学镜像源：

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require" \
  -e JWT_SECRET="your-very-secure-jwt-secret-key" \
  -e NODE_ENV=production \
  --name voicehub \
  ghcr.nju.edu.cn/laoshuikaixue/voicehub:latest
```

#### 方式三：本地构建镜像

如果需要自定义构建，可以本地构建镜像。

```bash
git clone https://github.com/laoshuikaixue/VoiceHub.git
cd VoiceHub

# 构建镜像（不使用缓存，确保完全重新构建）
docker build --no-cache -t voicehub .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require" \
  -e JWT_SECRET="your-very-secure-jwt-secret-key" \
  -e NODE_ENV=production \
  --name voicehub \
  voicehub
```

### Linux 服务器部署

本项目提供了针对 Ubuntu/Debian 服务器的一键部署脚本，支持自动安装 Node.js 22、配置环境变量、安装依赖和构建项目。

**一键部署命令：**

```bash
bash <(curl -sL https://raw.githubusercontent.com/laoshuikaixue/VoiceHub/main/sh/deploy.sh)
```

**更新部署：**
项目更新时，可使用更新脚本快速更新：

```bash
# 一键更新命令
bash <(curl -sL https://raw.githubusercontent.com/laoshuikaixue/VoiceHub/main/sh/update.sh)
```

**日常管理：**
部署完成后，可使用 `voicehub` 命令进行日常管理（需在部署时安装）

### 本地开发部署

#### 前提条件

- Node.js 20+
- PostgreSQL 数据库（推荐使用 Neon）
- Redis 数据库（可选，暂不推荐）

#### 快速开始

1. 克隆项目

```bash
git clone https://github.com/laoshuikaixue/VoiceHub.git
cd VoiceHub
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

复制 `.env.example` 文件并重命名为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必需的环境变量：

```env
# 数据库连接地址（必填）
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# JWT 认证密钥（必填）
JWT_SECRET="your-very-secure-jwt-secret-key"

# 应用运行环境（可选）
NODE_ENV=development
```

4. 初始化数据库

首次运行需要初始化数据库结构：

```bash
# 生成数据库迁移文件
npm run db:generate

# 执行数据库迁移
npm run db:migrate
```

或使用一键部署命令（推荐）：

```bash
npm run deploy
```

5. 创建管理员账户

系统会在首次部署时自动创建管理员账户。如需手动创建：

```bash
npm run create-admin
```

默认管理员账户：

- 用户名：admin
- 密码：admin123

6. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动。

### 生产环境部署

1. 构建生产版本

```bash
npm run build
```

2. 启动生产服务器

```bash
npm start
```

### 数据库管理命令

```bash
# 生成迁移文件
npm run db:generate

# 执行数据库迁移
npm run db:migrate

# 推送模式变更到数据库（开发环境）
npm run db:push

# 启动 Drizzle Studio（数据库管理界面）
npm run db:studio

# 清空数据库并重新创建管理员
npm run clear-db

# 安全迁移（带备份）
npm run safe-migrate
```

### 升级与迁移

有关如何升级现有部署和迁移数据，请参阅 [升级指南](UPGRADE.md)。

## 系统配置

### 站点配置管理

VoiceHub 提供了完整的站点配置管理功能，支持通过管理后台动态配置系统参数：

#### 基本信息配置

- **站点标题**：自定义系统显示名称
- **站点描述**：系统功能描述和介绍
- **站点Logo**：支持上传自定义Logo图片

#### 播放时段管理

- **多时段支持**：支持配置多个播放时段（如午间、晚间）
- **时段名称**：自定义时段显示名称
- **开始/结束时间**：精确到分钟的时间控制
- **时段排序**：支持拖拽调整时段显示顺序

#### 通知系统配置

- **通知开关**：控制系统通知功能的启用状态
- **通知类型**：配置不同类型通知的发送规则
- **通知模板**：自定义通知消息的格式和内容

### 数据库备份与恢复

系统提供了完整的数据备份和恢复解决方案：

#### 备份功能

- **完整备份**：包含所有数据表的完整系统备份
- **用户数据备份**：仅备份用户相关数据（用户、歌曲、投票等）
- **增量备份**：支持基于时间的增量备份策略

#### 恢复功能

- **合并模式**：将备份数据与现有数据合并，保留现有数据
- **替换模式**：完全替换现有数据（谨慎使用）
- **数据验证**：恢复前自动验证备份文件完整性

### 权限与角色管理

VoiceHub 实现了细粒度的权限控制系统：

#### 角色类型

- **超级管理员 (SUPER_ADMIN)**：拥有所有系统权限，包括用户管理、系统配置、数据库管理等
- **管理员 (ADMIN)**：拥有日常管理权限，如用户管理、排期管理、歌曲管理、系统配置等
- **歌曲管理员 (SONG_ADMIN)**：专门负责歌曲相关管理，包括排期管理、歌曲管理、打印排期等
- **普通用户 (USER)**：基本的点歌、投票和查看权限

#### 权限分类

- **内容管理权限**：排期管理、歌曲管理、打印排期等
- **用户管理权限**：创建、编辑、删除用户账户
- **系统管理权限**：通知管理、播放时间管理、学期管理、黑名单管理、站点配置、数据库管理等

#### 权限继承与分配

- **SUPER_ADMIN**：拥有所有权限
- **ADMIN**：拥有除数据库管理外的所有权限
- **SONG_ADMIN**：拥有内容管理相关权限（排期、歌曲、打印）
- **USER**：仅拥有基本的点歌和查看权限

#### 权限验证

- 前端基于角色动态显示界面元素和菜单
- 后端API进行严格的权限验证
- 支持页面级和功能级的权限控制

## 环境变量说明

| 变量名          | 必填 | 说明                              | 示例值                                                                 |
|--------------|----|---------------------------------|---------------------------------------------------------------------|
| DATABASE_URL | 是  | PostgreSQL数据库连接字符串              | `postgresql://username:password@host:port/database?sslmode=require` |
| JWT_SECRET   | 是  | JWT令牌签名密钥，建议使用强随机字符串            | `your-very-secure-jwt-secret-key`                                   |
| NODE_ENV     | 否  | 运行环境，development或production     | `production`                                                        |
| REDIS_URL    | 否  | Redis缓存服务连接字符串，填写后自动启用Redis缓存功能 | `redis://default:password@host:port`                                |
| NITRO_PRESET | 否  | Nitro预设                         | `vercel`                                                            |

## 项目结构

```
VoiceHub/
├── app/                       # Nuxt 4 应用主目录
│   ├── app.vue                # 应用入口文件
│   ├── assets/                # 静态资源目录
│   │   └── css/               # CSS样式文件
│   │       ├── components.css      # 组件样式
│   │       ├── lyric-player.module.css  # 歌词播放器样式
│   │       ├── main.css           # 主样式文件
│   │       ├── mobile-admin.css   # 移动端管理样式
│   │       ├── print-fix.css      # 打印样式修复
│   │       ├── sf-pro-icons.css   # SF Pro图标字体
│   │       ├── theme-protection.css # 主题保护样式
│   │       ├── transitions.css    # 过渡动画样式
│   │       ├── variables.css      # CSS变量定义
│   │       └── year-review.css    # 年度回顾样式
│   ├── components/            # Vue组件目录
│   │   ├── Admin/             # 管理员功能组件
│   │   │   ├── ApiKeyManager.vue      # API密钥管理
│   │   │   ├── BackupManager.vue      # 数据库备份管理
│   │   │   ├── BatchUpdateModal.vue   # 批量更新模态框
│   │   │   ├── BlacklistManager.vue   # 黑名单管理
│   │   │   ├── DataAnalysisPanel.vue  # 数据分析面板
│   │   │   ├── DatabaseManager.vue    # 数据库管理
│   │   │   ├── EmailTemplateManager.vue # 邮件模板管理
│   │   │   ├── NotificationSender.vue # 通知发送管理
│   │   │   ├── OverviewDashboard.vue  # 管理概览仪表板
│   │   │   ├── PlayTimeManager.vue    # 播放时间管理
│   │   │   ├── RequestTimeManager.vue # 点歌时间管理
│   │   │   ├── ScheduleForm.vue       # 排期表单
│   │   │   ├── ScheduleItemPrint.vue  # 排期项目打印
│   │   │   ├── ScheduleManager.vue    # 排期管理
│   │   │   ├── SchedulePrinter.vue    # 排期打印功能
│   │   │   ├── SemesterManager.vue    # 学期管理
│   │   │   ├── Sidebar.vue            # 管理后台侧边栏
│   │   │   ├── SiteConfigManager.vue  # 站点配置管理
│   │   │   ├── SmtpManager.vue        # SMTP邮件服务管理
│   │   │   ├── SongDownloadDialog.vue # 歌曲下载弹窗
│   │   │   ├── SongManagement.vue     # 歌曲管理
│   │   │   ├── UserManager.vue        # 用户管理
│   │   │   ├── UserSongsModal.vue     # 用户歌曲查看弹窗
│   │   │   └── VotersModal.vue        # 投票人员查看弹窗
│   │   ├── AMLL/              # Apple Music-Like Lyrics组件
│   │   │   └── LyricPlayer.vue # AMLL歌词播放器
│   │   ├── Auth/              # 认证相关组件
│   │   │   ├── Providers/     # 第三方登录提供商组件
│   │   │   │   ├── Casdoor/   # Casdoor登录组件
│   │   │   │   │   └── Icon.vue # Casdoor图标
│   │   │   │   └── GitHub/    # GitHub登录组件
│   │   │   │       └── Icon.vue # GitHub图标
│   │   │   ├── ChangePasswordForm.vue # 修改密码表单
│   │   │   ├── LoginForm.vue         # 登录表单
│   │   │   ├── OAuthBindingCard.vue  # OAuth绑定卡片
│   │   │   └── OAuthButtons.vue      # OAuth登录按钮组
│   │   ├── Common/            # 通用组件
│   │   │   └── UserSearchModal.vue   # 用户搜索弹窗
│   │   ├── Notifications/     # 通知系统组件
│   │   │   └── NotificationSettings.vue # 通知设置
│   │   ├── Player/            # 播放器相关组件
│   │   │   └── PlayerLyric/   # 播放器歌词子组件
│   │   ├── Songs/             # 歌曲相关组件
│   │   │   ├── BilibiliEpisodesModal.vue # Bilibili剧集选择弹窗
│   │   │   ├── DuplicateSongModal.vue # 重复歌曲处理对话框
│   │   │   ├── ImportSongsModal.vue   # 导入歌曲弹窗
│   │   │   ├── NeteaseLoginModal.vue  # 网易云音乐登录弹窗
│   │   │   ├── PlaylistSelectionModal.vue # 歌单选择弹窗
│   │   │   ├── PodcastEpisodesModal.vue # 播客节目弹窗
│   │   │   ├── RecentSongsModal.vue   # 最近播放弹窗
│   │   │   ├── RequestForm.vue        # 点歌表单
│   │   │   ├── ScheduleList.vue       # 排期列表展示
│   │   │   └── SongList.vue           # 歌曲列表
│   │   ├── UI/                # 通用UI组件
│   │   │   ├── AudioPlayer/   # 音频播放器组件模块
│   │   │   │   ├── AudioElement.vue   # 音频元素组件
│   │   │   │   ├── PlayerControls.vue # 播放器控制组件
│   │   │   │   └── PlayerInfo.vue     # 播放器信息组件
│   │   │   ├── Common/        # 通用UI组件
│   │   │   │   ├── CustomSelect.vue   # 自定义选择器
│   │   │   │   ├── DataTable.vue      # 通用数据表格组件
│   │   │   │   ├── ErrorBoundary.vue  # 错误边界组件
│   │   │   │   ├── LoadingState.vue   # 加载状态组件
│   │   │   │   ├── SearchFilter.vue   # 搜索过滤组件
│   │   │   │   └── StatCard.vue       # 统计卡片组件
│   │   │   ├── AppleMusicLyrics.vue   # 类Apple Music风格歌词显示组件
│   │   │   ├── AudioPlayer.vue        # 主音频播放器组件
│   │   │   ├── BilibiliframeModal.vue # Bilibili视频预览弹窗
│   │   │   ├── ConfirmDialog.vue      # 确认对话框
│   │   │   ├── Icon.vue               # 图标组件
│   │   │   ├── LyricsModal.vue        # 全屏歌词模态框组件
│   │   │   ├── MarqueeText.vue        # 滚动文本显示组件
│   │   │   ├── Notification.vue       # 单个通知组件
│   │   │   ├── NotificationContainer.vue # 通知容器组件
│   │   │   ├── PageTransition.vue     # 页面过渡动画
│   │   │   └── ProgressBar.vue        # 进度条组件
│   │   ├── year-review/       # 年度回顾组件
│   │   └── SiteFooter.vue         # 站点页脚
│   ├── composables/           # Vue 3 组合式API
│   │   ├── useAdmin.ts         # 管理员功能hooks
│   │   ├── useAudioPlayer.ts   # 音频播放器hooks
│   │   ├── useAudioPlayerControl.ts # 音频播放器控制hooks
│   │   ├── useAudioPlayerEnhanced.ts # 增强音频播放器hooks
│   │   ├── useAudioPlayerSync.ts # 音频播放器同步hooks
│   │   ├── useAudioQuality.ts  # 音质管理hooks
│   │   ├── useAudioVisualizer.ts # 音频可视化hooks
│   │   ├── useAuth.ts          # 认证功能hooks
│   │   ├── useBackgroundRenderer.ts # 背景渲染hooks
│   │   ├── useBilibiliPreview.ts # Bilibili视频预览hooks
│   │   ├── useErrorHandler.ts  # 错误处理hooks
│   │   ├── useLyricManager.ts  # 歌词管理hooks
│   │   ├── useLyricPlayer.ts   # 类Apple Music风格歌词播放器hooks
│   │   ├── useLyrics.ts        # 歌词功能hooks
│   │   ├── useLyricSettings.ts # 歌词设置hooks
│   │   ├── useMediaSession.ts  # 媒体会话API hooks
│   │   ├── useMusicSources.ts    # 音乐源管理hooks
│   │   ├── useMusicWebSocket.ts  # 音乐WebSocket hooks
│   │   ├── useNotifications.ts # 通知功能hooks
│   │   ├── usePermissions.ts   # 权限管理hooks
│   │   ├── useProgress.ts      # 进度管理hooks
│   │   ├── useProgressEvents.ts # 进度事件hooks
│   │   ├── useRequestDedup.ts  # 请求去重hooks
│   │   ├── useSemesters.ts     # 学期管理hooks
│   │   ├── useSiteConfig.js    # 站点配置hooks
│   │   ├── useSongs.ts         # 歌曲管理hooks
│   │   ├── useToast.ts         # Toast提示hooks
│   │   └── useWebAuthn.ts      # WebAuthn 认证 hooks
│   ├── drizzle/               # 数据库相关
│   │   ├── db.ts               # 数据库连接
│   │   ├── schema.ts           # 数据库模型
│   │   └── migrations/         # 数据库迁移文件
│   ├── layouts/               # 布局组件
│   │   └── default.vue         # 默认布局模板
│   ├── middleware/            # 中间件
│   │   └── auth.global.ts      # 全局认证中间件
│   ├── pages/                 # 页面组件（Nuxt 4路由）
│   │   ├── account/           # 账户管理页面
│   │   │   └── index.vue      # 账户中心（绑定管理）
│   │   ├── auth/              # 认证相关页面
│   │   │   └── error.vue      # 认证错误页面
│   │   ├── change-password.vue # 修改密码页面
│   │   ├── dashboard.vue       # 用户仪表盘
│   │   ├── index.vue           # 首页
│   │   ├── login.vue           # 登录页面
│   │   ├── notification-settings.vue # 通知设置页面
│   │   └── year-review.vue     # 年度回顾页面
│   ├── plugins/               # Nuxt插件
│   │   ├── auth.client.ts      # 客户端认证插件
│   │   └── auth.server.ts      # 服务端认证插件
│   ├── public/                # 静态文件目录
│   │   ├── images/            # 图片资源
│   │   │   ├── logo.png       # PNG格式Logo
│   │   │   ├── logo.svg       # SVG格式Logo
│   │   │   ├── search.svg     # 搜索图标
│   │   │   └── thumbs-up.svg  # 点赞图标
│   │   ├── favicon.ico        # 网站图标
│   │   └── robots.txt         # 搜索引擎爬虫配置
│   └── utils/                 # 工具函数
│       ├── core/              # 核心工具
│       │   └── security.ts    # 安全相关工具
│       ├── lyric/             # 歌词处理工具
│       │   ├── exclude.ts     # 歌词排除规则
│       │   ├── lyricFormat.ts # 歌词格式化
│       │   ├── lyricParser.ts # 歌词解析器
│       │   ├── lyricStripper.ts # 歌词清理
│       │   ├── parseLrc.ts    # LRC格式解析
│       │   └── qrc-parser.ts  # QRC格式解析
│       ├── musicSdk/          # 音乐SDK工具
│       │   ├── tx/            # QQ音乐SDK
│       │   └── wy/            # 网易云音乐SDK
│       ├── bilibiliSource.ts  # 哔哩哔哩音源
│       ├── lyricAdapter.ts    # 歌词适配器
│       ├── musicSources.ts    # 音乐源配置
│       ├── musicUrl.ts        # 音乐URL处理
│       ├── neteaseApi.ts      # 网易云音乐API
│       ├── oauth.ts           # OAuth工具
│       ├── timeUtils.ts       # 时间工具
│       └── url.ts             # URL处理工具
├── server/                # 服务端代码
│   ├── api/                # API路由
│   │   ├── admin/          # 管理员API
│   │   │   ├── api-keys/            # API密钥管理API
│   │   │   │   ├── [id].delete.ts   # 删除API密钥
│   │   │   │   ├── [id].get.ts      # 获取API密钥详情
│   │   │   │   ├── [id].put.ts      # 更新API密钥
│   │   │   │   ├── index.get.ts     # 获取API密钥列表
│   │   │   │   ├── index.post.ts    # 创建API密钥
│   │   │   │   └── logs.get.ts      # API使用日志
│   │   │   ├── backup/              # 备份管理API
│   │   │   │   ├── delete/          # 删除备份子目录
│   │   │   │   ├── download/        # 下载备份子目录
│   │   │   │   ├── clear.post.ts    # 清空备份历史
│   │   │   │   ├── download.get.ts  # 下载备份
│   │   │   │   ├── export.post.ts   # 创建备份
│   │   │   │   ├── list.get.ts      # 获取备份列表
│   │   │   │   ├── restore-chunk.post.ts # 恢复备份分片
│   │   │   │   ├── restore.post.ts  # 恢复备份
│   │   │   │   └── upload.post.ts   # 上传备份文件
│   │   │   ├── blacklist/           # 黑名单管理API
│   │   │   │   ├── [id].delete.ts   # 删除黑名单项
│   │   │   │   ├── [id].patch.ts    # 更新黑名单项
│   │   │   │   ├── index.get.ts     # 获取黑名单列表
│   │   │   │   └── index.post.ts    # 添加黑名单项
│   │   │   ├── database/            # 数据库管理API
│   │   │   │   ├── cleanup.post.ts  # 数据库清理
│   │   │   │   ├── performance.get.ts # 数据库性能监控
│   │   │   │   ├── pool-status.get.ts # 连接池状态
│   │   │   │   ├── reset.post.ts    # 重置数据库
│   │   │   │   └── status.get.ts    # 数据库状态
│   │   │   ├── db-status.get.ts     # 数据库状态检查
│   │   │   ├── email-templates/     # 邮件模板管理API
│   │   │   │   ├── index.delete.ts  # 删除邮件模板
│   │   │   │   ├── index.get.ts     # 获取邮件模板列表
│   │   │   │   ├── index.post.ts    # 创建/更新邮件模板
│   │   │   │   └── preview.post.ts  # 预览邮件模板
│   │   │   ├── fix-sequence.post.ts # 修复数据库序列
│   │   │   ├── mark-played.post.ts  # 标记歌曲已播放
│   │   │   ├── notifications/       # 管理员通知API
│   │   │   │   └── send.post.ts     # 发送通知
│   │   │   ├── play-times/          # 播放时间管理API
│   │   │   │   ├── [id].ts          # 播放时间操作
│   │   │   │   ├── index.post.ts    # 创建播放时间
│   │   │   │   └── index.ts         # 播放时间列表
│   │   │   ├── replay-requests/     # 重播申请管理API
│   │   │   │   ├── index.get.ts     # 获取重播申请列表
│   │   │   │   └── reject.post.ts   # 拒绝重播申请
│   │   │   ├── request-times/       # 点歌时间管理API
│   │   │   │   ├── [id].ts          # 点歌时间操作
│   │   │   │   ├── index.post.ts    # 创建点歌时间
│   │   │   │   └── index.ts         # 点歌时间列表
│   │   │   ├── schedule/            # 排期管理API
│   │   │   │   ├── bulk-publish.post.ts # 批量发布排期
│   │   │   │   ├── draft.post.ts    # 保存排期草稿
│   │   │   │   ├── full.get.ts      # 获取完整排期数据（包含草稿）
│   │   │   │   ├── publish.post.ts  # 发布排期草稿
│   │   │   │   ├── remove.post.ts   # 移除排期
│   │   │   │   └── sequence.post.ts # 更新排期顺序
│   │   │   ├── schedule.post.ts     # 创建排期
│   │   │   ├── semesters/           # 学期管理API
│   │   │   │   ├── [id].delete.ts   # 删除学期
│   │   │   │   ├── index.get.ts     # 获取学期列表
│   │   │   │   ├── index.post.ts    # 创建学期
│   │   │   │   └── set-active.post.ts # 设置活跃学期
│   │   │   ├── smtp/                # SMTP邮件服务API
│   │   │   │   ├── test-connection.post.ts # 测试SMTP连接
│   │   │   │   └── test-email.post.ts # 发送测试邮件
│   │   │   ├── songs/               # 管理员歌曲管理API
│   │   │   │   ├── delete.post.ts   # 删除歌曲
│   │   │   │   └── reject.post.ts  # 驳回歌曲
│   │   │   ├── stats.get.ts         # 统计数据
│   │   │   ├── activities.get.ts    # 活动管理API
│   │   │   ├── stats/               # 详细统计API
│   │   │   │   ├── active-users.get.ts # 活跃用户统计
│   │   │   │   ├── realtime.get.ts  # 实时统计
│   │   │   │   ├── semester-comparison.get.ts # 学期对比统计
│   │   │   │   ├── top-songs.get.ts # 热门歌曲统计
│   │   │   │   ├── trends.get.ts    # 趋势分析
│   │   │   │   └── user-engagement.get.ts # 用户参与度统计
│   │   │   ├── system-settings/     # 系统设置API
│   │   │   │   ├── index.post.ts    # 更新系统设置
│   │   │   │   └── index.ts         # 获取系统设置
│   │   │   └── users/               # 用户管理API
│   │   │       ├── [id]/            # 用户详情操作子目录
│   │   │       │   ├── reset-password.post.ts # 重置用户密码
│   │   │       │   ├── songs.get.ts     # 获取用户点歌记录
│   │   │       │   ├── status-logs.get.ts # 获取用户状态变更日志
│   │   │       │   └── status.put.ts    # 更新用户状态
│   │   │       ├── [id].delete.ts   # 删除用户
│   │   │       ├── [id].put.ts      # 更新用户
│   │   │       ├── [id].ts          # 用户详情
│   │   │       ├── batch-grade-update.post.ts # 批量年级更新
│   │   │       ├── batch-status.put.ts # 批量状态更新
│   │   │       ├── batch-update.post.ts # 批量更新用户
│   │   │       ├── batch.post.ts    # 批量操作用户
│   │   │       ├── index.get.ts     # 获取用户列表
│   │   │       ├── index.post.ts    # 创建用户
│   │   │       ├── index.ts         # 用户管理
│   │   │       └── status-logs.get.ts # 用户状态日志
│   │   ├── auth/           # 认证API
│   │   │   ├── webauthn/      # WebAuthn 相关 API
│   │   │   │   ├── login/     # 登录验证
│   │   │   │   │   ├── options.get.ts    # 获取登录 Challenge
│   │   │   │   │   └── verify.post.ts    # 验证登录签名
│   │   │   │   ├── register/  # 设备注册
│   │   │   │   │   ├── options.get.ts    # 获取注册 Challenge
│   │   │   │   │   └── verify.post.ts    # 验证注册签名
│   │   │   │   └── rename.post.ts    # 重命名设备
│   │   │   ├── change-password.post.ts # 修改密码
│   │   │   ├── login.post.ts        # 用户登录
│   │   │   ├── logout.post.ts       # 用户登出
│   │   │   ├── set-initial-password.post.ts # 设置初始密码
│   │   │   └── verify.get.ts        # 验证Token并获取用户信息
│   │   ├── bilibili/       # Bilibili相关API
│   │   │   ├── playurl.get.ts       # 获取播放链接
│   │   │   └── search.get.ts        # Bilibili视频搜索
│   │   ├── blacklist/      # 黑名单API
│   │   │   └── check.post.ts        # 检查黑名单
│   │   ├── meow/           # MeoW账号绑定API
│   │   │   ├── bind.post.ts         # 绑定MeoW账号
│   │   │   └── unbind.post.ts       # 解绑MeoW账号
│   │   ├── music/          # 音乐相关API
│   │   │   ├── state.post.ts        # 音乐状态管理
│   │   │   └── websocket.ts         # 音乐WebSocket连接
│   │   ├── native-api/     # 原生音乐API
│   │   │   └── search/              # 搜索API
│   │   │       ├── tx.get.ts        # 腾讯音乐搜索
│   │   │       └── wy.get.ts        # 网易云音乐搜索
│   │   ├── notifications/  # 通知系统API
│   │   │   ├── [id]/                # 通知操作子目录
│   │   │   │   └── read.post.ts     # 标记通知已读
│   │   │   ├── [id].delete.ts       # 删除通知
│   │   │   ├── clear-all.delete.ts  # 清空所有通知
│   │   │   ├── index.ts             # 通知列表
│   │   │   ├── meow/                # MeoW通知API
│   │   │   │   ├── send-verification.post.ts # 发送验证码
│   │   │   │   └── test.post.ts     # 测试通知
│   │   │   ├── read-all.post.ts     # 标记所有已读
│   │   │   ├── settings.post.ts     # 更新通知设置
│   │   │   └── settings.ts          # 获取通知设置
│   │   ├── open/           # 开放API（无需认证）
│   │   │   ├── schedules.get.ts     # 获取公开排期
│   │   │   └── songs.get.ts         # 获取公开歌曲列表
│   │   ├── play-times/     # 播放时间API
│   │   │   └── index.ts             # 播放时间管理
│   │   ├── request-times/  # 点歌时间API
│   │   │   └── index.ts             # 点歌时间管理
│   │   ├── progress/       # 进度条API
│   │   │   ├── events.ts            # 进度事件
│   │   │   └── id.ts                # 进度ID管理
│   │   ├── proxy/          # 代理服务API
│   │   │   └── image.get.ts         # 图片代理（解决HTTP/HTTPS混合内容及跨域问题）
│   │   ├── semesters/      # 学期API
│   │   │   ├── current.get.ts       # 获取当前学期
│   │   │   └── options.get.ts       # 获取学期选项
│   │   ├── site-config.get.ts       # 站点配置API
│   │   ├── songs/          # 歌曲相关API
│   │   │   ├── [id]/                # 歌曲详情操作
│   │   │   │   ├── update.put.ts    # 更新歌曲信息
│   │   │   │   └── voters.get.ts    # 获取投票人员
│   │   │   ├── collaborators/       # 联合投稿管理
│   │   │   │   └── reply.post.ts    # 处理联合投稿邀请
│   │   │   ├── add.post.ts          # 添加歌曲
│   │   │   ├── count.get.ts         # 歌曲统计
│   │   │   ├── import.post.ts       # 导入歌曲
│   │   │   ├── index.get.ts         # 歌曲列表
│   │   │   ├── public.get.ts        # 公开歌曲列表
│   │   │   ├── request.post.ts      # 点歌请求
│   │   │   ├── replay.post.ts       # 提交重播申请
│   │   │   ├── replay.delete.ts     # 撤回重播申请
│   │   │   ├── submission-status.get.ts # 投稿状态
│   │   │   ├── vote.post.ts         # 投票
│   │   │   └── withdraw.post.ts     # 撤回歌曲
│   │   ├── system/         # 系统API
│   │   │   ├── location.get.ts      # 获取系统位置信息
│   │   │   ├── reconnect.post.ts    # 重连数据库
│   │   │   └── status.get.ts        # 系统状态
│   │   ├── user/           # 用户相关API
│   │   │   ├── email/               # 用户邮箱管理
│   │   │   │   ├── bind.post.ts     # 绑定邮箱
│   │   │   │   ├── resend-verification.post.ts # 重发验证邮件
│   │   │   │   ├── send-code.post.ts # 发送验证码
│   │   │   │   ├── unbind.post.ts   # 解绑邮箱
│   │   │   │   └── verify-code.post.ts # 验证邮箱验证码
│   │   │   └── year-review.get.ts   # 获取年度回顾数据
│   │   └── users/          # 用户API
│   │       ├── meow/                # 用户MeoW相关子目录
│   │       ├── social-accounts/     # 社交账号管理
│   │       │   ├── meow.delete.ts   # 删除MeoW绑定
│   │       │   └── meow.post.ts     # MeoW账号操作
│   │       ├── search.get.ts        # 搜索用户
│   │       └── social-accounts.get.ts # 获取社交账号
│   ├── config/             # 服务端配置
│   │   └── constants.ts    # 风控阈值与时间窗口常量
│   ├── error.ts            # 全局错误处理
│   ├── middleware/         # 服务端中间件
│   │   ├── api-auth.ts     # API认证中间件
│   │   └── auth.ts         # 认证中间件
│   ├── plugins/            # 服务端插件
│   │   └── error-handler.ts # 错误处理插件
│   ├── services/           # 业务服务层
│   │   ├── apiLogService.ts # API日志服务
│   │   ├── cacheService.ts # 缓存服务（Redis缓存管理）
│   │   ├── meowNotificationService.ts # MeoW通知服务
│   │   ├── notificationService.ts # 通知服务
│   │   ├── securityService.ts # 安全服务
│   │   └── smtpService.ts  # SMTP邮件服务
│   ├── utils/              # 服务端工具函数
│   │   ├── __tests__/      # 工具函数测试目录
│   │   ├── musicSdk/       # 音乐SDK工具
│   │   ├── auth.ts         # 认证工具函数
│   │   ├── cache-helpers.ts # 缓存辅助工具
│   │   ├── database-health.ts # 数据库健康检查
│   │   ├── database-manager.ts # 数据库管理工具
│   │   ├── geo.ts          # 地理位置工具
│   │   ├── ip-utils.ts     # IP地址工具
│   │   ├── jwt-enhanced.ts # JWT工具
│   │   ├── log-manager.ts  # 日志管理工具
│   │   ├── native_common.ts # 原生API通用工具
│   │   ├── native_tx.ts    # 腾讯音乐原生API
│   │   ├── native_wy.ts    # 网易云音乐原生API
│   │   ├── oauth-strategies.ts # OAuth策略配置
│   │   ├── oauth.ts        # OAuth通用工具
│   │   ├── oauth-token.ts  # OAuth令牌工具
│   │   ├── open-api-cache.ts # 开放API缓存
│   │   ├── permissions.js  # 权限系统配置
│   │   ├── redis.ts        # Redis连接和操作工具
│   │   └── siteUtils.ts    # 站点工具函数
│   └── tsconfig.json       # 服务端TypeScript配置
├── types/                 # TypeScript类型定义
│   ├── global.d.ts         # 全局类型定义
│   └── index.ts            # 通用类型定义
├── utils/                 # 客户端工具函数
│   ├── __tests__/          # 工具函数测试目录
│   ├── musicSources.ts     # 音乐源配置和管理工具
│   ├── musicUrl.ts         # 音乐URL处理工具
│   ├── oauth.ts            # OAuth工具函数
│   └── url.ts              # URL处理工具（HTTPS转换等）
├── .env.example           # 环境变量示例文件
├── .gitignore             # Git忽略文件配置
├── .vercelignore          # Vercel部署忽略文件
├── docker-compose/        # Docker Compose配置目录
├── docker-compose.yml     # Docker编排文件
├── Dockerfile             # Docker构建文件
├── drizzle.config.ts      # Drizzle配置文件
├── LICENSE                # 开源许可证文件
├── netlify.toml           # Netlify部署配置
├── nuxt.config.ts         # Nuxt 4主配置文件
├── package.json           # Node.js项目配置和依赖
├── README.md              # 项目说明文档
├── tsconfig.json          # TypeScript配置文件
└── vercel.json            # Vercel部署配置
```

### 目录说明

#### 核心目录 (app/)

- **`app/components/`**: Vue组件库，按功能模块组织
  - **`Admin/`**: 管理后台组件（排期、用户、数据分析等）
  - **`Admin_Backup/`**: 管理组件备份目录
  - **`AMLL/`**: Apple Music-Like Lyrics歌词播放器组件
  - **`Auth/`**: 认证相关组件（登录、OAuth绑定等）
  - **`Common/`**: 通用业务组件
  - **`Notifications/`**: 通知系统组件
  - **`Player/`**: 播放器相关组件
  - **`Songs/`**: 歌曲相关组件（点歌、导入、歌单等）
  - **`UI/`**: 通用UI组件（播放器、对话框、进度条等）
  - **`year-review/`**: 年度回顾功能组件
- **`app/pages/`**: 页面组件，Nuxt 4 自动路由
- **`app/composables/`**: Vue 3组合式API，业务逻辑复用
- **`app/drizzle/`**: Drizzle ORM配置、数据库连接和迁移文件

#### 配置目录 (app/)

- **`app/assets/css/`**: 样式文件，支持CSS变量和主题
- **`app/plugins/`**: Nuxt插件，扩展框架功能
- **`app/middleware/`**: 中间件，处理路由和认证
- **`app/utils/`**: 客户端工具函数
  - **`core/`**: 核心工具（安全等）
  - **`lyric/`**: 歌词处理工具集
  - **`musicSdk/`**: 音乐平台SDK工具

#### 服务端目录 (server/)

- **`server/api/`**: 服务端API，RESTful接口设计
  - **`admin/`**: 管理员专用API（用户、排期、统计等）
  - **`auth/`**: 认证相关API
  - **`songs/`**: 歌曲管理API
  - **`notifications/`**: 通知系统API
  - **`open/`**: 公共API（无需认证）
- **`server/config/`**: 服务端配置（常量、环境配置等）
- **`server/middleware/`**: 服务端中间件（认证、日志等）
- **`server/plugins/`**: 服务端插件（错误处理等）
- **`server/services/`**: 业务逻辑服务层
- **`server/utils/`**: 服务端工具函数
  - **`musicSdk/`**: 音乐平台SDK服务端工具

#### 静态资源

- **`app/public/`**: 静态文件
- **`app/public/images/`**: 图片资源，包含Logo和图标文件

## 使用说明

### 普通用户

1. 访问主页，查看当前排期
2. 注册/登录账号
3. 在仪表盘中点歌或给喜欢的歌曲投票
   - 支持搜索网易云音乐、QQ音乐和哔哩哔哩平台
   - 可以试听歌曲并选择音质
   - 支持给已有歌曲投票
   - **网易云音乐登录功能**：
     - 扫码登录网易云音乐账号
     - 登录后可一键添加当前排期歌曲到个人歌单
     - 支持从个人歌单中直接投稿歌曲
     - 支持从最近播放记录中投稿歌曲
     - 可搜索并投稿播客和电台内容
4. 使用内置播放器播放歌曲
   - 支持多种音质切换（标准、HQ、无损、Hi-Res等）
   - 实时切换音质并保持播放进度
5. 查看通知中心获取歌曲状态更新

### 管理员

1. 使用管理员账号登录（默认账号：admin，密码：admin123）
2. 进入管理后台，选择相应功能标签
3. **排期管理**：可以看到左侧"待排歌曲"和右侧"播放顺序"
   - 通过拖拽将歌曲从左侧添加到右侧的排期列表
   - 可以在右侧拖拽调整歌曲播放顺序
   - 支持播出时段管理，可设置不同时段的播放安排
   - **草稿功能**：支持保存排期草稿，允许管理员先保存未完成的排期安排
     - 点击"保存草稿"按钮保存当前排期为草稿状态
     - 草稿不会影响公开展示的排期，可以随时修改
     - 点击"保存并发布"按钮将草稿发布为正式排期
   - 点击"保存顺序"按钮保存排期
4. **打印排期**：专业的排期打印和导出功能
   - 选择纸张大小（A4、A3、Letter、Legal）和页面方向
   - 自定义显示内容：歌曲封面、歌名、歌手、投稿人、热度等
   - 快捷日期选择：今天、明天、本周、下周
   - 智能分组显示：按日期分组，有多个播出时段时自动按时间排序
   - 实时预览：所见即所得的打印预览
   - PDF导出：支持导出高质量PDF文件，自动处理跨域图片
5. **歌曲管理**：查看和管理所有歌曲
   - 支持播放歌曲并实时切换音质
   - 动态获取最新的音乐播放链接
   - 提供歌曲下载功能，支持批量下载管理
   - 批量更新歌曲信息和状态
6. **数据分析**：查看系统使用统计和数据分析
   - 实时统计数据：用户活跃度、歌曲热度、投票趋势
   - 学期对比分析：不同学期的数据对比
   - 用户参与度分析：用户行为和参与度统计
   - 趋势分析：系统使用趋势和预测
7. **数据库管理**：数据库备份恢复和维护
   - 创建和下载数据库备份
   - 上传和恢复备份文件
   - 序列重置：修复数据库序列问题
   - 数据库状态检查和完整性验证
8. **学期管理**：设置和管理学期信息
   - 创建新学期（如"2024-2025学年上学期"）
   - 设置当前活跃学期
   - 点歌记录自动关联到当前学期
9. **用户管理**：添加、编辑和删除用户
   - 单个添加：填写用户信息（包括姓名、账号、年级、班级）
   - 批量导入：通过EXCEL文件批量添加用户
   - 可以重置用户密码
10. **黑名单管理**：管理歌曲和关键词黑名单
    - 添加具体歌曲或关键词到黑名单
    - 自动过滤包含黑名单内容的点歌请求
    - 支持启用/禁用黑名单项
11. **系统设置**：配置系统参数和功能开关
    - 站点信息配置：标题、Logo、描述等
    - 投稿限额设置：每日/每周投稿限制
    - 播出时段管理：配置不同的播出时间段
    - 功能开关：启用/禁用特定功能
12. **通知管理**：向用户发送系统通知
    - 支持按全体用户、年级、班级或多班级发送
    - 实时显示发送进度和结果
    - 通知历史记录和管理

## 数据库管理

### Drizzle ORM + Neon Database

项目使用 Drizzle ORM 作为数据库 ORM，配合 Neon Database 提供现代化的数据库解决方案。

#### 核心文件结构

- **`drizzle.config.ts`** - Drizzle ORM 主配置文件
- **`app/drizzle/db.ts`** - 数据库连接和客户端配置
- **`app/drizzle/schema.ts`** - 数据库表结构定义（TypeScript 类型安全）
- **`app/drizzle/migrations/`** - 数据库迁移脚本目录

### 数据库初始化

首次部署时，系统会自动初始化数据库结构。

#### 自动初始化（推荐）

使用部署脚本自动完成数据库初始化：

```bash
npm run deploy
```

该命令会：

1. 检查环境变量配置
2. 安装依赖
3. 执行数据库迁移
4. 创建默认管理员账户
5. 构建应用

#### 手动初始化

如需手动管理数据库：

1. 生成迁移文件

```bash
npm run db:generate
```

2. 执行数据库迁移

```bash
npm run db:migrate
```

3. 推送模式变更到数据库（开发环境）

```bash
npm run db:push
```

4. 启动 Drizzle Studio（数据库管理界面）

```bash
npm run db:studio
```

访问 https://local.drizzle.studio 查看和管理数据库

5. 清空数据库并创建管理员

```bash
npm run clear-db
```

### 数据库备份与恢复

#### 通过管理后台

1. 创建备份
   - 登录管理后台
   - 进入"数据库管理"页面
   - 点击"创建备份"按钮
   - 选择备份类型（完整备份/用户数据备份）

2. 下载备份
   - 备份完成后在列表中找到备份文件
   - 点击"下载"按钮保存到本地

3. 恢复备份
   - 点击"上传备份"按钮
   - 选择备份文件
   - 选择恢复模式：
     - 增量恢复：合并备份数据与现有数据
     - 完全恢复：替换所有现有数据（谨慎使用）
   - 确认并执行恢复

#### 使用 PostgreSQL 命令行

```bash
# 备份数据库
pg_dump -h localhost -U username -d database_name > backup.sql

# 恢复数据库
psql -h localhost -U username -d database_name < backup.sql
```

### 备份文件格式

- **完整备份**：包含所有数据表的 JSON 格式文件
- **用户备份**：仅包含用户相关数据
- **元数据**：包含创建时间、创建者、表信息等

## 开发指南

### 组合式API

项目使用了Vue 3的组合式API，主要包括：

- `useAuth`: 处理用户认证、登录、注册和权限控制
- `useSongs`: 处理歌曲相关操作，包括获取歌曲列表、点歌和投票
- `useAdmin`: 处理管理员操作，包括排期管理和标记播放
- `useNotifications`: 处理通知系统，包括获取、标记已读和设置
- `useAudioQuality`: 处理音质管理，包括音质设置和持久化
- `useSemesters`: 处理学期管理，包括创建学期和设置活跃学期

### 添加新功能

1. 在 `server/api` 中添加新的API端点
2. 在 `app/composables` 中添加相应的组合式函数
3. 在 `app/components` 中创建UI组件
4. 在 `app/pages` 中整合组件和功能

### 数据库模型修改

如需修改数据库模型：

1. 编辑`app/drizzle/schema.ts`文件中的表结构定义
2. 生成新的迁移文件：`npm run db:generate`
3. 应用迁移到数据库：`npm run db:migrate`
4. 确保同时更新 `types/index.ts` 中的TypeScript类型定义
5. 使用Drizzle Studio查看数据库：`npm run db:studio`

### OAuth 平台扩展指南

VoiceHub 采用策略模式（Strategy Pattern）实现了灵活的 OAuth 扩展机制，允许开发者轻松接入新的第三方登录平台。

#### 扩展步骤

##### 1. 定义 OAuth 策略

在 `server/utils/oauth-strategies.ts` 文件中，实现 `OAuthStrategy` 接口。该接口定义了 OAuth 流程中的三个核心方法：

```typescript
export interface OAuthStrategy {
  /**
   * 获取授权跳转 URL
   * @param redirectUri 回调地址（通常是 /api/auth/[provider]/callback）
   * @param state 包含安全校验信息的加密字符串
   */
  getAuthorizeUrl(redirectUri: string, state: string): string

  /**
   * 使用 code 换取 access_token
   * @param code 授权码
   * @param redirectUri 回调地址
   */
  exchangeToken(code: string, redirectUri: string): Promise<string>

  /**
   * 获取用户信息
   * @param accessToken 访问令牌
   */
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>
}
```

**示例：接入 Google 登录**

```typescript
// server/utils/oauth-strategies.ts
const googleStrategy: OAuthStrategy = {
  getAuthorizeUrl(redirectUri, state) {
    const clientId = process.env.GOOGLE_CLIENT_ID
    // Google 授权端点
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile&state=${encodeURIComponent(state)}`
  },

  async exchangeToken(code, redirectUri) {
    // ... 实现 Google 的 Token 交换逻辑
    // 通常是发送 POST 请求到 https://oauth2.googleapis.com/token
  },

  async getUserInfo(accessToken) {
    // ... 实现获取 Google 用户信息的逻辑
    // 通常是发送 GET 请求到 https://www.googleapis.com/oauth2/v3/userinfo
    // 需返回统一的 OAuthUserInfo 格式：
    // { id, username, email, name, avatar }
  }
}
```

##### 2. 注册策略

在同一个文件 (`server/utils/oauth-strategies.ts`) 的 `strategies` 对象中注册你的新策略：

```typescript
const strategies: Record<string, OAuthStrategy> = {
  github: githubStrategy,
  casdoor: casdoorStrategy,
  google: googleStrategy // <--- 注册新平台
  // ... 其他平台
}
```

##### 3. 配置环境变量

在 `.env` 文件中添加新平台所需的配置（如 Client ID 和 Secret）：

```bash
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

##### 4. 完成！

现在，你可以通过 `/api/auth/google` 访问新的登录流程，VoiceHub 会自动处理路由分发、State 校验、CSRF 保护和用户绑定逻辑。

#### Casdoor 配置说明

项目已内置对 [Casdoor](https://casdoor.org/) 的支持。Casdoor 是一个开源的 UI 优先的身份认证管理系统 (IAM)，支持 OAuth 2.0、OIDC 等多种协议。

要启用 Casdoor 登录，只需在 `.env` 文件中配置以下环境变量：

```bash
# Casdoor 配置
CASDOOR_ENDPOINT="https://your-casdoor-domain.com" # Casdoor 服务地址
CASDOOR_CLIENT_ID="your-client-id"                 # 应用 Client ID
CASDOOR_CLIENT_SECRET="your-client-secret"         # 应用 Client Secret
```

配置完成后，系统会自动识别并启用 Casdoor 登录策略。

#### 多环境部署与回调地址代理

在 Vercel 等平台进行多环境部署时，GitHub OAuth App 通常只能配置单一的回调地址。为了解决这个问题，项目可以使用 [VoiceHub-Auth-Broker](https://github.com/laoshuikaixue/VoiceHub-Auth-Broker) 中间件，具体使用方法可见仓库内的文档。

该中间件可以作为统一的回调入口，根据 `state` 参数动态转发回调请求到正确的部署环境，从而实现一个 GitHub OAuth App 支持无限个预览/生产环境。详情请参考该项目文档。

#### 前端图标配置

当添加了新的服务端 OAuth 策略后，如果需要在前端登录页面显示对应的图标按钮，请按照以下步骤操作：

1.  在 `app/components/Auth/Providers` 目录下创建一个以 Provider 名称（首字母大写）命名的文件夹，例如 `Google`。
2.  在该文件夹内创建一个 `Icon.vue` 组件，放入对应的 SVG 图标代码。
    - 建议 SVG 大小设置为 `w-5 h-5` 以保持样式统一。
3.  系统会自动检测并加载该图标，无需额外配置。

例如：`app/components/Auth/Providers/Google/Icon.vue`

**注意：** 对于 Casdoor，请创建 `app/components/Auth/Providers/Casdoor/Icon.vue`，并填入 Casdoor 的图标代码。

#### OAuth 工具函数

为了统一前端 OAuth 提供商的名称显示，系统提供了 `getProviderDisplayName` 工具函数。

**位置**: `app/utils/oauth.ts`

**使用方法**:

```typescript
import { getProviderDisplayName } from '~/utils/oauth'

// 获取显示名称
const displayName = getProviderDisplayName('github') // 返回 "GitHub"
const displayName2 = getProviderDisplayName('casdoor') // 返回 "Casdoor"
const displayName3 = getProviderDisplayName('google') // 返回 "Google" (默认首字母大写)
```

**扩展**:
当添加新的 OAuth 提供商时，可以在 `app/utils/oauth.ts` 的 `map` 对象中添加对应的映射关系，以实现自定义显示名称。

#### 添加绑定卡片

为了在账号管理页面显示新添加的 OAuth 提供商绑定选项，你需要修改 `app/components/Auth/OAuthBindingCard.vue` 文件。

**1. 添加计算属性**

在 `<script setup>` 中，添加用于获取特定提供商身份信息的计算属性：

```javascript
const googleIdentity = computed(() => identities.value.find((i) => i.provider === 'google'))
```

**2. 添加卡片模板**

在 `<template>` 中添加对应的卡片代码。你可以复制现有的卡片代码并进行修改：

```vue
<!-- Google (如果启用) -->
<div v-if="config.public.oauth.google" :class="itemClass">
  <div class="flex items-center gap-4">
    <div class="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 text-zinc-100">
      <!-- 引入你之前创建的图标组件 -->
      <AuthProvidersGoogleIcon class="w-5 h-5" />
    </div>
    <div class="flex flex-col">
      <span class="text-sm font-bold text-zinc-200">Google</span>
      <span v-if="googleIdentity" class="text-[11px] text-blue-500 font-medium mt-0.5">{{ googleIdentity.providerUsername }}</span>
      <span v-else class="text-[11px] text-zinc-500 mt-0.5">未绑定</span>
    </div>
  </div>

  <button
      v-if="googleIdentity"
      class="..."
      @click="confirmUnbind('google')"
      :disabled="actionLoading"
  >
    {{ actionLoading ? '处理中...' : '解绑' }}
  </button>
  <button
      v-else
      class="..."
      @click="handleBind('google')"
      :disabled="actionLoading"
  >
    {{ actionLoading ? '跳转中...' : '立即绑定' }}
  </button>
</div>
```

**3. 更新解绑确认逻辑**

修改 `confirmUnbind` 方法，添加新提供商的显示名称映射：

```javascript
const confirmUnbind = (provider) => {
  let providerName = ''
  switch (provider) {
    case 'github':
      providerName = 'GitHub'
      break
    case 'casdoor':
      providerName = 'Casdoor'
      break
    case 'google':
      providerName = 'Google'
      break // <--- 添加这一行
    default:
      providerName = provider
  }
  // ...
}
```

---

### 音源扩展开发指南

VoiceHub 采用了模块化的音源架构，支持多音源故障转移和动态扩展。开发者可以轻松添加新的音乐API源，提高系统的可用性和音乐资源覆盖率。

#### 音源架构概述

音源系统由以下核心组件构成：

- **音源配置文件** (`app/utils/musicSources.ts`)：定义音源接口、配置和默认设置
- **音源管理器** (`app/composables/useMusicSources.ts`)：提供多音源搜索、故障转移和状态监控
- **数据转换层**：统一不同API的响应格式
- **故障转移机制**：自动切换到可用的备用音源

#### 音源接口定义

每个音源都必须实现以下接口：

```typescript
export interface MusicSource {
  /** 音源唯一标识 */
  id: string
  /** 音源显示名称 */
  name: string
  /** API基础URL */
  baseUrl: string
  /** 优先级，数字越小优先级越高 */
  priority: number
  /** 是否启用 */
  enabled: boolean
  /** 请求超时时间（毫秒），可选 */
  timeout?: number
  /** 自定义请求头，可选 */
  headers?: Record<string, string>
}
```

#### 如何添加新音源

##### 1. 在配置文件中添加音源

编辑 `app/utils/musicSources.ts` 文件，在 `MUSIC_SOURCE_CONFIG.sources` 数组中添加新音源：

```
{
  id: 'my-new-source',
  name: '我的新音源',
  baseUrl: 'https://api.example.com',
  priority: 6, // 设置优先级
  enabled: true,
  timeout: 8000,
  headers: {
    // ...
  }
}
```

##### 2. 实现数据转换函数

在 `app/composables/useMusicSources.ts` 中的 `searchWithSource` 函数里添加新音源的处理逻辑：

```typescript
if (source.id === 'my-new-source') {
  // 构建API请求URL
  url = `${source.baseUrl}/search?q=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}`

  // 定义响应数据转换函数
  transformResponse = (data: any) => transformMyNewSourceResponse(data)
}
```

##### 3. 编写数据转换函数

创建对应的数据转换函数，将API响应转换为统一格式：

```typescript
const transformMyNewSourceResponse = (response: any): any[] => {
  if (!response || !response.data) {
    throw new Error('API响应数据为空')
  }

  return response.data.map((song: any) => ({
    id: song.songId,
    title: song.songName,
    artist: song.artistName || '未知艺术家',
    cover: song.albumCover,
    album: song.albumName,
    duration: song.duration,
    musicPlatform: 'my-platform',
    musicId: song.songId?.toString(),
    sourceInfo: {
      source: 'my-new-source',
      originalId: song.songId?.toString(),
      fetchedAt: new Date()
    }
  }))
}
```

#### 音源配置说明

##### 优先级设置

- **priority**: 数字越小优先级越高
- 系统会按优先级顺序尝试音源

##### 超时配置

- **timeout**: 单个请求的超时时间（毫秒）
- 建议设置为5000-10000ms

##### 请求头配置

- **headers**: 自定义HTTP请求头
- 常用于设置User-Agent、Authorization等

#### 数据转换函数编写

##### 统一数据格式

所有音源的搜索结果都应转换为以下统一格式：

```
{
  id: string | number,           // 歌曲ID
  title: string,                 // 歌曲标题
  artist: string,                // 艺术家（多个艺术家使用 / 分隔）
  cover?: string,                // 封面图片URL
  album?: string,                // 专辑名称
  duration?: number,             // 时长（秒）
  musicPlatform: string,         // 音乐平台标识
  musicId: string,               // 音乐平台的歌曲ID
  sourceInfo: {                  // 音源信息
    source: string,              // 音源ID
    originalId: string,          // 原始ID
    fetchedAt: Date             // 获取时间
  }
}
```

**注意**：为了确保歌曲重复匹配判断的准确性，所有音源返回的歌手信息都应使用 `/` 作为分隔符。例如：

- 单个歌手：`"周深"`
- 多个歌手：`"颜人中/VaVa娃娃"`

这是为了保证各个音源的歌手格式保持一致，避免因分隔符不同导致的重复歌曲匹配失效。

##### 错误处理

数据转换函数应包含完善的错误处理：

```typescript
const transformResponse = (response: any): any[] => {
  // 检查响应状态
  if (response.code !== 200) {
    throw new Error(`API错误: ${response.message} (code: ${response.code})`)
  }

  // 检查数据存在性
  if (!response.data || !Array.isArray(response.data)) {
    throw new Error('API响应数据格式错误')
  }

  // 转换数据
  return response.data
    .map((item: any) => {
      // 验证必要字段
      if (!item.id || !item.title) {
        console.warn('跳过无效歌曲数据:', item)
        return null
      }

      return {
        // ... 转换逻辑
      }
    })
    .filter(Boolean) // 过滤掉null值
}
```

#### 故障转移机制

系统内置了自动故障转移机制：

##### 工作原理

1. **按优先级尝试**：系统按priority从小到大的顺序尝试音源
2. **错误检测**：当音源请求失败时，自动记录错误并尝试下一个音源
3. **状态监控**：实时监控各音源的可用性和响应时间
4. **智能重试**：支持配置重试次数和重试间隔

##### 故障转移配置

```typescript
export const MUSIC_SOURCE_CONFIG: MusicSourceConfig = {
  primarySource: 'vkeys', // 主音源ID
  enableFailover: true, // 启用故障转移
  timeout: 10000, // 默认超时时间
  retryAttempts: 2, // 重试次数
  sources: [
    /* 音源列表 */
  ]
}
```

#### 开发示例

以下是一个完整的音源扩展示例，展示如何添加一个虚构的"MusicAPI"音源：

##### 1. 添加音源配置

```
// app/utils/musicSources.ts
{
  id: 'music-api',
  name: 'MusicAPI音源',
  baseUrl: 'https://api.musicapi.com/v1',
  priority: 4,
  enabled: true,
  timeout: 8000,
  headers: {
    'User-Agent': 'VoiceHub/1.0',
    'X-API-Key': 'your-api-key'
  }
}
```

##### 2. 实现搜索逻辑

```typescript
// app/composables/useMusicSources.ts
if (source.id === 'music-api') {
  url = `${source.baseUrl}/search?query=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}&type=song`
  transformResponse = (data: any) => transformMusicApiResponse(data)
}
```

##### 3. 数据转换函数

```typescript
const transformMusicApiResponse = (response: any): any[] => {
  console.log('[transformMusicApiResponse] 开始转换数据:', response)

  if (!response || response.status !== 'success') {
    throw new Error(`MusicAPI错误: ${response.message || '未知错误'}`)
  }

  if (!response.results || !Array.isArray(response.results)) {
    throw new Error('MusicAPI响应数据格式错误')
  }

  return response.results
    .map((song: any) => {
      if (!song.id || !song.name) {
        console.warn('[transformMusicApiResponse] 跳过无效歌曲:', song)
        return null
      }

      return {
        id: song.id,
        title: song.name,
        artist: song.artists?.map((a: any) => a.name).join('/') || '未知艺术家',
        cover: song.album?.cover_url,
        album: song.album?.name,
        duration: song.duration_ms ? Math.floor(song.duration_ms / 1000) : undefined,
        musicPlatform: 'musicapi',
        musicId: song.id.toString(),
        sourceInfo: {
          source: 'music-api',
          originalId: song.id.toString(),
          fetchedAt: new Date(),
          // 保存额外信息供后续使用
          popularity: song.popularity,
          explicit: song.explicit
        }
      }
    })
    .filter(Boolean)
}
```

## 音乐服务免责声明

VoiceHub是一个开源的校园广播站点歌管理系统，本项目：

**不提供音乐内容**：

- 本系统不存储、不提供任何音乐文件
- 不提供音乐下载、上传或分享服务
- 所有音乐内容均来自第三方音乐平台

**第三方API使用**：

- 本系统仅使用第三方API实现音乐搜索和获取播放链接等功能
- 音乐内容的版权归原音乐平台和版权方所有
- 用户播放的音乐内容受相应音乐平台的服务条款约束

**法律声明**：

- 如有版权方认为本系统侵犯了其权益，请联系我们，我们将积极配合处理
- 本系统开发者不承担因使用第三方音乐服务而产生的任何法律责任
- 用户使用本系统即表示理解并同意上述条款

## 致谢

### UI设计

特别感谢 [过客是个铁憨憨](https://github.com/1811304592) 为本项目提供首页UI样式设计

感谢 [Awesome Iwb](https://github.com/awesome-iwb) 项目提供的统一遮罩风格的图标

### 贡献者

Thanks goes to these wonderful people:

[![Contributors](https://contrib.rocks/image?repo=laoshuikaixue/VoiceHub&repo=laoshuikaixue/VoiceHub-docs&repo=laoshuikaixue/VoiceHub-hmos)](https://github.com/laoshuikaixue/VoiceHub/graphs/contributors)

### 参考项目

本项目在开发过程中参考和使用了以下优秀的开源项目和API服务：

- [落月API](https://doc.vkeys.cn/api-doc/)
- [NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)
- [meting-api](https://github.com/injahow/meting-api)
- [lx-music-desktop](https://github.com/lyswhut/lx-music-desktop) (搜索功能参考)
- [the1068fm - 深中风华子衿广播站点歌系统](https://github.com/SMS-COSMO/the1068fm)
- [Sound-of-experiment - 实验之声广播站点歌系统](https://github.com/ljk743121/Sound-of-experiment) (哔哩哔哩音源参考)
- [SPlayer](https://github.com/imsyy/SPlayer)
- [official-website - Sparkinit](https://github.com/Sparkinit/official-website)

## 许可证

[GPL-3.0](LICENSE)

## 星标历史

<picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=laoshuikaixue/VoiceHub&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=laoshuikaixue/VoiceHub&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=laoshuikaixue/VoiceHub&type=Date" />
 </picture>

## 其他

本项目有对应的原生鸿蒙版本：https://github.com/laoshuikaixue/VoiceHub-hmos

该项目通过创新的混合架构设计，实现了Web端Vue音频播放器与鸿蒙原生端的跨平台音频控制同步

---

Powered By LaoShui @ 2025-2026
