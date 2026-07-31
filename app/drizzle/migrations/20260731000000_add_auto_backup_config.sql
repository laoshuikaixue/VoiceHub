ALTER TABLE "SystemSettings" ADD COLUMN "autoBackupEnabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN "autoBackupConfig" text;