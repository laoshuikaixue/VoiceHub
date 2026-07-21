ALTER TABLE "SystemSettings"
ALTER COLUMN "forcePasswordChangeOnFirstLogin" SET DEFAULT false;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "tokenVersion" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "PasswordAuditLog" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "actorId" integer,
  "action" text NOT NULL,
  "success" boolean NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "failureReason" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "PasswordAuditLog_user_created_idx"
  ON "PasswordAuditLog" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "PasswordRateLimit" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL,
  "resetAt" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "PasswordRateLimit_reset_idx"
  ON "PasswordRateLimit" ("resetAt");
