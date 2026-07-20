-- 早期补偿迁移曾将所有 passwordChangedAt 为空的历史账号标记为强制改密。
-- 当前管理员重置流程会同时写入 passwordChangedAt，因此清除剩余的来源不明标记。
UPDATE "User"
SET "forcePasswordChange" = false
WHERE "passwordChangedAt" IS NULL
  AND "forcePasswordChange" = true;
