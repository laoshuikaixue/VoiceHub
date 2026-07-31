CREATE TABLE IF NOT EXISTS "BackupHistory" (
  "id" serial PRIMARY KEY,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "filename" text NOT NULL,
  "totalRecords" integer DEFAULT 0 NOT NULL,
  "backupSize" integer DEFAULT 0 NOT NULL,
  "methods" text NOT NULL,
  "success" boolean DEFAULT false NOT NULL,
  "triggeredBy" text
);
CREATE INDEX IF NOT EXISTS "backup_history_created_at_idx" ON "BackupHistory" ("createdAt");