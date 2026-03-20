ALTER TABLE "Song" ADD COLUMN "submissionNote" text;
ALTER TABLE "Song" ADD COLUMN "submissionNotePublic" boolean DEFAULT false NOT NULL;
ALTER TABLE "SystemSettings" ADD COLUMN "enableSubmissionRemarks" boolean DEFAULT false NOT NULL;
