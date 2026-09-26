ALTER TABLE "AstrbotOutbox" ADD COLUMN "eventKey" text;--> statement-breakpoint
ALTER TABLE "AstrbotOutbox" ADD COLUMN "notifyAfter" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotGroupTargets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotGroupEvents" jsonb;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotGroupThrottle" jsonb;