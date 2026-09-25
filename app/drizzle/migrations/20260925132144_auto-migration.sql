CREATE TABLE "AstrbotOutbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"title" text,
	"message" text NOT NULL,
	"url" text,
	"umos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"broadcast" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"leasedUntil" timestamp with time zone,
	"deliveredAt" timestamp with time zone,
	"failedAt" timestamp with time zone,
	"lastError" text
);
--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotPushMode" text DEFAULT 'push' NOT NULL;--> statement-breakpoint
CREATE INDEX "astrbot_outbox_pending_idx" ON "AstrbotOutbox" USING btree ("deliveredAt","failedAt","id");