ALTER TABLE "NotificationSettings" ADD COLUMN "emailEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "smtpEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "smtpHost" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "smtpPort" integer DEFAULT 587;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "smtpSecure" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "smtpUsername" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "smtpPassword" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "smtpFromEmail" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "smtpFromName" text DEFAULT '校园广播站';--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailVerified" boolean DEFAULT false;