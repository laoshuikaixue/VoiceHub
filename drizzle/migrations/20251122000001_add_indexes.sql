CREATE INDEX idx_song_created_at ON "Song" ("createdAt");
CREATE INDEX idx_song_semester ON "Song" ("semester");
CREATE INDEX idx_song_title ON "Song" ("title");
CREATE INDEX idx_song_artist ON "Song" ("artist");

CREATE INDEX idx_vote_songId ON "Vote" ("songId");
CREATE INDEX idx_vote_userId ON "Vote" ("userId");

CREATE INDEX idx_schedule_songId ON "Schedule" ("songId");
CREATE INDEX idx_schedule_playDate ON "Schedule" ("playDate");
CREATE INDEX idx_schedule_isDraft ON "Schedule" ("isDraft");