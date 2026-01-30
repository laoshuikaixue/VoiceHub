ALTER TABLE "Schedule" ADD COLUMN "isDraft" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Schedule" ADD COLUMN "publishedAt" timestamp;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "playUrl" text;