DO $$ BEGIN
 CREATE TYPE "public"."BlacklistType" AS ENUM('SONG', 'KEYWORD');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NotificationSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"songRequestEnabled" boolean DEFAULT true NOT NULL,
	"songVotedEnabled" boolean DEFAULT true NOT NULL,
	"songPlayedEnabled" boolean DEFAULT true NOT NULL,
	"refreshInterval" integer DEFAULT 60 NOT NULL,
	"songVotedThreshold" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "NotificationSettings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"userId" integer NOT NULL,
	"songId" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PlayTime" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"startTime" text,
	"endTime" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"songId" integer NOT NULL,
	"playDate" timestamp NOT NULL,
	"played" boolean DEFAULT false NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"playTimeId" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Semester" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	CONSTRAINT "Semester_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SongBlacklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"type" "BlacklistType" NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdBy" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Song" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"requesterId" integer NOT NULL,
	"played" boolean DEFAULT false NOT NULL,
	"playedAt" timestamp,
	"semester" text,
	"preferredPlayTimeId" integer,
	"cover" text,
	"musicPlatform" text,
	"musicId" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SystemSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"enablePlayTimeSelection" boolean DEFAULT false NOT NULL,
	"siteTitle" text,
	"siteLogoUrl" text,
	"schoolLogoHomeUrl" text,
	"schoolLogoPrintUrl" text,
	"siteDescription" text,
	"submissionGuidelines" text,
	"icpNumber" text,
	"enableSubmissionLimit" boolean DEFAULT false NOT NULL,
	"dailySubmissionLimit" integer,
	"weeklySubmissionLimit" integer,
	"showBlacklistKeywords" boolean DEFAULT false NOT NULL,
	"hideStudentInfo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"username" text NOT NULL,
	"name" text,
	"grade" text,
	"class" text,
	"role" text DEFAULT 'USER' NOT NULL,
	"password" text NOT NULL,
	"lastLogin" timestamp,
	"lastLoginIp" text,
	"passwordChangedAt" timestamp,
	"forcePasswordChange" boolean DEFAULT true NOT NULL,
	"meowNickname" text,
	"meowBoundAt" timestamp,
	CONSTRAINT "User_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Vote" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"songId" integer NOT NULL,
	"userId" integer NOT NULL
);
