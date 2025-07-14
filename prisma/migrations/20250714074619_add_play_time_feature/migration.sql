-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "playTimeId" INTEGER;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "preferredPlayTimeId" INTEGER;

-- CreateTable
CREATE TABLE "PlayTime" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,

    CONSTRAINT "PlayTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enablePlayTimeSelection" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_preferredPlayTimeId_fkey" FOREIGN KEY ("preferredPlayTimeId") REFERENCES "PlayTime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_playTimeId_fkey" FOREIGN KEY ("playTimeId") REFERENCES "PlayTime"("id") ON DELETE SET NULL ON UPDATE CASCADE;
