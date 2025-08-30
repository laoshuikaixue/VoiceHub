CREATE TABLE "Announcement" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"startDate" timestamp,
	"endDate" timestamp,
	"createdByUserId" integer NOT NULL,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"backgroundColor" text DEFAULT '#1a1a1a',
	"textColor" text DEFAULT '#ffffff',
	"buttonColor" text DEFAULT '#4F46E5'
);
