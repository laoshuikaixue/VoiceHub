# VoiceHub - 校园广播站点歌系统

这是一个使用Nuxt 3全栈框架开发的校园广播站点歌系统。系统实现了用户点歌、投票、后台排期管理以及歌单公示等功能，支持管理员通过拖拽方式进行排期管理。

## 项目截图
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/db932613-6694-47ec-9f2e-5379c833591f" />
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/719006eb-ab53-4ad1-af4a-882ce8d481db" />
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/f721792e-e251-4914-8e15-e929fd424d07" />
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/71ef19fd-e380-4358-b44e-3b4229a2273b" />
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/4cef5807-a3ea-4096-94be-80acdc5d8a76" />
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/ab7273a1-820b-4537-ad05-34bbbde9e572" />

## 主要功能

### 🎵 核心功能
- **智能点歌系统**：用户可以点歌或给已有歌曲投票，支持网易云音乐和QQ音乐搜索
- **歌曲管理**：按热度排序，避免重复播放，动态URL防止链接过期
- **音乐播放器**：内置音乐播放器，支持进度控制和音质实时切换
- **音质切换**：支持多种音质选择（标准、HQ、无损、Hi-Res等），动态获取最新播放链接
- **音乐下载功能**：支持管理员下载歌曲到本地，提供多种音质选择和批量下载

### 👥 用户管理
- **用户管理**：管理员添加用户，支持按年级班级分类
- **权限控制**：多级权限管理，支持普通用户、管理员、超级管理员
- **黑名单管理**：支持歌曲和艺术家黑名单，自动过滤不当内容

### 📅 排期管理
- **排期管理**：管理员可以通过拖拽界面进行歌曲排期和顺序管理
- **播出时段**：灵活配置播出时段，**支持多时段管理**
- **打印排期**：支持自定义纸张大小、内容选择和PDF导出的打印功能
- **学期管理**：管理员可设置当前学期，自动关联点歌记录
- **公开展示**：公开展示歌曲播放排期，按日期分组展示

### 🔔 通知系统
- **实时通知**：歌曲被选中、投票和系统通知
- **通知设置**：用户可自定义通知偏好
- **批量通知**：管理员可向特定用户群体发送通知

### 💾 数据管理
- **数据库备份**：完整的数据库备份和恢复功能
- **文件导入导出**：支持备份文件的上传、下载和管理
- **数据库自检**：自动数据库验证和修复机制，确保系统稳定性

### 🎨 用户体验
- **现代UI**：响应式设计，深色主题，流畅的动画效果
- **玻璃态设计**：现代化的视觉效果和交互体验
- **移动端优化**：适配支持移动设备访问

## 技术栈

- **前端**：Nuxt 3、Vue 3、TypeScript
- **后端**：Nuxt 3 Serverless API
- **数据库**：PostgreSQL
- **ORM**：Prisma
- **认证**：JWT Token认证
- **音乐API**：网易云音乐、QQ音乐第三方API
- **代理服务**：HTTP/HTTPS代理，解决混合内容问题，支持Range请求和缓存
- **打印导出**：jsPDF、html2canvas，支持PDF生成和图片处理
- **样式**：CSS变量，自定义动画，玻璃态设计
- **部署**：支持Vercel和Netlify一键部署

## 系统架构

系统采用了Nuxt 3的全栈架构：
- 使用Nuxt 3的服务端API构建后端服务
- 使用Vue 3组合式API构建前端组件
- 使用Prisma ORM连接PostgreSQL数据库
- 使用JWT进行用户认证和授权
- 数据库自检和自动修复机制

## 部署指南

### 一键部署

本项目可以一键部署到Vercel/Netlify平台：

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/laoshuikaixue/VoiceHub&env=DATABASE_URL,JWT_SECRET&envDescription=需要配置数据库连接和JWT密钥&envLink=https://github.com/laoshuikaixue/VoiceHub#环境变量说明)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/laoshuikaixue/VoiceHub)

在部署过程中，需要输入必要的环境变量：
1. `DATABASE_URL`：PostgreSQL数据库连接字符串
2. `JWT_SECRET`：JWT令牌签名密钥

您可以参考[环境变量说明](#环境变量说明)了解更多详情。

### 其他平台部署

1. 构建生产版本
   ```bash
   npm run build
   ```

2. 设置环境变量
   确保设置了必要的环境变量（DATABASE_URL和JWT_SECRET）

3. 启动应用
   ```bash
   npm run start
   ```

## 安装与运行

### 前提条件
- Node.js 20+
- PostgreSQL数据库

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/laoshuikaixue/VoiceHub.git
cd VoiceHub
```

2. 安装依赖
```bash
npm install
```

3. 设置环境变量
复制`.env.example`文件并重命名为`.env`，然后修改其中的配置：
```bash
cp .env.example .env
```

4. 编辑`.env`文件，设置数据库连接和JWT密钥：
```
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
JWT_SECRET="your-very-secure-jwt-secret-key"
```

5. 初始化数据库和Prisma客户端
```bash
npx prisma generate
npx prisma migrate deploy
```

6. 创建管理员账户
```bash
node scripts/create-admin.js
```

7. 数据库验证和修复
```bash
# 检查数据库结构和完整性
cd scripts && npm run check-db

# 修复数据库问题
cd scripts && npm run repair-db
```

8. 启动开发服务器
```bash
npm run dev
```

9. 构建生产版本
```bash
npm run build
```

10. 运行生产版本
```bash
npm run start
```

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
- **超级管理员**：拥有所有系统权限，包括用户管理、系统配置等
- **管理员**：拥有日常管理权限，如排期管理、歌曲管理等
- **普通用户**：基本的点歌、投票和查看权限

#### 权限分类
- **用户管理权限**：创建、编辑、删除用户账户
- **歌曲管理权限**：管理歌曲库、黑名单、排期等
- **系统配置权限**：修改系统设置、站点配置等
- **数据管理权限**：数据库备份、恢复、导入导出等
- **通知管理权限**：发送系统通知、管理通知设置等

#### 权限继承
- 权限采用继承机制，高级角色自动拥有低级角色的所有权限
- 支持动态权限检查，确保用户只能访问授权的功能
- 前端和后端双重权限验证，确保系统安全性


## 环境变量说明

| 变量名          | 必填 | 说明                                | 示例值                                                                 |
|--------------|----|-----------------------------------|---------------------------------------------------------------------|
| DATABASE_URL | 是  | PostgreSQL数据库连接字符串                | `postgresql://username:password@host:port/database?sslmode=require` |
| JWT_SECRET   | 是  | JWT令牌签名密钥，建议使用强随机字符串              | `your-very-secure-jwt-secret-key-with-at-least-32-characters`       |
| NODE_ENV     | 否  | 运行环境，development或production       | `production`                                                        |
| NITRO_PRESET | 否  | Nitro预设，部署到Netlify时自动设置为'netlify' | `netlify`                                                           |


## 项目结构

```
VoiceHub/
├── app.vue                # 应用入口文件
├── assets/                # 静态资源目录
│   └── css/               # CSS样式文件
│       ├── components.css      # 组件样式
│       ├── fonts.css          # 字体样式
│       ├── main.css           # 主样式文件
│       ├── mobile-admin.css   # 移动端管理样式
│       ├── print-fix.css      # 打印样式修复
│       ├── theme-protection.css # 主题保护样式
│       ├── transitions.css    # 过渡动画样式
│       └── variables.css      # CSS变量定义
├── backups/               # 数据库备份文件存储目录
├── components/            # Vue组件目录
│   ├── Admin/             # 管理员功能组件
│   │   ├── Common/        # 通用管理组件
│   │   │   ├── DataTable.vue      # 通用数据表格组件
│   │   │   ├── SearchFilter.vue   # 搜索过滤组件
│   │   │   └── StatCard.vue       # 统计卡片组件
│   │   ├── BackupManager.vue      # 数据库备份管理
│   │   ├── BlacklistManager.vue   # 黑名单管理
│   │   ├── NotificationSender.vue # 通知发送管理
│   │   ├── OverviewDashboard.vue  # 管理概览仪表板
│   │   ├── PermissionManager.vue  # 权限管理
│   │   ├── PlayTimeManager.vue    # 播放时间管理
│   │   ├── RoleManager.vue        # 角色管理
│   │   ├── ScheduleForm.vue       # 排期表单
│   │   ├── ScheduleItemPrint.vue  # 排期项目打印
│   │   ├── ScheduleManager.vue    # 排期管理
│   │   ├── SchedulePrinter.vue    # 排期打印功能
│   │   ├── SemesterManager.vue    # 学期管理
│   │   ├── SiteConfigManager.vue  # 站点配置管理
│   │   ├── SongManagement.vue     # 歌曲管理
│   │   └── UserManager.vue        # 用户管理
│   ├── Auth/              # 认证相关组件
│   │   ├── ChangePasswordForm.vue # 修改密码表单
│   │   └── LoginForm.vue         # 登录表单
│   ├── Notifications/     # 通知系统组件
│   │   ├── NotificationIcon.vue   # 通知图标
│   │   └── NotificationSettings.vue # 通知设置
│   ├── Songs/             # 歌曲相关组件
│   │   ├── RequestForm.vue        # 点歌表单（支持音乐搜索）
│   │   ├── ScheduleList.vue       # 排期列表展示
│   │   └── SongList.vue           # 歌曲列表
│   ├── UI/                # 通用UI组件
│   │   ├── Linear/        # Linear图标组件库
│   │   │   └── icons/     # 图标文件
│   │   ├── AudioPlayer.vue        # 音乐播放器
│   │   ├── ConfirmDialog.vue      # 确认对话框
│   │   ├── Icon.vue               # 图标组件
│   │   ├── Notification.vue       # 通知组件
│   │   ├── PageTransition.vue     # 页面过渡动画
│   │   └── ProgressBar.vue        # 进度条组件
│   └── SiteFooter.vue     # 站点页脚
├── composables/           # Vue 3 组合式API
│   ├── useAdmin.ts         # 管理员功能hooks
│   ├── useAudioPlayer.ts   # 音频播放器hooks
│   ├── useAudioQuality.ts  # 音质管理hooks
│   ├── useAuth.ts          # 认证功能hooks
│   ├── useNotifications.ts # 通知功能hooks
│   ├── usePermissions.ts   # 权限管理hooks
│   ├── useProgress.ts      # 进度条功能hooks
│   ├── useProgressEvents.ts # 进度事件hooks
│   ├── useSemesters.ts     # 学期管理hooks
│   ├── useSiteConfig.js    # 站点配置hooks
│   └── useSongs.ts         # 歌曲功能hooks
├── layouts/               # 布局组件
│   └── default.vue         # 默认布局模板
├── middleware/            # 中间件
│   └── auth.ts             # 认证中间件
├── pages/                 # 页面组件（Nuxt 3路由）
│   ├── change-password.vue # 修改密码页面
│   ├── dashboard.vue       # 用户仪表盘
│   ├── index.vue           # 首页
│   ├── login.vue           # 登录页面
│   └── notifications.vue   # 通知中心页面
├── plugins/               # Nuxt插件
│   ├── auth.client.ts      # 客户端认证插件
│   ├── font-loader.client.ts # 字体加载插件
│   └── prisma.ts           # Prisma ORM插件
├── prisma/                # Prisma ORM配置
│   ├── client.ts           # Prisma客户端配置
│   ├── migrations/         # 数据库迁移文件
│   └── schema.prisma      # 数据库模型定义
├── public/                # 公共静态资源
│   ├── favicon.ico         # 网站图标
│   ├── fonts/              # 字体文件
│   ├── images/             # 图片资源
│   └── robots.txt          # 搜索引擎爬虫规则
├── scripts/               # 工具脚本目录
│   ├── backup-and-migrate.js      # 用户数据备份迁移工具
│   ├── check-database.js          # 数据库检查工具
│   ├── check-deploy.js            # 部署检查工具
│   ├── clear-database.js          # 数据库清理工具
│   ├── create-admin.js            # 创建管理员账户脚本
│   ├── database-backup.js         # 完整数据库备份工具
│   ├── deploy.js                  # 自动化部署脚本
│   ├── fix-database-validation.js # 修复数据库验证问题
│   ├── init-permissions.js        # 初始化权限系统
│   ├── migrate-roles.js           # 角色系统迁移脚本
│   ├── package.json               # 脚本依赖配置
│   ├── repair-database.js         # 数据库修复工具
│   └── setup-database.js          # 数据库初始化设置
├── server/                # 服务端代码（Nuxt 3 Server API）
│   ├── api/                # API端点目录
│   │   ├── admin/          # 管理员API
│   │   │   ├── backup/     # 备份管理API
│   │   │   │   ├── export.post.ts   # 创建备份
│   │   │   │   ├── upload.post.ts   # 上传备份文件
│   │   │   │   ├── restore.post.ts  # 恢复备份
│   │   │   │   ├── list.get.ts      # 获取备份列表
│   │   │   │   ├── download/[filename].get.ts # 下载备份
│   │   │   │   └── delete/[filename].delete.ts # 删除备份
│   │   │   ├── blacklist/           # 黑名单管理API
│   │   │   ├── mark-played.post.ts  # 标记歌曲已播放
│   │   │   ├── notifications/       # 管理员通知API
│   │   │   ├── play-times/          # 播放时间管理API
│   │   │   ├── schedule/            # 排期管理API
│   │   │   ├── semesters/           # 学期管理API
│   │   │   ├── songs/               # 管理员歌曲管理API
│   │   │   ├── system-settings/     # 系统设置API
│   │   │   └── users/               # 用户管理API
│   │   ├── auth/           # 认证相关API
│   │   ├── blacklist/      # 黑名单API
│   │   ├── notifications/  # 通知系统API
│   │   ├── play-times/     # 播放时间API
│   │   ├── progress/       # 进度条API
│   │   ├── proxy/          # 代理服务API
│   │   │   ├── image.get.ts     # 图片代理（解决HTTP/HTTPS混合内容及跨域问题）
│   │   │   ├── audio.get.ts     # 音频代理（支持Range请求和缓存）
│   │   │   └── music-url.post.ts # 音乐URL代理（获取播放链接）
│   │   ├── semesters/      # 学期API
│   │   ├── site-config.get.ts # 站点配置API
│   │   ├── songs/          # 歌曲相关API
│   │   ├── system/         # 系统API
│   │   └── users/          # 用户API
│   ├── error.ts            # 全局错误处理
│   ├── middleware/         # 服务端中间件
│   │   └── auth.ts         # 认证中间件
│   ├── models/             # 数据模型
│   │   └── schema.ts       # 数据模型定义
│   ├── plugins/            # 服务端插件
│   │   ├── db-pool-init.ts # 数据库连接池初始化
│   │   ├── error-handler.ts # 错误处理插件
│   │   └── prisma.ts       # Prisma服务端插件
│   ├── services/           # 业务服务层
│   │   └── notificationService.ts # 通知服务
│   ├── utils/              # 服务端工具函数
│   │   ├── db-pool.ts      # 数据库连接池管理
│   │   ├── permissions.js  # 权限系统配置（JS版本）
│   │   └── permissions.ts  # 权限系统配置（TS版本）
│   └── tsconfig.json       # 服务端TypeScript配置
├── types/                 # TypeScript类型定义
│   ├── global.d.ts         # 全局类型定义
│   └── index.ts            # 项目类型定义
├── utils/                 # 客户端工具函数
│   └── db-manager.ts       # 数据库管理工具
├── .env.example           # 环境变量示例文件
├── .gitignore             # Git忽略文件配置
├── .vercelignore          # Vercel部署忽略文件
├── LICENSE                # 开源许可证文件
├── netlify.toml           # Netlify部署配置
├── nuxt.config.ts         # Nuxt 3主配置文件
├── package.json           # Node.js项目配置和依赖
├── README.md              # 项目说明文档
├── tsconfig.json          # TypeScript配置文件
└── vercel.json            # Vercel部署配置
```

### 目录说明

#### 核心目录
- **`components/`**: Vue组件库，按功能模块组织
- **`pages/`**: 页面组件，Nuxt 3自动路由
- **`server/api/`**: 服务端API，RESTful接口设计
- **`composables/`**: Vue 3组合式API，业务逻辑复用
- **`prisma/`**: 数据库ORM配置和迁移

#### 配置目录
- **`assets/css/`**: 样式文件，支持CSS变量和主题
- **`plugins/`**: Nuxt插件，扩展框架功能
- **`middleware/`**: 中间件，处理路由和认证
- **`types/`**: TypeScript类型定义

#### 工具目录
- **`scripts/`**: 数据库管理和部署脚本
- **`utils/`**: 工具函数库
- **`backups/`**: 数据库备份文件存储

#### 静态资源
- **`public/`**: 静态文件，直接访问
- **`public/fonts/`**: 自定义字体文件
- **`public/images/`**: 图片资源

## 使用说明

### 普通用户
1. 访问主页，查看当前排期
2. 注册/登录账号
3. 在仪表盘中点歌或给喜欢的歌曲投票
   - 支持搜索网易云音乐和QQ音乐
   - 可以试听歌曲并选择音质
   - 支持给已有歌曲投票
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
   - 点击"保存顺序"按钮保存排期
4. **打印排期**：专业的排期打印和导出功能
   - 选择纸张大小（A4、A3、Letter、Legal）和页面方向
   - 自定义显示内容：歌曲封面、歌名、歌手、投稿人、热度等
   - 快捷日期选择：今天、明天、本周、下周
   - 智能分组显示：按日期分组，有多个播出时段时自动按时间排序
   - 实时预览：所见即所得的打印预览
   - PDF导出：支持导出高质量PDF文件，自动处理跨域图片
4. **歌曲管理**：查看和管理所有歌曲
   - 支持播放歌曲并实时切换音质
   - 动态获取最新的音乐播放链接
   - 提供歌曲下载功能，支持批量下载管理
5. **学期管理**：设置和管理学期信息
   - 创建新学期（如"2024-2025学年上学期"）
   - 设置当前活跃学期
   - 点歌记录自动关联到当前学期
6. **用户管理**：添加、编辑和删除用户
   - 单个添加：填写用户信息（包括姓名、账号、年级、班级）
   - 批量导入：通过EXCEL文件批量添加用户
   - 可以重置用户密码
7. **通知管理**：向用户发送系统通知
   - 支持按全体用户、年级、班级或多班级发送
   - 实时显示发送进度和结果

## 数据库验证和修复

系统内置了自动数据库验证和修复机制，可确保数据库结构和数据一致性。

### 自动验证

应用启动时会自动验证数据库结构和完整性：

1. 检查数据库连接状态
2. 验证必要的表和字段是否存在
3. 检查数据一致性（如用户通知设置）
4. 首次部署时自动初始化数据库

### 手动验证和修复

系统提供了两个命令行工具用于手动检查和修复数据库问题：

1. **数据库检查工具**
   ```bash
   cd scripts && npm run check-db
   ```
   该工具会检查：
   - 数据库表结构完整性
   - 必要字段是否存在
   - 管理员用户是否存在
   - 用户通知设置是否完整

2. **数据库修复工具**
   ```bash
   cd scripts && npm run repair-db
   ```
   该工具提供交互式修复功能：
   - 创建缺失的管理员账户
   - 为用户添加缺失的通知设置
   - 检查表结构并给出迁移建议

## 常见问题

### Prisma客户端初始化错误

如果您在首次运行项目时遇到以下错误：
```
Error: @prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.
```

这是因为需要先生成Prisma客户端代码。请按以下步骤解决：

1. 确保已正确配置根目录的`.env`文件（包含有效的DATABASE_URL）
2. 运行以下命令生成Prisma客户端：
   ```bash
   npx prisma generate
   ```
3. 如果在Windows系统上遇到PowerShell执行策略限制，请先运行：
   ```bash
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
   然后再执行`npx prisma generate`

### 数据库迁移问题

如果遇到数据库表结构不匹配的问题：

1. 确保数据库已经最新：
   ```bash
   npx prisma migrate deploy
   ```

2. 如果还有问题，使用修复工具：
   ```bash
   cd scripts && npm run repair-db
   ```

3. 对于复杂的数据库问题，可能需要重置数据库（慎用，会删除所有数据）：
   ```bash
   npx prisma migrate reset
   ```

## HTTP/HTTPS代理服务

VoiceHub 内置了强大的代理服务系统，专门解决HTTPS环境下访问HTTP资源的混合内容问题，确保系统在各种部署环境下都能正常工作。

### 🔒 混合内容问题解决

在HTTPS环境下（如Vercel、Netlify等平台），浏览器会阻止加载HTTP资源，导致以下问题：
- 学校Logo等HTTP图片无法显示
- HTTP音频链接无法播放
- 音乐下载功能受限

VoiceHub通过以下代理API解决了这些问题：

#### 图片代理服务 (`/api/proxy/image`)
- **自动检测**：系统自动检测HTTP图片链接并通过代理访问
- **透明代理**：对用户完全透明，无需修改现有配置
- **缓存优化**：支持浏览器缓存，提高加载速度
- **错误处理**：优雅处理图片加载失败的情况

#### 音频代理服务 (`/api/proxy/audio`)
- **Range请求支持**：完整支持HTTP Range请求，实现音频的快进、快退功能
- **流式传输**：支持音频流式播放，无需等待完整下载
- **CORS处理**：自动添加必要的CORS头，确保跨域访问
- **缓存控制**：智能缓存策略，平衡性能和实时性

#### 音乐URL代理服务 (`/api/proxy/music-url`)
- **平台支持**：支持网易云音乐和QQ音乐平台
- **音质选择**：支持多种音质（128k、320k、无损、Hi-Res等）
- **智能路由**：自动判断是否需要代理，HTTPS链接直接返回
- **错误恢复**：链接失效时自动重新获取

## 数据备份功能

VoiceHub 提供了完整的数据库备份和恢复功能：

### Web界面备份管理
- **创建备份**：支持完整备份和用户数据备份
- **导入备份**：支持拖拽上传备份文件
- **文件管理**：列出、下载、删除备份文件
- **数据恢复**：支持合并模式和替换模式恢复

### 命令行备份工具
```bash
# 创建完整数据库备份
node scripts/database-backup.js backup

# 恢复数据库备份
node scripts/database-backup.js restore <备份文件路径>

# 用户数据备份迁移（兼容旧版本）
node scripts/backup-and-migrate.js
```

### 备份文件格式
- **完整备份**：包含所有数据表的JSON格式文件
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

1. 在`server/api`中添加新的API端点
2. 在`composables`中添加相应的组合式函数
3. 在`components`中创建UI组件
4. 在`pages`中整合组件和功能

### 数据库模型修改

如需修改数据库模型：

1. 编辑`prisma/schema.prisma`文件
2. 运行迁移命令：`npx prisma migrate dev --name your_migration_name`
3. 更新客户端：`npx prisma generate`
4. 确保同时更新`types/index.ts`中的TypeScript类型定义
5. 验证数据库：`cd scripts && npm run check-db`

## 音乐服务免责声明

VoiceHub是一个开源的校园广播站点歌管理系统，本项目：

**不提供音乐内容**：
- 本系统不存储、不提供任何音乐文件
- 不提供音乐下载、上传或分享服务
- 所有音乐内容均来自第三方音乐平台

**第三方API使用**：
- 本系统仅使用第三方公开API进行音乐搜索和获取播放链接
- 音乐内容的版权归原音乐平台和版权方所有
- 用户播放的音乐内容受相应音乐平台的服务条款约束

**法律声明**：
- 如有版权方认为本系统侵犯了其权益，请联系我们，我们将积极配合处理
- 本系统开发者不承担因使用第三方音乐服务而产生的任何法律责任
- 用户使用本系统即表示理解并同意上述条款

## 致谢

特别感谢 [过客是个铁憨憨](https://github.com/1811304592) 为本项目提供UI设计

## 许可证

[GPL-3.0](LICENSE)
