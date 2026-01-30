-- 创建用户状态枚举类型
CREATE TYPE "public"."user_status" AS ENUM('active', 'withdrawn');--> statement-breakpoint

-- 添加用户状态相关字段到用户表
ALTER TABLE "User" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "statusChangedAt" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "statusChangedBy" integer;--> statement-breakpoint

-- 创建用户状态变更日志表
CREATE TABLE IF NOT EXISTS "user_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"old_status" "user_status",
	"new_status" "user_status" NOT NULL,
	"reason" text,
	"operator_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "idx_user_status" ON "User" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_status_logs_user_id" ON "user_status_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_status_logs_created_at" ON "user_status_logs" USING btree ("created_at" DESC);--> statement-breakpoint

-- 添加外键约束
ALTER TABLE "User" ADD CONSTRAINT "User_statusChangedBy_User_id_fk" FOREIGN KEY ("statusChangedBy") REFERENCES "User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_status_logs" ADD CONSTRAINT "user_status_logs_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_status_logs" ADD CONSTRAINT "user_status_logs_operator_id_User_id_fk" FOREIGN KEY ("operator_id") REFERENCES "User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- 为现有用户初始化状态变更日志
INSERT INTO "user_status_logs" ("user_id", "old_status", "new_status", "reason", "created_at")
SELECT "id", NULL, 'active', '系统迁移初始化', "createdAt"
FROM "User";