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

-- 音源平台默认排序
ALTER TABLE "SystemSettings" ALTER COLUMN "enabledPlatforms" SET DEFAULT '["netease","tencent","bilibili","migu"]';
ALTER TABLE "SystemSettings" ALTER COLUMN "platformOrder" SET DEFAULT '["netease","tencent","bilibili","migu"]';

-- 重复投稿限制字段（同一首歌/同一歌手进入排期后的禁止再次投稿时间窗口）
ALTER TABLE "SystemSettings" ADD COLUMN "enableSubmissionRestriction" boolean DEFAULT false NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN "submissionRestrictionScope" text DEFAULT 'all' NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN "sameSongRestrictionHours" integer;
ALTER TABLE "SystemSettings" ADD COLUMN "sameArtistRestrictionHours" integer;
