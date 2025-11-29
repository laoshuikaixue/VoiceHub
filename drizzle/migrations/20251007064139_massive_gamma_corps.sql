CREATE TABLE "RequestTime" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp(6) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"startTime" text,
	"endTime" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"expected" bigint DEFAULT 0 NOT NULL,
	"accepted" bigint DEFAULT 0 NOT NULL
);
