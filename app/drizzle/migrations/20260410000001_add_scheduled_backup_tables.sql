-- 备份调度配置表
CREATE TABLE IF NOT EXISTS "backup_schedules" (
    "id" serial PRIMARY KEY,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "name" varchar(255) NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "schedule_type" varchar(50) NOT NULL,
    "schedule_time" time,
    "schedule_day" integer,
    "cron_expression" varchar(100),
    "backup_type" varchar(50) DEFAULT 'all' NOT NULL,
    "include_system_data" boolean DEFAULT true NOT NULL,
    "upload_enabled" boolean DEFAULT false NOT NULL,
    "upload_type" varchar(50),
    "s3_endpoint" varchar(500),
    "s3_bucket" varchar(255),
    "s3_access_key" varchar(255),
    "s3_secret_key" varchar(255),
    "s3_region" varchar(100),
    "webdav_url" varchar(500),
    "webdav_username" varchar(255),
    "webdav_password" varchar(255),
    "retention_type" varchar(50),
    "retention_value" integer DEFAULT 7,
    "created_by" integer,
    CONSTRAINT "backup_schedules_schedule_type_check" CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'cron')),
    CONSTRAINT "backup_schedules_upload_type_check" CHECK (upload_type IS NULL OR upload_type IN ('s3', 'webdav')),
    CONSTRAINT "backup_schedules_retention_type_check" CHECK (retention_type IS NULL OR retention_type IN ('days', 'count'))
);

-- 备份历史记录表
CREATE TABLE IF NOT EXISTS "backup_history" (
    "id" serial PRIMARY KEY,
    "schedule_id" integer REFERENCES "backup_schedules"("id") ON DELETE SET NULL,
    "filename" varchar(255) NOT NULL,
    "file_size" bigint,
    "status" varchar(50) NOT NULL,
    "error_message" text,
    "checksum" varchar(64),
    "local_path" varchar(500),
    "remote_path" varchar(500),
    "executed_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "backup_history_status_check" CHECK (status IN ('success', 'failed', 'uploaded', 'upload_failed'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "backup_history_schedule_id_idx" ON "backup_history"("schedule_id");
CREATE INDEX IF NOT EXISTS "backup_history_executed_at_idx" ON "backup_history"("executed_at");
CREATE INDEX IF NOT EXISTS "backup_history_status_idx" ON "backup_history"("status");