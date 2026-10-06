CREATE TABLE "admin_operation_logs" (
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
CREATE TABLE "operations_metric_buckets" (
	"bucket_start" timestamp with time zone NOT NULL,
	"instance_id" varchar(128) NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"client_error_count" integer DEFAULT 0 NOT NULL,
	"server_error_count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer DEFAULT 0 NOT NULL,
	"max_duration_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "operations_metric_buckets_instance_bucket_unique" UNIQUE("bucket_start","instance_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
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
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_operation_logs_created_at_idx" ON "admin_operation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_operation_logs_actor_created_at_idx" ON "admin_operation_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_operation_logs_action_created_at_idx" ON "admin_operation_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "admin_operation_logs_target_created_at_idx" ON "admin_operation_logs" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_operation_logs_request_id_idx" ON "admin_operation_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "operations_metric_buckets_bucket_start_idx" ON "operations_metric_buckets" USING btree ("bucket_start");--> statement-breakpoint
CREATE INDEX "user_sessions_user_active_idx" ON "user_sessions" USING btree ("user_id","last_active_at");--> statement-breakpoint
CREATE INDEX "user_sessions_last_active_idx" ON "user_sessions" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_sessions_browser_idx" ON "user_sessions" USING btree ("browser");--> statement-breakpoint
CREATE INDEX "user_sessions_device_type_idx" ON "user_sessions" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX "song_created_at_idx" ON "Song" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "vote_created_at_idx" ON "Vote" USING btree ("createdAt");