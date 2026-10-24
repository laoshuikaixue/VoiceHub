ALTER TABLE "PlayTime" ADD COLUMN "weekdays" jsonb;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "preferredPlayDate" date;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "playSlotRequired" boolean DEFAULT false NOT NULL;