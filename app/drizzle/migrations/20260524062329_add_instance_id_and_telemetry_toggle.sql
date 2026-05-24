ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "instance_id" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "telemetryEnabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TYPE "user_status" ADD VALUE IF NOT EXISTS 'graduate';
