DROP INDEX "notification_user_important_read_created_idx";--> statement-breakpoint
ALTER TABLE "Notification" ADD COLUMN "userDeleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "notification_user_important_read_created_idx" ON "Notification" USING btree ("userId","userDeleted","important","read","createdAt");