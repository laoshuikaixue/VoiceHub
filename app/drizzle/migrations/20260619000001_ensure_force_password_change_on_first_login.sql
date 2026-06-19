ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "forcePasswordChangeOnFirstLogin" boolean DEFAULT true NOT NULL;
