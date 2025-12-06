CREATE TABLE "RequestTime" (
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
--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "hitRequestId" integer;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "enableRequestTimeLimitation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "forceBlockAllRequests" boolean DEFAULT false NOT NULL;