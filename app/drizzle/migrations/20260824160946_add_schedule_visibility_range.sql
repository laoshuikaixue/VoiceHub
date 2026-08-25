ALTER TABLE "SystemSettings" ADD COLUMN "scheduleDaysBeforeEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "scheduleDaysBefore" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "scheduleDaysAfterEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "scheduleDaysAfter" integer DEFAULT 1 NOT NULL;