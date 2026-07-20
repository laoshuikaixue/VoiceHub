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
--> statement-breakpoint
ALTER TABLE "PasswordAuditLog"
ADD COLUMN IF NOT EXISTS "actorId" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PasswordRateLimit" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL,
  "resetAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PasswordAuditLog'
      AND column_name = 'createdAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "PasswordAuditLog"
    ALTER COLUMN "createdAt" TYPE timestamp with time zone
    USING "createdAt" AT TIME ZONE current_setting('TIMEZONE');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'PasswordRateLimit'
      AND column_name = 'resetAt'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "PasswordRateLimit"
    ALTER COLUMN "resetAt" TYPE timestamp with time zone
    USING "resetAt" AT TIME ZONE 'UTC';
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PasswordAuditLog_user_created_idx"
  ON "PasswordAuditLog" ("userId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PasswordRateLimit_reset_idx"
  ON "PasswordRateLimit" ("resetAt");
