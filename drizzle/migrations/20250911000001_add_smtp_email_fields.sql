-- 添加用户邮箱字段
ALTER TABLE "User" ADD COLUMN "email" text;
ALTER TABLE "User" ADD COLUMN "emailVerified" boolean DEFAULT false NOT NULL;
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" timestamp;

-- 添加系统设置SMTP配置字段
ALTER TABLE "SystemSettings" ADD COLUMN "smtpEnabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN "smtpHost" text;
ALTER TABLE "SystemSettings" ADD COLUMN "smtpPort" integer DEFAULT 587;
ALTER TABLE "SystemSettings" ADD COLUMN "smtpSecure" boolean DEFAULT false NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN "smtpUsername" text;
ALTER TABLE "SystemSettings" ADD COLUMN "smtpPassword" text;
ALTER TABLE "SystemSettings" ADD COLUMN "smtpFromEmail" text;
ALTER TABLE "SystemSettings" ADD COLUMN "smtpFromName" text;

-- 添加通知设置邮件通知字段
ALTER TABLE "NotificationSettings" ADD COLUMN "emailSongRequestEnabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "NotificationSettings" ADD COLUMN "emailSongVotedEnabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "NotificationSettings" ADD COLUMN "emailSongPlayedEnabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "NotificationSettings" ADD COLUMN "emailSystemNoticeEnabled" boolean DEFAULT true NOT NULL;
