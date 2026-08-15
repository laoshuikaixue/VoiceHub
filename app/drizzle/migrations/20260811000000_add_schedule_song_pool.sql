-- 歌曲时长
ALTER TABLE "Song" ADD COLUMN "durationSeconds" integer;

-- 自动排期备选池表（管理员手动维护的候选歌曲池）
CREATE TABLE IF NOT EXISTS "ScheduleSongPool" (
  "id" serial PRIMARY KEY,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "songId" integer NOT NULL REFERENCES "Song" ("id") ON DELETE CASCADE,
  "addedBy" integer REFERENCES "User" ("id") ON DELETE SET NULL,
  CONSTRAINT "schedule_song_pool_song_unique" UNIQUE ("songId")
);
