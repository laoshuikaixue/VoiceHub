ALTER TABLE "Notification" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "important" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "notification_user_important_read_created_idx" ON "Notification" USING btree ("userId","important","read","createdAt");