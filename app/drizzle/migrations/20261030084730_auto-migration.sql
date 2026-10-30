CREATE TABLE "SubmissionTopicDay" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"topicId" integer NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "submission_topic_day_unique" UNIQUE("topicId","date")
);
--> statement-breakpoint
CREATE TABLE "SubmissionTopic" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp NOT NULL,
	"maxSubmissions" integer,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "topicId" integer;--> statement-breakpoint
ALTER TABLE "SubmissionTopicDay" ADD CONSTRAINT "SubmissionTopicDay_topicId_SubmissionTopic_id_fk" FOREIGN KEY ("topicId") REFERENCES "public"."SubmissionTopic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_topic_day_topic_idx" ON "SubmissionTopicDay" USING btree ("topicId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_topic_name_unique" ON "SubmissionTopic" USING btree ("name");--> statement-breakpoint
ALTER TABLE "Song" ADD CONSTRAINT "Song_topicId_SubmissionTopic_id_fk" FOREIGN KEY ("topicId") REFERENCES "public"."SubmissionTopic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "song_topic_created_at_idx" ON "Song" USING btree ("topicId","createdAt");