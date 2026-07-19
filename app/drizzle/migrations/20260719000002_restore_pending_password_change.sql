-- 上一条迁移无法区分历史首次登录标记与管理员重置密码标记，曾将两者一并清除。
-- 这些字段没有保留变更来源，无法仅恢复管理员重置的用户；安全策略优先恢复所有尚未完成密码设置的账户。
UPDATE "User"
SET "forcePasswordChange" = true
WHERE "passwordChangedAt" IS NULL
  AND "forcePasswordChange" = false;
