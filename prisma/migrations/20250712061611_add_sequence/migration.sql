-- 添加sequence字段到Schedule表
ALTER TABLE "Schedule" ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 1; 