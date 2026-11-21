CREATE TABLE "BroadcastPlayback" (
	"id" integer PRIMARY KEY NOT NULL,
	"device" uuid NOT NULL,
	"userId" integer NOT NULL,
	"authSession" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"armedAt" timestamp,
	"run" uuid,
	"playDate" date,
	"slotId" integer,
	"queue" jsonb,
	"cursor" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BroadcastStart" (
	"playDate" date NOT NULL,
	"slotId" integer NOT NULL,
	CONSTRAINT "BroadcastStart_playDate_slotId_pk" PRIMARY KEY("playDate","slotId")
);
--> statement-breakpoint
ALTER TABLE "PlayTime" ADD COLUMN "broadcastAutoStart" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "PlayTime" ADD COLUMN "broadcastAutoChangedAt" timestamp;--> statement-breakpoint
ALTER TABLE "PlayTime" ADD COLUMN "broadcastStopAtEnd" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "PlayTime" ADD COLUMN "broadcastMarkPlayed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "BroadcastStart" ADD CONSTRAINT "BroadcastStart_slotId_PlayTime_id_fk" FOREIGN KEY ("slotId") REFERENCES "public"."PlayTime"("id") ON DELETE cascade ON UPDATE no action;