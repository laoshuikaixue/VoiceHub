-- 早期迁移曾清除 passwordChangedAt 为空账号的待改密标记，且没有保留标记来源。
-- 无法可靠区分管理员重置与历史首次登录账号，因此按安全优先恢复全部待改密状态。
UPDATE "User"
SET "forcePasswordChange" = true
WHERE "passwordChangedAt" IS NULL
  AND "forcePasswordChange" = false;
