-- CreateEnum
CREATE TYPE "BlacklistType" AS ENUM ('SONG', 'KEYWORD');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "grade" TEXT,
    "class" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "password" TEXT NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "forcePasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "meowNickname" TEXT,
    "meowBoundAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "played" BOOLEAN NOT NULL DEFAULT false,
    "playedAt" TIMESTAMP(3),
    "semester" TEXT,
    "preferredPlayTimeId" INTEGER,
    "cover" TEXT,
    "musicPlatform" TEXT,
    "musicId" TEXT,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "songId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "songId" INTEGER NOT NULL,
    "playDate" TIMESTAMP(3) NOT NULL,
    "played" BOOLEAN NOT NULL DEFAULT false,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "playTimeId" INTEGER,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "songId" INTEGER,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "songRequestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "songVotedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "songPlayedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "refreshInterval" INTEGER NOT NULL DEFAULT 60,
    "songVotedThreshold" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayTime" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,

    CONSTRAINT "PlayTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enablePlayTimeSelection" BOOLEAN NOT NULL DEFAULT false,
    "siteTitle" TEXT,
    "siteLogoUrl" TEXT,
    "schoolLogoHomeUrl" TEXT,
    "schoolLogoPrintUrl" TEXT,
    "siteDescription" TEXT,
    "submissionGuidelines" TEXT,
    "icpNumber" TEXT,
    "enableSubmissionLimit" BOOLEAN NOT NULL DEFAULT false,
    "dailySubmissionLimit" INTEGER,
    "weeklySubmissionLimit" INTEGER,
    "showBlacklistKeywords" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongBlacklist" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "BlacklistType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" INTEGER,

    CONSTRAINT "SongBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_songId_userId_key" ON "Vote"("songId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_name_key" ON "Semester"("name");

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_preferredPlayTimeId_fkey" FOREIGN KEY ("preferredPlayTimeId") REFERENCES "PlayTime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_playTimeId_fkey" FOREIGN KEY ("playTimeId") REFERENCES "PlayTime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
