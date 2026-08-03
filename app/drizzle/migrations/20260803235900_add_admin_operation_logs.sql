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
CREATE INDEX "admin_operation_logs_created_at_idx" ON "admin_operation_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "admin_operation_logs_actor_created_at_idx" ON "admin_operation_logs" USING btree ("actor_id", "created_at");
--> statement-breakpoint
CREATE INDEX "admin_operation_logs_action_created_at_idx" ON "admin_operation_logs" USING btree ("action", "created_at");
--> statement-breakpoint
CREATE INDEX "admin_operation_logs_target_created_at_idx" ON "admin_operation_logs" USING btree ("target_type", "target_id", "created_at");
--> statement-breakpoint
CREATE INDEX "admin_operation_logs_request_id_idx" ON "admin_operation_logs" USING btree ("request_id");
