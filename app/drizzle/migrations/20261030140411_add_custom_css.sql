ALTER TABLE "SystemSettings" ADD COLUMN "customCssEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customCss" text;