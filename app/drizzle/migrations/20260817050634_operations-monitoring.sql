CREATE TABLE IF NOT EXISTS "admin_operation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" integer NOT NULL,
	"actor_role" varchar(32) NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" text,
	"target_label" varchar(255),
	"result" varchar(16) NOT NULL,
	"summary" text NOT NULL,
	"failure_code" varchar(100),
	"changes" jsonb,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"request_id" varchar(128)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operations_dependency_buckets" (
	"bucket_start" timestamp with time zone NOT NULL,
	"instance_id" varchar(128) NOT NULL,
	"source" varchar(32) NOT NULL,
	"call_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"empty_result_count" integer DEFAULT 0 NOT NULL,
	"semantic_failure_count" integer DEFAULT 0 NOT NULL,
	"timeout_count" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"fallback_count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer DEFAULT 0 NOT NULL,
	"max_duration_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "operations_dependency_buckets_instance_source_bucket_unique" UNIQUE("bucket_start","instance_id","source")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operations_metric_buckets" (
	"bucket_start" timestamp with time zone NOT NULL,
	"instance_id" varchar(128) NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"client_error_count" integer DEFAULT 0 NOT NULL,
	"server_error_count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer DEFAULT 0 NOT NULL,
	"max_duration_ms" integer DEFAULT 0 NOT NULL,
	"cpu_usage_percent" real,
	"memory_used_bytes" bigint,
	"memory_total_bytes" bigint,
	"disk_used_bytes" bigint,
	"disk_total_bytes" bigint,
	"network_rx_bytes" bigint,
	"network_tx_bytes" bigint,
	"database_query_total" bigint,
	"database_active_connections" integer,
	"database_total_connections" integer,
	"database_slow_query_count" integer,
	CONSTRAINT "operations_metric_buckets_instance_bucket_unique" UNIQUE("bucket_start","instance_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"browser" varchar(64) DEFAULT 'Unknown' NOT NULL,
	"device_type" varchar(32) DEFAULT 'unknown' NOT NULL,
	"last_path" varchar(500),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" integer,
	"revocation_reason" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "SystemSettings" ALTER COLUMN "enabledPlatforms" SET DEFAULT '["netease","tencent","bilibili","migu"]';--> statement-breakpoint
ALTER TABLE "SystemSettings" ALTER COLUMN "platformOrder" SET DEFAULT '["netease","tencent","bilibili","migu"]';--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "batchId" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'SYSTEM' NOT NULL;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "senderId" integer;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "senderName" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "senderUsername" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "important" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "userDeleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_User_id_fk') THEN
    ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

WITH ranked AS (
  SELECT ctid, row_number() OVER (PARTITION BY "bucket_start", "instance_id" ORDER BY ctid) AS row_number,
    sum("request_count") OVER (PARTITION BY "bucket_start", "instance_id") AS request_count,
    sum("client_error_count") OVER (PARTITION BY "bucket_start", "instance_id") AS client_error_count,
    sum("server_error_count") OVER (PARTITION BY "bucket_start", "instance_id") AS server_error_count,
    sum("total_duration_ms") OVER (PARTITION BY "bucket_start", "instance_id") AS total_duration_ms,
    max("max_duration_ms") OVER (PARTITION BY "bucket_start", "instance_id") AS max_duration_ms,
    max("cpu_usage_percent") OVER (PARTITION BY "bucket_start", "instance_id") AS cpu_usage_percent,
    max("memory_used_bytes") OVER (PARTITION BY "bucket_start", "instance_id") AS memory_used_bytes,
    max("memory_total_bytes") OVER (PARTITION BY "bucket_start", "instance_id") AS memory_total_bytes,
    max("disk_used_bytes") OVER (PARTITION BY "bucket_start", "instance_id") AS disk_used_bytes,
    max("disk_total_bytes") OVER (PARTITION BY "bucket_start", "instance_id") AS disk_total_bytes,
    max("network_rx_bytes") OVER (PARTITION BY "bucket_start", "instance_id") AS network_rx_bytes,
    max("network_tx_bytes") OVER (PARTITION BY "bucket_start", "instance_id") AS network_tx_bytes,
    max("database_query_total") OVER (PARTITION BY "bucket_start", "instance_id") AS database_query_total,
    max("database_active_connections") OVER (PARTITION BY "bucket_start", "instance_id") AS database_active_connections,
    max("database_total_connections") OVER (PARTITION BY "bucket_start", "instance_id") AS database_total_connections,
    max("database_slow_query_count") OVER (PARTITION BY "bucket_start", "instance_id") AS database_slow_query_count
  FROM "operations_metric_buckets"
), updated AS (
  UPDATE "operations_metric_buckets" target
  SET "request_count" = ranked.request_count, "client_error_count" = ranked.client_error_count,
    "server_error_count" = ranked.server_error_count, "total_duration_ms" = ranked.total_duration_ms,
    "max_duration_ms" = ranked.max_duration_ms, "cpu_usage_percent" = ranked.cpu_usage_percent,
    "memory_used_bytes" = ranked.memory_used_bytes, "memory_total_bytes" = ranked.memory_total_bytes,
    "disk_used_bytes" = ranked.disk_used_bytes, "disk_total_bytes" = ranked.disk_total_bytes,
    "network_rx_bytes" = ranked.network_rx_bytes, "network_tx_bytes" = ranked.network_tx_bytes,
    "database_query_total" = ranked.database_query_total, "database_active_connections" = ranked.database_active_connections,
    "database_total_connections" = ranked.database_total_connections, "database_slow_query_count" = ranked.database_slow_query_count
  FROM ranked WHERE target.ctid = ranked.ctid AND ranked.row_number = 1
  RETURNING target.ctid
)
DELETE FROM "operations_metric_buckets" target USING ranked
WHERE target.ctid = ranked.ctid AND ranked.row_number > 1;--> statement-breakpoint

WITH ranked AS (
  SELECT ctid, row_number() OVER (PARTITION BY "bucket_start", "instance_id", "source" ORDER BY ctid) AS row_number,
    sum("call_count") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS call_count,
    sum("success_count") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS success_count,
    sum("empty_result_count") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS empty_result_count,
    sum("semantic_failure_count") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS semantic_failure_count,
    sum("timeout_count") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS timeout_count,
    sum("retry_count") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS retry_count,
    sum("fallback_count") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS fallback_count,
    sum("total_duration_ms") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS total_duration_ms,
    max("max_duration_ms") OVER (PARTITION BY "bucket_start", "instance_id", "source") AS max_duration_ms
  FROM "operations_dependency_buckets"
), updated AS (
  UPDATE "operations_dependency_buckets" target
  SET "call_count" = ranked.call_count, "success_count" = ranked.success_count,
    "empty_result_count" = ranked.empty_result_count, "semantic_failure_count" = ranked.semantic_failure_count,
    "timeout_count" = ranked.timeout_count, "retry_count" = ranked.retry_count,
    "fallback_count" = ranked.fallback_count, "total_duration_ms" = ranked.total_duration_ms,
    "max_duration_ms" = ranked.max_duration_ms
  FROM ranked WHERE target.ctid = ranked.ctid AND ranked.row_number = 1
  RETURNING target.ctid
)
DELETE FROM "operations_dependency_buckets" target USING ranked
WHERE target.ctid = ranked.ctid AND ranked.row_number > 1;--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operations_metric_buckets_instance_bucket_unique') THEN
    ALTER TABLE "operations_metric_buckets" ADD CONSTRAINT "operations_metric_buckets_instance_bucket_unique" UNIQUE ("bucket_start", "instance_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operations_dependency_buckets_instance_source_bucket_unique') THEN
    ALTER TABLE "operations_dependency_buckets" ADD CONSTRAINT "operations_dependency_buckets_instance_source_bucket_unique" UNIQUE ("bucket_start", "instance_id", "source");
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_operation_logs_created_at_idx" ON "admin_operation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_operation_logs_actor_created_at_idx" ON "admin_operation_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_operation_logs_action_created_at_idx" ON "admin_operation_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_operation_logs_target_created_at_idx" ON "admin_operation_logs" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_operation_logs_request_id_idx" ON "admin_operation_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operations_dependency_buckets_bucket_start_idx" ON "operations_dependency_buckets" USING btree ("bucket_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operations_dependency_buckets_source_bucket_start_idx" ON "operations_dependency_buckets" USING btree ("source","bucket_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operations_metric_buckets_bucket_start_idx" ON "operations_metric_buckets" USING btree ("bucket_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_active_idx" ON "user_sessions" USING btree ("user_id","last_active_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_last_active_idx" ON "user_sessions" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_browser_idx" ON "user_sessions" USING btree ("browser");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_device_type_idx" ON "user_sessions" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_user_important_read_created_idx" ON "Notification" USING btree ("userId","userDeleted","important","read","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_batch_id_idx" ON "Notification" USING btree ("batchId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "song_created_at_idx" ON "Song" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vote_created_at_idx" ON "Vote" USING btree ("createdAt");
