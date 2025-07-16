# VoiceHub - 校园广播站点歌系统

这是一个使用Nuxt 3全栈框架开发的校园广播站点歌系统。系统实现了用户点歌、投票、后台排期管理以及歌单公示等功能，支持管理员通过拖拽方式进行排期管理。

## 项目截图
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/0ac138b4-4fb8-4478-a326-07e8f1128671" />
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/1d8bcdaf-adf7-403b-99f1-9d54a550f086" />
<img width="3200" height="1998" alt="image" src="https://github.com/user-attachments/assets/c5b13bc3-798c-4cd0-bf77-0876b583c73f" />

## 主要功能

- **用户管理**：管理员添加用户，支持按年级班级分类
- **点歌系统**：用户可以点歌或给已有歌曲投票
- **歌曲管理**：按热度排序，避免重复播放
- **排期管理**：管理员可以通过拖拽界面进行歌曲排期和顺序管理
- **公开展示**：公开展示歌曲播放排期，按日期分组展示
- **通知系统**：实时通知功能，包括歌曲被选中、投票和系统通知
- **现代UI**：响应式设计，玻璃态UI，流畅的动画效果
- **数据库自检**：自动数据库验证和修复机制，确保系统稳定性

## 技术栈

- **前端**：Nuxt 3、Vue 3、TypeScript
- **后端**：Nuxt 3 Serverless API
- **数据库**：PostgreSQL
- **ORM**：Prisma
- **认证**：JWT Token认证
- **样式**：CSS变量，自定义动画
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

## 环境变量说明

| 变量名                          | 必填 | 说明                                |
|------------------------------|----|-----------------------------------|
| DATABASE_URL                 | 是  | PostgreSQL数据库连接字符串                |
| JWT_SECRET                   | 是  | JWT令牌签名密钥，建议使用强随机字符串              |
| NODE_ENV                     | 否  | 运行环境，development或production       |
| NITRO_PRESET                 | 否  | Nitro预设，部署到Netlify时自动设置为'netlify' |
| NUXT_PUBLIC_SITE_TITLE       | 否  | 站点标题，默认为"校园广播站点歌系统"               |
| NUXT_PUBLIC_SITE_LOGO        | 否  | 站点Logo URL                        |
| NUXT_PUBLIC_SITE_DESCRIPTION | 否  | 站点描述                              |

## 项目结构

```
VoiceHub/
├── app.vue                # 应用入口
├── assets/                # 静态资源
│   └── css/               # CSS样式文件
│       └── main.css       # 主样式文件
├── components/            # 可复用组件
│   ├── Admin/             # 管理员组件
│   │   ├── NotificationSender.vue # 通知发送组件
│   │   ├── PlayTimeManager.vue    # 播放时间管理组件
│   │   ├── ScheduleForm.vue       # 排期表单组件
│   │   └── UserManager.vue        # 用户管理组件
│   ├── Auth/              # 认证相关组件
│   │   ├── ChangePasswordForm.vue # 修改密码表单
│   │   └── LoginForm.vue         # 登录表单
│   ├── Notifications/     # 通知相关组件
│   │   ├── NotificationIcon.vue   # 通知图标组件
│   │   └── NotificationSettings.vue # 通知设置组件
│   ├── Songs/             # 歌曲相关组件
│   │   ├── RequestForm.vue        # 点歌表单
│   │   ├── ScheduleList.vue       # 排期列表
│   │   └── SongList.vue           # 歌曲列表
│   └── UI/                # 通用UI组件
│       └── ProgressBar.vue         # 进度条组件
├── composables/           # 组合式API函数
│   ├── useAdmin.ts         # 管理员功能hooks
│   ├── useAuth.ts          # 认证功能hooks
│   ├── useNotifications.ts # 通知功能hooks
│   ├── useProgress.ts      # 进度条功能hooks
│   ├── useProgressEvents.ts # 进度事件功能hooks
│   └── useSongs.ts         # 歌曲功能hooks
├── pages/                 # 页面组件
│   ├── change-password.vue # 修改密码页面
│   ├── dashboard.vue       # 仪表盘页面
│   ├── index.vue           # 首页
│   ├── login.vue           # 登录页面
│   └── notifications.vue   # 通知页面
├── plugins/               # 插件
│   ├── auth.client.ts      # 客户端认证插件
│   └── prisma.ts           # Prisma插件
├── prisma/                # Prisma ORM配置
│   ├── client.ts           # Prisma客户端
│   ├── migrations/         # 数据库迁移
│   └── schema.prisma      # 数据库模型
├── public/                # 公共资源
│   ├── favicon.ico         # 网站图标
│   ├── images/             # 图片资源
│   │   ├── logo.svg        # 网站Logo
│   │   └── thumbs-up.svg   # 点赞图标
│   └── robots.txt          # 爬虫规则
├── scripts/               # 工具脚本
│   ├── check-database.js   # 数据库检查工具
│   ├── clear-database.js   # 数据库清理工具
│   ├── create-admin.js     # 创建管理员账户
│   ├── fix-database-validation.js # 修复数据库验证
│   ├── package.json        # 脚本依赖配置
│   └── repair-database.js  # 数据库修复工具
├── server/                # 服务端API
│   ├── api/                # API端点
│   │   ├── admin/          # 管理员API
│   │   │   ├── backup/     # 备份相关API
│   │   │   ├── mark-played.post.ts  # 标记已播放API
│   │   │   ├── notifications/       # 管理员通知API
│   │   │   ├── play-times/          # 播放时间管理API
│   │   │   ├── schedule/            # 排期管理API
│   │   │   ├── songs/               # 管理员歌曲管理API
│   │   │   ├── system-settings/     # 系统设置API
│   │   │   └── users/               # 用户管理API
│   │   ├── auth/           # 认证API
│   │   ├── notifications/  # 通知API
│   │   ├── play-times/     # 播放时间API
│   │   ├── progress/       # 进度API
│   │   └── songs/          # 歌曲API
│   ├── middleware/         # 中间件
│   │   └── auth.ts         # 认证中间件
│   ├── models/             # 服务端模型
│   │   └── schema.ts       # 数据模型
│   ├── plugins/            # 服务端插件
│   │   └── prisma.ts       # Prisma服务端插件
│   ├── services/           # 服务层
│   │   └── notificationService.ts # 通知服务
│   └── tsconfig.json       # 服务端TypeScript配置
├── types/                 # TypeScript类型定义
│   └── index.ts            # 全局类型定义
├── .env                   # 环境变量(需自行创建)
├── .env.example           # 环境变量示例
├── .gitignore             # Git忽略文件
├── .vercelignore          # Vercel忽略文件
├── LICENSE                # 许可证文件
├── netlify.toml           # Netlify部署配置
├── nuxt.config.ts         # Nuxt配置
├── package.json           # 项目依赖
├── tsconfig.json          # TypeScript配置
└── vercel.json            # Vercel部署配置
```

## 使用说明

### 普通用户
1. 访问主页，查看当前排期
2. 注册/登录账号
3. 在仪表盘中点歌或给喜欢的歌曲投票
4. 查看通知中心获取歌曲状态更新

### 管理员
1. 使用管理员账号登录（默认账号：admin，密码：admin123）
2. 进入管理后台，选择相应功能标签
3. **排期管理**：可以看到左侧"待排歌曲"和右侧"播放顺序"
   - 通过拖拽将歌曲从左侧添加到右侧的排期列表
   - 可以在右侧拖拽调整歌曲播放顺序
   - 点击"保存顺序"按钮保存排期
4. **歌曲管理**：查看和管理所有歌曲
5. **用户管理**：添加、编辑和删除用户
   - 单个添加：填写用户信息（包括姓名、账号、年级、班级）
   - 批量导入：通过EXCEL文件批量添加用户
   - 可以重置用户密码
6. **通知管理**：向用户发送系统通知
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

### 通知不显示内容

如果通知只显示标题但不显示内容，可能是数据库模型与前端模型不匹配。运行修复工具：
```bash
cd scripts && npm run repair-db
```

## 开发指南

### 组合式API

项目使用了Vue 3的组合式API，主要包括：

- `useAuth`: 处理用户认证、登录、注册和权限控制
- `useSongs`: 处理歌曲相关操作，包括获取歌曲列表、点歌和投票
- `useAdmin`: 处理管理员操作，包括排期管理和标记播放
- `useNotifications`: 处理通知系统，包括获取、标记已读和设置

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

## 致谢

特别感谢 [过客是个铁憨憨](https://github.com/1811304592) 为本项目提供全新UI设计。

## 许可证

[GPL-3.0](LICENSE)
