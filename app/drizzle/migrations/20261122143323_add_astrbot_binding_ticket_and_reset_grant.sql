CREATE TABLE "AstrbotBindTicket" (
	"tokenHash" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"adapter" text NOT NULL,
	"umo" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"consumedAt" timestamp with time zone,
	"consumedByUserId" integer
);
--> statement-breakpoint
ALTER TABLE "AstrbotBinding" ADD COLUMN "passwordResetGrantId" uuid;--> statement-breakpoint
CREATE INDEX "AstrbotBindTicket_expires_idx" ON "AstrbotBindTicket" USING btree ("expiresAt");