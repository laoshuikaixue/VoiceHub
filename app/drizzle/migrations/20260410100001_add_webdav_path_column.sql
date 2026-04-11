-- 添加 webdav_path 列到 backup_schedules 表
ALTER TABLE "backup_schedules" ADD COLUMN IF NOT EXISTS "webdav_path" varchar(1000) DEFAULT '/backups';