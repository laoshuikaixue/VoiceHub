ALTER TABLE "song_replay_requests" ADD COLUMN "submission_note_public_status" text;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "submissionNotePublicStatus" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "submissionNoteRequiresApproval" boolean DEFAULT false NOT NULL;