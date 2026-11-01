ALTER TABLE "AnnouncementHistory" ADD COLUMN "alignment" varchar(8) DEFAULT 'left' NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "announcementAlignment" varchar(8) DEFAULT 'left' NOT NULL;
