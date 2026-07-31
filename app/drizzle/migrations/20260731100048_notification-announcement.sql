ALTER TABLE "Notification" ADD COLUMN "batchId" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "source" text DEFAULT 'SYSTEM' NOT NULL;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "senderId" integer;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "senderName" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "senderUsername" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "important" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "userDeleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "notification_user_important_read_created_idx" ON "Notification" USING btree ("userId","userDeleted","important","read","createdAt");--> statement-breakpoint
CREATE INDEX "notification_batch_id_idx" ON "Notification" USING btree ("batchId");