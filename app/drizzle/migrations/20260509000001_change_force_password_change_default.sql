-- 将 User.forcePasswordChange 默认值从 true 改为 false
-- 原因：该字段原本作为"首次登录需改密"的硬性标志，但全局设置 forcePasswordChangeOnFirstLogin 已承担这一职责。
-- 保留 forcePasswordChange 仅作为管理员显式强制标志，应默认为 false，确保管理员手动设置时具有最高优先级。
ALTER TABLE "User" ALTER COLUMN "forcePasswordChange" SET DEFAULT false;

-- 重置历史数据：将从未改过密码的用户的 forcePasswordChange 设为 false
-- 这些用户的强制改密需求将由全局设置 forcePasswordChangeOnFirstLogin + passwordChangedAt IS NULL 共同判断
-- 已改过密码但仍为 true 的用户视为管理员显式设置，保持不变
UPDATE "User" SET "forcePasswordChange" = false
WHERE "forcePasswordChange" = true AND "passwordChangedAt" IS NULL;
