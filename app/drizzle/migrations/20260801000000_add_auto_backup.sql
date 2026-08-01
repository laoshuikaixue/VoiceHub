CREATE TABLE "BackupHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"filename" text NOT NULL,
	"totalRecords" integer DEFAULT 0 NOT NULL,
	"backupSize" integer DEFAULT 0 NOT NULL,
	"methods" text NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"triggeredBy" text
);
--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "autoBackupEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "autoBackupConfig" text;--> statement-breakpoint
CREATE INDEX "backup_history_created_at_idx" ON "BackupHistory" USING btree ("createdAt");