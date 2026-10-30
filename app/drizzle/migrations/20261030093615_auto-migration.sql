CREATE TABLE "SubmissionTopicPlayTime" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"topicId" integer NOT NULL,
	"playTimeId" integer NOT NULL,
	CONSTRAINT "submission_topic_play_time_unique" UNIQUE("topicId","playTimeId")
);
--> statement-breakpoint
ALTER TABLE "SubmissionTopicPlayTime" ADD CONSTRAINT "SubmissionTopicPlayTime_topicId_SubmissionTopic_id_fk" FOREIGN KEY ("topicId") REFERENCES "public"."SubmissionTopic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SubmissionTopicPlayTime" ADD CONSTRAINT "SubmissionTopicPlayTime_playTimeId_PlayTime_id_fk" FOREIGN KEY ("playTimeId") REFERENCES "public"."PlayTime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_topic_play_time_topic_idx" ON "SubmissionTopicPlayTime" USING btree ("topicId");