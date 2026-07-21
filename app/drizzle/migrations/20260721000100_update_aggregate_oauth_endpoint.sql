ALTER TABLE "SystemSettings"
  ALTER COLUMN "aggregateOAuthEndpoint" SET DEFAULT 'https://u.beichenwl.cn/connect.php';

UPDATE "SystemSettings"
SET "aggregateOAuthEndpoint" = 'https://u.beichenwl.cn/connect.php'
WHERE "aggregateOAuthEndpoint" IS NULL
   OR "aggregateOAuthEndpoint" = 'https://a.idcfx.net/connect.php';
