ALTER TABLE "RequestTime" ALTER COLUMN "startTime" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "RequestTime" ALTER COLUMN "startTime" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "RequestTime" ALTER COLUMN "endTime" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "RequestTime" ALTER COLUMN "endTime" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "enableRequestTimeLimitation" boolean DEFAULT false NOT NULL;