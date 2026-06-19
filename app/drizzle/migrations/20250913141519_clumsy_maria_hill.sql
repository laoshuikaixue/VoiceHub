ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpHost" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpPort" integer DEFAULT 587;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpSecure" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpUsername" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpPassword" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpFromEmail" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "smtpFromName" text DEFAULT '校园广播站';--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" boolean DEFAULT false;