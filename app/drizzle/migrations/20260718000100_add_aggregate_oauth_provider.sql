ALTER TABLE "SystemSettings"
  ADD COLUMN IF NOT EXISTS "aggregateOAuthEnabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "aggregateOAuthAppId" text,
  ADD COLUMN IF NOT EXISTS "aggregateOAuthAppKey" text,
  ADD COLUMN IF NOT EXISTS "aggregateOAuthLoginType" text DEFAULT 'qq',
  ADD COLUMN IF NOT EXISTS "aggregateOAuthEndpoint" text DEFAULT 'https://a.idcfx.net/connect.php';
