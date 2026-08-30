CREATE TABLE "api_rate_limit_counters" (
	"api_key_id" uuid NOT NULL,
	"bucket_minute" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_daily" (
	"api_key_id" uuid NOT NULL,
	"usage_date" varchar(8) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_monthly" (
	"api_key_id" uuid NOT NULL,
	"usage_month" varchar(6) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_migration_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"old_value" varchar(100) NOT NULL,
	"new_value" varchar(100) NOT NULL,
	"api_key_id" uuid,
	"migrated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description_zh" text NOT NULL,
	"description_en" text NOT NULL,
	"scope_expression" text,
	"is_api_permission" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" varchar(32) NOT NULL,
	"permission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"grant_type" varchar(16) NOT NULL,
	"expires_at" timestamp with time zone,
	"granted_by" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_perm_unique" UNIQUE("user_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key_id" uuid,
	"url" text NOT NULL,
	"payload" text,
	"error_message" text,
	"attempt" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "owner_type" varchar(32) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "rate_limit_per_minute" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "quota_daily" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "quota_monthly" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "ip_whitelist" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "webhook_secret_hash" text;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_User_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_rate_limit_counters_lookup_idx" ON "api_rate_limit_counters" USING btree ("api_key_id","bucket_minute");--> statement-breakpoint
CREATE INDEX "api_usage_daily_lookup_idx" ON "api_usage_daily" USING btree ("api_key_id","usage_date");--> statement-breakpoint
CREATE INDEX "api_usage_monthly_lookup_idx" ON "api_usage_monthly" USING btree ("api_key_id","usage_month");--> statement-breakpoint
CREATE INDEX "permissions_category_idx" ON "permissions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "user_permissions_expires_at_idx" ON "user_permissions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "webhook_failures_api_key_id_idx" ON "webhook_failures" USING btree ("api_key_id");