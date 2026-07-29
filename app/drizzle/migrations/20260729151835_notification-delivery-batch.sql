ALTER TABLE "Notification" ADD COLUMN "batchId" text;--> statement-breakpoint
UPDATE "Notification"
SET "batchId" = 'legacy-group-' || md5(
  "createdAt"::text || E'\x1f' ||
  "type" || E'\x1f' ||
  coalesce("title", '') || E'\x1f' ||
  "message" || E'\x1f' ||
  "important"::text
)
WHERE "type" = 'SYSTEM_NOTICE' AND "batchId" IS NULL;--> statement-breakpoint
CREATE INDEX "notification_batch_id_idx" ON "Notification" USING btree ("batchId");
