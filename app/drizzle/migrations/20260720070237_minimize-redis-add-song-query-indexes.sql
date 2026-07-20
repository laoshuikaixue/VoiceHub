CREATE INDEX "schedule_published_song_idx" ON "Schedule" USING btree ("isDraft","songId","playDate");--> statement-breakpoint
CREATE INDEX "schedule_published_date_idx" ON "Schedule" USING btree ("isDraft","playDate");--> statement-breakpoint
CREATE INDEX "song_collaborators_song_status_idx" ON "song_collaborators" USING btree ("song_id","status");--> statement-breakpoint
CREATE INDEX "song_collaborators_user_status_idx" ON "song_collaborators" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "song_replay_requests_user_status_song_idx" ON "song_replay_requests" USING btree ("user_id","status","song_id");--> statement-breakpoint
CREATE INDEX "song_semester_created_at_idx" ON "Song" USING btree ("semester","createdAt");--> statement-breakpoint
CREATE INDEX "song_requester_id_idx" ON "Song" USING btree ("requesterId");--> statement-breakpoint
CREATE INDEX "vote_user_song_idx" ON "Vote" USING btree ("userId","songId");--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "vote_song_user_unique" UNIQUE("songId","userId");
