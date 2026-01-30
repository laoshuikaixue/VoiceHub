-- 为排期表添加草稿支持
-- 添加草稿状态标识字段
ALTER TABLE "Schedule" ADD COLUMN "isDraft" boolean DEFAULT false NOT NULL;

-- 添加发布时间字段（发布后记录发布时间）
ALTER TABLE "Schedule" ADD COLUMN "publishedAt" timestamp;

-- 为现有排期设置为已发布状态（因为现有的都应该是已发布的）
UPDATE "Schedule" SET "isDraft" = false, "publishedAt" = "updatedAt" WHERE "isDraft" IS NULL;

-- 创建索引以优化查询性能
CREATE INDEX "idx_schedule_is_draft" ON "Schedule" ("isDraft");
CREATE INDEX "idx_schedule_published_at" ON "Schedule" ("publishedAt");
CREATE INDEX "idx_schedule_draft_date" ON "Schedule" ("isDraft", "playDate");