CREATE TABLE "AnnouncementHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"content" text NOT NULL,
	"senderId" integer,
	"senderName" text,
	"senderUsername" text,
	"broadcastToGroups" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "announcement_history_created_at_idx" ON "AnnouncementHistory" USING btree ("createdAt");