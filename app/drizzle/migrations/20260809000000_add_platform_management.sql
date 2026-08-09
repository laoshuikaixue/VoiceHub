ALTER TABLE "SystemSettings" ADD COLUMN "enabledPlatforms" text DEFAULT '["netease","tencent","bilibili","migu"]';--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "platformOrder" text DEFAULT '["netease","tencent","bilibili","migu"]';--> statement-breakpoint
-- 回填已有行的默认值
UPDATE "SystemSettings" SET "enabledPlatforms" = '["netease","tencent","bilibili","migu"]' WHERE "enabledPlatforms" IS NULL;
UPDATE "SystemSettings" SET "platformOrder" = '["netease","tencent","bilibili","migu"]' WHERE "platformOrder" IS NULL;