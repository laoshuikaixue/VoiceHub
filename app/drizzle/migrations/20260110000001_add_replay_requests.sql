CREATE TABLE IF NOT EXISTS "song_replay_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"song_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_replay_requests_song_id_user_id_unique" UNIQUE("song_id","user_id")
);

ALTER TABLE "SystemSettings" ADD COLUMN "enableReplayRequests" boolean DEFAULT false NOT NULL;
