CREATE TABLE "admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text,
	"action" varchar(80) NOT NULL,
	"target_type" varchar(50),
	"target_id" text,
	"summary" text,
	"ip_address" text,
	"user_agent" text,
	"result" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "apiLogLevel" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "apiLogRetentionDays" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "auditLogRetentionDays" integer DEFAULT 180 NOT NULL;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_actor_idx" ON "admin_audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs" USING btree ("action","created_at");