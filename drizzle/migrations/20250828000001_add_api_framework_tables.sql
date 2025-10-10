-- 创建API Keys表
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"description" text,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);--> statement-breakpoint

-- 创建API Key权限表
CREATE TABLE IF NOT EXISTS "api_key_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"api_key_id" uuid NOT NULL,
	"permission" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_permissions_api_key_id_permission_unique" UNIQUE("api_key_id", "permission")
);--> statement-breakpoint

-- 创建API访问日志表
CREATE TABLE IF NOT EXISTS "api_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"api_key_id" uuid,
	"endpoint" varchar(500) NOT NULL,
	"method" varchar(10) NOT NULL,
	"ip_address" inet NOT NULL,
	"user_agent" text,
	"status_code" integer NOT NULL,
	"response_time_ms" integer NOT NULL,
	"request_body" text,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text
);--> statement-breakpoint

-- 创建外键约束
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_User_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_permissions" ADD CONSTRAINT "api_key_permissions_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- 创建索引
CREATE INDEX "idx_api_keys_key_hash" ON "api_keys"("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_created_by" ON "api_keys"("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_active" ON "api_keys"("is_active") WHERE "is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_api_key_permissions_api_key_id" ON "api_key_permissions"("api_key_id");--> statement-breakpoint
CREATE INDEX "idx_api_logs_api_key_id" ON "api_logs"("api_key_id");--> statement-breakpoint
CREATE INDEX "idx_api_logs_created_at" ON "api_logs"("created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_api_logs_status_code" ON "api_logs"("status_code");--> statement-breakpoint
CREATE INDEX "idx_api_logs_endpoint" ON "api_logs"("endpoint");