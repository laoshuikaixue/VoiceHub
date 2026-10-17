-- 逐条投稿匿名：true = 对其他同学显示「匿名」（管理员与投稿人本人仍可见真实姓名）
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "submissionAnonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
