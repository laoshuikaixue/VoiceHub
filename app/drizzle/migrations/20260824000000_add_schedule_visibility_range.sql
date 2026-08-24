ALTER TABLE "SystemSettings" ADD COLUMN "scheduleDaysBefore" integer DEFAULT -1;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "scheduleDaysAfter" integer DEFAULT -1;--> statement-breakpoint
ALTER TABLE "SystemSettings" ALTER COLUMN "scheduleDaysBefore" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "SystemSettings" ALTER COLUMN "scheduleDaysAfter" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "scheduleDaysBeforeEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "scheduleDaysAfterEnabled" boolean DEFAULT false NOT NULL;