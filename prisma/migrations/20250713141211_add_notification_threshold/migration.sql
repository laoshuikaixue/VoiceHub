-- AlterTable
ALTER TABLE "NotificationSettings" ADD COLUMN     "refreshInterval" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "songVotedThreshold" INTEGER NOT NULL DEFAULT 1;
