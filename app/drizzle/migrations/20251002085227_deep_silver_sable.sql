ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "isDraft" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "publishedAt" timestamp;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "playUrl" text;