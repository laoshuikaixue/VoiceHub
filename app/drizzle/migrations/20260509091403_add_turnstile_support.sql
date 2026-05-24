ALTER TABLE "SystemSettings" ADD COLUMN "captchaProvider" text DEFAULT 'graphic' NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "turnstileSiteKey" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "turnstileSecretKey" text;