ALTER TABLE "SystemSettings" ADD COLUMN "legalConsentEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "legalConsentDisplayMode" text DEFAULT 'modal' NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "legalConsentUpdatedDate" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "legalConsentDocuments" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "legal_consent_version" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "legal_consent_at" timestamp;