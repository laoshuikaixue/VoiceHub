-- 添加用户邮箱字段
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" boolean DEFAULT false NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamp;

-- 添加系统设置SMTP配置字段
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpEnabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpHost" text;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpPort" integer DEFAULT 587;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpSecure" boolean DEFAULT false NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpUsername" text;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpPassword" text;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpFromEmail" text;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpFromName" text;
