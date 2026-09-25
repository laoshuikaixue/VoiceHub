ALTER TABLE "SystemSettings" ADD COLUMN "esaCaptchaPrefix" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "esaCaptchaSceneId" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "esaCaptchaRegion" text DEFAULT 'cn' NOT NULL;