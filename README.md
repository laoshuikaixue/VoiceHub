# VoiceHub - 校园广播站点歌系统

这是一个使用Nuxt 3全栈框架开发的校园广播站点歌系统。系统实现了用户点歌、投票、后台排期管理以及歌单公示等功能，支持管理员通过拖拽方式进行排期管理。

## 主要功能

- **用户管理**：注册、登录、权限控制
- **点歌系统**：用户可以点歌或给已有歌曲投票
- **歌曲管理**：按热度排序，避免重复播放
- **排期管理**：管理员可以通过拖拽界面进行歌曲排期和顺序管理
- **公开展示**：公开展示歌曲播放排期，按日期分组展示
- **现代UI**：响应式设计，玻璃态UI，流畅的动画效果

## 技术栈

- **前端**：Nuxt 3、Vue 3、TypeScript
- **后端**：Nuxt 3 Serverless API
- **数据库**：PostgreSQL
- **ORM**：Prisma
- **认证**：JWT Token认证
- **样式**：CSS变量，自定义动画

## 系统架构

系统采用了Nuxt 3的全栈架构：
- 使用Nuxt 3的服务端API构建后端服务
- 使用Vue 3组合式API构建前端组件
- 使用Prisma ORM连接PostgreSQL数据库
- 使用JWT进行用户认证和授权

## 安装与运行

### 前提条件
- Node.js 16+
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

7. 启动开发服务器
```bash
npm run dev
```

8. 构建生产版本
```bash
npm run build
```

9. 运行生产版本
```bash
npm run start
```

## 环境变量说明

| 变量名          | 必填 | 说明                          |
|--------------|----|-----------------------------|
| DATABASE_URL | 是  | PostgreSQL数据库连接字符串          |
| JWT_SECRET   | 是  | JWT令牌签名密钥，建议使用强随机字符串        |
| PORT         | 否  | 应用运行端口，默认为3000              |
| NODE_ENV     | 否  | 运行环境，development或production |

## 项目结构

```
VoiceHub/
├── app.vue                # 应用入口
├── assets/                # 静态资源
├── components/            # 可复用组件
│   ├── Admin/             # 管理员组件
│   ├── Auth/              # 认证相关组件
│   └── Songs/             # 歌曲相关组件
├── composables/           # 组合式API函数
├── pages/                 # 页面组件
├── plugins/               # 插件
├── prisma/                # Prisma ORM配置
│   ├── migrations/        # 数据库迁移
│   └── schema.prisma      # 数据库模型
├── public/                # 公共资源
├── scripts/               # 工具脚本
├── server/                # 服务端API
│   ├── api/               # API端点
│   ├── middleware/        # 中间件
│   └── models/            # 服务端模型
└── types/                 # TypeScript类型定义
```

## 使用说明

### 普通用户
1. 访问主页，查看当前排期
2. 注册/登录账号
3. 在仪表盘中点歌或给喜欢的歌曲投票

### 管理员
1. 使用管理员账号登录（默认账号：admin@example.com，密码：admin123）
2. 进入管理后台，可以看到左侧"待排歌曲"和右侧"播放顺序"
3. 通过拖拽将歌曲从左侧添加到右侧的排期列表
4. 可以在右侧拖拽调整歌曲播放顺序
5. 点击"保存顺序"按钮保存排期

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

## 开发指南

### 组合式API

项目使用了Vue 3的组合式API，主要包括：

- `useAuth`: 处理用户认证、登录、注册和权限控制
- `useSongs`: 处理歌曲相关操作，包括获取歌曲列表、点歌和投票
- `useAdmin`: 处理管理员操作，包括排期管理和标记播放

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

## 许可证

[MIT](LICENSE)
