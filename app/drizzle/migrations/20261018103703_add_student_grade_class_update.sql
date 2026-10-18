CREATE TABLE "grade_class_change_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"semester" text,
	"old_grade" text,
	"old_class" text,
	"new_grade" text,
	"new_class" text,
	"source" varchar(16) DEFAULT 'student' NOT NULL,
	"operator_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "allowStudentGradeClassUpdate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "gradeClassChangeMinIntervalDays" integer;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "gradeClassChangePerSemesterLimit" integer;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "gradeClassChangeWindowStart" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "gradeClassChangeWindowEnd" text;--> statement-breakpoint
CREATE INDEX "grade_class_change_logs_user_created_idx" ON "grade_class_change_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "grade_class_change_logs_user_semester_idx" ON "grade_class_change_logs" USING btree ("user_id","semester");