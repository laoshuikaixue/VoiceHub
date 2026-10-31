ALTER TABLE "AnnouncementHistory" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "AnnouncementHistory" ADD COLUMN "displayMode" varchar(16) DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "AnnouncementHistory" ADD COLUMN "scrollSpeed" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "AnnouncementHistory" ADD COLUMN "isActive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "announcementTitle" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "announcementDisplayMode" varchar(16) DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "announcementScrollSpeed" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
UPDATE "AnnouncementHistory" h SET "isActive" = true FROM (SELECT "id" FROM "AnnouncementHistory" ORDER BY "createdAt" DESC, "id" DESC LIMIT 1) latest WHERE h."id" = latest."id" AND EXISTS (SELECT 1 FROM "SystemSettings" s WHERE s."announcement" IS NOT NULL);