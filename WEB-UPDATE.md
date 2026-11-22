# Docker 网页应用升级

自建 Docker 环境可在应用容器中运行 `node scripts/web-update/supervisor.mjs`。在 Compose 中保留原数据库，将独立卷挂载到 `/var/lib/voicehub-updates`，并设置 `VOICEHUB_UPDATE_DIR` 与 `VOICEHUB_UPDATE_PUBLIC_KEY`。后者指向以只读方式挂载到容器内的 Ed25519 发布公钥文件。新站点先通过常规流程迁移和初始化。

超级管理员在「系统设置 → 系统升级」上传签名 `.vhu`，上限 512 MiB。目标版本须比当前新，允许跨过中间版本。包必须由受信公钥验证，并匹配目标的操作系统、架构、Node 主版本、依赖锁文件及数据库迁移指纹。涉及运行环境或数据库迁移的变更使用常规 Compose 升级。使用代理时需转发 Content-Length，且代理的上传限制须允许所用文件大小。

播出或无人值守期间拒绝切换。应用管理器校验归档，执行 PostgreSQL 自定义格式备份并检查目录、生成 SHA-256，最后试启动应用。备份失败时保持原应用，启动失败时自动恢复。后台回退也会先备份。更新状态和数据库备份保存在应用的更新卷中。

发布者在匹配目标平台的可信构建环境中，使用 `node scripts/web-update/sign.mjs <Ed25519 私钥> <输出.vhu>` 打包。将私钥与部署隔离。候补保留项目的原版版本号、主页标志及开源项目链接，安装升级包不需要 Docker Socket。
