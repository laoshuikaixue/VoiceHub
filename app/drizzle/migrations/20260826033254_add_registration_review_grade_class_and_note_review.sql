ALTER TYPE "public"."user_status" ADD VALUE 'pending' BEFORE 'withdrawn';--> statement-breakpoint
ALTER TYPE "public"."user_status" ADD VALUE 'rejected';--> statement-breakpoint
CREATE TABLE "GradeClass" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"grade" text NOT NULL,
	"class" text NOT NULL,
	CONSTRAINT "GradeClass_grade_class_unique" UNIQUE("grade","class")
);
--> statement-breakpoint
ALTER TABLE "song_replay_requests" ADD COLUMN "submission_note_public_status" text;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "submissionNotePublicStatus" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "allowRegister" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "registerRequiresApproval" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "oauthRegisterRequiresApproval" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "registerEmailRequired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "submissionNoteRequiresApproval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_status_logs" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user_status_logs" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "remark" text;--> statement-breakpoint
CREATE UNIQUE INDEX "User_username_unique" ON "User" USING btree ("username");