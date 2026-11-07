ALTER TABLE "SystemSettings" ADD COLUMN "announcement" text;--> statement-breakpoint
CREATE TABLE "AnnouncementHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"displayMode" varchar(16) DEFAULT 'static' NOT NULL,
	"scrollSpeed" integer DEFAULT 30 NOT NULL,
	"alignment" varchar(8) DEFAULT 'left' NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"senderId" integer,
	"senderName" text,
	"senderUsername" text,
	"broadcastToGroups" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE INDEX "announcement_history_created_at_idx" ON "AnnouncementHistory" USING btree ("createdAt");--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "announcementTitle" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "announcementDisplayMode" varchar(16) DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "announcementScrollSpeed" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "announcementAlignment" varchar(8) DEFAULT 'left' NOT NULL;
