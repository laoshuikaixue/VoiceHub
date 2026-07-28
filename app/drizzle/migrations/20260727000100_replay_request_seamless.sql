-- 重播申请无感化：扩展申请元数据、排期绑定申请、放开唯一约束

-- 1. song_replay_requests 新增提交元数据字段（复用 songs 字段语义）
ALTER TABLE "song_replay_requests" ADD COLUMN IF NOT EXISTS "preferred_play_time_id" integer;
ALTER TABLE "song_replay_requests" ADD COLUMN IF NOT EXISTS "submission_note" text;
ALTER TABLE "song_replay_requests" ADD COLUMN IF NOT EXISTS "submission_note_public" boolean DEFAULT false NOT NULL;

-- 2. Schedule 新增重播申请绑定字段（无外键约束，历史数据可为 NULL）
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "replay_request_id" integer;

-- 3. 放开 (song_id, user_id) 全量唯一约束，允许同一用户对同一首歌提交多条重播申请
ALTER TABLE "song_replay_requests" DROP CONSTRAINT IF EXISTS "song_replay_requests_song_id_user_id_unique";

-- 同一用户对同一首歌同时最多保留一条待处理申请
CREATE UNIQUE INDEX IF NOT EXISTS "song_replay_requests_pending_song_user_unique"
  ON "song_replay_requests" ("song_id", "user_id")
  WHERE "status" = 'PENDING';

-- 4. 尽力回填历史重播排期的申请绑定：
-- 每首歌取最新一条已履行申请，只绑定申请创建后最早发布的一条排期（一对一）
UPDATE "Schedule" sch
SET "replay_request_id" = m.request_id
FROM (
  SELECT DISTINCT ON (rr.id) rr.id AS request_id, s.id AS schedule_id
  FROM (
    SELECT DISTINCT ON ("song_id") id, "song_id", "created_at"
    FROM "song_replay_requests"
    WHERE "status" = 'FULFILLED'
    ORDER BY "song_id", "created_at" DESC
  ) rr
  JOIN "Schedule" s ON s."songId" = rr."song_id"
    AND s."replay_request_id" IS NULL
    AND s."isDraft" = false
    AND s."publishedAt" IS NOT NULL
    AND s."publishedAt" >= rr."created_at"
  ORDER BY rr.id, s."publishedAt" ASC, s.id ASC
) m
WHERE sch.id = m.schedule_id;
