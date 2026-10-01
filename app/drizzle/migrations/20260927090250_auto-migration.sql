CREATE TABLE "api_rate_limit_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiKeyId" uuid NOT NULL,
	"bucketMinute" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_limit_counters_key_bucket_unique" UNIQUE("apiKeyId","bucketMinute")
);
--> statement-breakpoint
CREATE TABLE "api_usage_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiKeyId" uuid NOT NULL,
	"usageDate" varchar(10) NOT NULL,
	"requestCount" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_usage_daily_key_date_unique" UNIQUE("apiKeyId","usageDate")
);
--> statement-breakpoint
CREATE TABLE "api_usage_monthly" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiKeyId" uuid NOT NULL,
	"usageMonth" varchar(7) NOT NULL,
	"requestCount" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_usage_monthly_key_month_unique" UNIQUE("apiKeyId","usageMonth")
);
--> statement-breakpoint
CREATE TABLE "permission_migration_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"oldValue" varchar(100) NOT NULL,
	"newValue" varchar(100) NOT NULL,
	"apiKeyId" uuid,
	"migratedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"descriptionZh" text NOT NULL,
	"descriptionEn" text NOT NULL,
	"minRole" varchar(20) NOT NULL,
	"isApiPermission" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" varchar(32) NOT NULL,
	"permissionId" integer NOT NULL,
	CONSTRAINT "role_permissions_role_permissionId_pk" PRIMARY KEY("role","permissionId")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"permissionId" integer NOT NULL,
	"grantType" varchar(10) NOT NULL,
	"expiresAt" timestamp with time zone,
	"grantedBy" integer NOT NULL,
	"reason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_permission_unique" UNIQUE("userId","permissionId")
);
--> statement-breakpoint
CREATE TABLE "webhook_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiKeyId" uuid,
	"webhookUrl" text NOT NULL,
	"event" varchar(100) NOT NULL,
	"statusCode" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "ownerType" varchar(20) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "ownerId" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "rateLimitPerMinute" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "quotaDaily" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "quotaMonthly" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "ipWhitelist" jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "webhookUrl" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "webhookSecretHash" text;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_permissions_id_fk" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_permissions_id_fk" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_grantedBy_User_id_fk" FOREIGN KEY ("grantedBy") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "permissions_category_idx" ON "permissions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permissionId");--> statement-breakpoint
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions" USING btree ("permissionId");--> statement-breakpoint
CREATE INDEX "webhook_failures_api_key_created_idx" ON "webhook_failures" USING btree ("apiKeyId","createdAt");