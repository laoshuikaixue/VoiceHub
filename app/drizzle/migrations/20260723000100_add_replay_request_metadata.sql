ALTER TABLE "song_replay_requests" ADD COLUMN IF NOT EXISTS "preferred_play_time_id" integer;
ALTER TABLE "song_replay_requests" ADD COLUMN IF NOT EXISTS "submission_note" text;
ALTER TABLE "song_replay_requests" ADD COLUMN IF NOT EXISTS "submission_note_public" boolean DEFAULT false NOT NULL;
