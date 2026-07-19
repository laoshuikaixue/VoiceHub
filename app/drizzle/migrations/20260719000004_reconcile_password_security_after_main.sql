ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "forcePasswordChangeOnFirstLogin" boolean DEFAULT false NOT NULL;

ALTER TABLE "SystemSettings"
ALTER COLUMN "forcePasswordChangeOnFirstLogin" SET DEFAULT false;

ALTER TABLE "User"
ALTER COLUMN "forcePasswordChange" SET DEFAULT false;

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
