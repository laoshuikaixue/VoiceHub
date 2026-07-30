ALTER TABLE "Notification" ADD COLUMN "source" text DEFAULT 'SYSTEM' NOT NULL;--> statement-breakpoint
UPDATE "Notification"
SET "source" = 'ADMIN_MANUAL'
WHERE "senderId" IS NOT NULL
  AND COALESCE("title", '') NOT IN ('权限变更通知', 'Permission Change Notification');--> statement-breakpoint
UPDATE "Notification"
SET
  "senderId" = NULL,
  "senderName" = NULL,
  "senderUsername" = NULL
WHERE "source" = 'SYSTEM';
