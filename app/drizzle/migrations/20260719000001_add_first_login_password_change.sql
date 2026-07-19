ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "forcePasswordChangeOnFirstLogin" boolean DEFAULT true NOT NULL;

ALTER TABLE "User"
ALTER COLUMN "forcePasswordChange" SET DEFAULT false;

UPDATE "User"
SET "forcePasswordChange" = false
WHERE "forcePasswordChange" = true
  AND "passwordChangedAt" IS NULL;
