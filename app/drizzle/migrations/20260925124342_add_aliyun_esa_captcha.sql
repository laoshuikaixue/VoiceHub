ALTER TABLE "SystemSettings" ADD COLUMN "esaCaptchaPrefix" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "esaCaptchaScenes" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "esaCaptchaRegion" text DEFAULT 'cn' NOT NULL;