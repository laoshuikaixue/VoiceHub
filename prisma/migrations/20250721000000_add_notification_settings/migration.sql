-- AlterTable
ALTER TABLE "NotificationSettings" ADD COLUMN "songVotedThreshold" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "NotificationSettings" ADD COLUMN "refreshInterval" INTEGER NOT NULL DEFAULT 60; 