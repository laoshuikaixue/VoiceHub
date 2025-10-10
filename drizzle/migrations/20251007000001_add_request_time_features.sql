-- 创建 RequestTime 表
CREATE TABLE IF NOT EXISTS "RequestTime" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp(6) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"expected" bigint DEFAULT 0 NOT NULL,
	"accepted" bigint DEFAULT 0 NOT NULL,
	"past" boolean DEFAULT false NOT NULL
);

-- 为 Song 表添加 hitRequestId 字段
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "hitRequestId" integer;

-- 为 SystemSettings 表添加投稿限制相关字段
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "enableRequestTimeLimitation" boolean DEFAULT false NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "forceBlockAllRequests" boolean DEFAULT false NOT NULL;