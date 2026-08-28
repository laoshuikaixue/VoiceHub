ALTER TABLE "SystemSettings" ADD COLUMN "statisticsCodeEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "statisticsCode" text;