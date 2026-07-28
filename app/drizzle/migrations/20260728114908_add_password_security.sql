CREATE TABLE "PasswordAuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"actorId" integer,
	"action" text NOT NULL,
	"success" boolean NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"failureReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PasswordRateLimit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"resetAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "forcePasswordChange" SET DEFAULT false;--> statement-breakpoint
-- 回填存量数据：旧默认值 true 无法与管理员显式重置区分，统一清零，
-- 避免上线当天存量用户在开关关闭时仍被硬门控锁进改密页；
-- 此后强制标记仅由管理员显式重置产生，首次登录强制改密由系统开关控制。
UPDATE "User" SET "forcePasswordChange" = false WHERE "forcePasswordChange" = true;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "forcePasswordChangeOnFirstLogin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "tokenVersion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "PasswordAuditLog_user_created_idx" ON "PasswordAuditLog" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "PasswordRateLimit_reset_idx" ON "PasswordRateLimit" USING btree ("resetAt");