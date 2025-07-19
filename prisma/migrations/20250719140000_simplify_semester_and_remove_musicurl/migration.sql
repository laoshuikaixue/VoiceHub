-- 简化学期表结构
ALTER TABLE "Semester" DROP COLUMN IF EXISTS "startDate";
ALTER TABLE "Semester" DROP COLUMN IF EXISTS "endDate";
ALTER TABLE "Semester" DROP COLUMN IF EXISTS "description";

-- 确保完全删除musicUrl字段
ALTER TABLE "Song" DROP COLUMN IF EXISTS "musicUrl";
