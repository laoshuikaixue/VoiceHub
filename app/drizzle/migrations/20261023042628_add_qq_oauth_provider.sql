ALTER TABLE "SystemSettings" ADD COLUMN "qqOAuthEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "qqOAuthAppId" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "qqOAuthAppKey" text;