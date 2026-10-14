ALTER TABLE "SystemSettings" ADD COLUMN "enableGlobalSubmissionLimit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "globalDailySubmissionLimit" integer;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "globalWeeklySubmissionLimit" integer;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "globalMonthlySubmissionLimit" integer;