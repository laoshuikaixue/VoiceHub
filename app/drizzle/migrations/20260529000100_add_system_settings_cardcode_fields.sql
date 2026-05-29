-- Add card code related columns to SystemSettings (if not exists)
ALTER TABLE "SystemSettings"
  ADD COLUMN IF NOT EXISTS "enableCardCodeRequests" boolean DEFAULT false NOT NULL;

ALTER TABLE "SystemSettings"
  ADD COLUMN IF NOT EXISTS "requireCardCodeForRequests" boolean DEFAULT false NOT NULL;
