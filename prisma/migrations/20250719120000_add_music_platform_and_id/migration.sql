-- 添加musicPlatform和musicId字段到Song表
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "musicPlatform" TEXT;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "musicId" TEXT;
