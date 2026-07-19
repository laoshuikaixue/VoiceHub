-- 首次登录迁移曾把历史用户误标记为必须改密；由于没有来源字段，只能清理未设置过密码的批量标记。
-- 管理员之后执行的密码重置会写入 passwordChangedAt，不会被本次纠正清理。
UPDATE "User"
SET "forcePasswordChange" = false
WHERE "passwordChangedAt" IS NULL;

UPDATE "SystemSettings"
SET "forcePasswordChangeOnFirstLogin" = false;

ALTER TABLE "SystemSettings"
ALTER COLUMN "forcePasswordChangeOnFirstLogin" SET DEFAULT false;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "tokenVersion" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "PasswordAuditLog" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "action" text NOT NULL,
  "success" boolean NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "failureReason" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "PasswordAuditLog_user_created_idx"
  ON "PasswordAuditLog" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "PasswordRateLimit" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL,
  "resetAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "PasswordRateLimit_reset_idx"
  ON "PasswordRateLimit" ("resetAt");
