-- 添加cover和musicUrl字段到Song表
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "cover" TEXT;
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "musicUrl" TEXT;

-- 如果存在isPaidContent字段，则删除它
ALTER TABLE "Song" DROP COLUMN IF EXISTS "isPaidContent";