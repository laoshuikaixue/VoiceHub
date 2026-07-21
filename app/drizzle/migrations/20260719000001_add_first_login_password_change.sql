ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "forcePasswordChangeOnFirstLogin" boolean DEFAULT false NOT NULL;

ALTER TABLE "User"
ALTER COLUMN "forcePasswordChange" SET DEFAULT false;

-- forcePasswordChange 可能来自管理员重置，迁移不得改写现有用户状态。
