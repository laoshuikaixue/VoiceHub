-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."BlacklistType" AS ENUM('SONG', 'KEYWORD');--> statement-breakpoint
CREATE TYPE "public"."card_code_status" AS ENUM('AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID');--> statement-breakpoint
CREATE TYPE "public"."collaborator_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."replay_request_status" AS ENUM('PENDING', 'FULFILLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'withdrawn', 'graduate');--> statement-breakpoint
CREATE TABLE "__drizzle_migrations__" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"created_at" bigint
);
--> statement-breakpoint
CREATE TABLE "PlayTime" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"startTime" text,
	"endTime" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "Semester" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SongBlacklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"type" "BlacklistType" NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdBy" integer
);
--> statement-breakpoint
CREATE TABLE "Vote" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"songId" integer NOT NULL,
	"userId" integer NOT NULL,
	CONSTRAINT "vote_song_user_unique" UNIQUE("userId","songId")
);
--> statement-breakpoint
CREATE TABLE "user_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"old_status" "user_status",
	"new_status" "user_status" NOT NULL,
	"reason" text,
	"operator_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "api_key_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"permission" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_permissions_api_key_id_permission_unique" UNIQUE("permission","api_key_id")
);
--> statement-breakpoint
CREATE TABLE "api_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid,
	"endpoint" varchar(500) NOT NULL,
	"method" varchar(10) NOT NULL,
	"ip_address" "inet" NOT NULL,
	"user_agent" text,
	"status_code" integer NOT NULL,
	"response_time_ms" integer NOT NULL,
	"request_body" text,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "NotificationSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"songRequestEnabled" boolean DEFAULT true NOT NULL,
	"songVotedEnabled" boolean DEFAULT true NOT NULL,
	"songPlayedEnabled" boolean DEFAULT true NOT NULL,
	"refreshInterval" integer DEFAULT 60 NOT NULL,
	"songVotedThreshold" integer DEFAULT 1 NOT NULL,
	"emailSongRequestEnabled" boolean DEFAULT true NOT NULL,
	"emailSongVotedEnabled" boolean DEFAULT true NOT NULL,
	"emailSongPlayedEnabled" boolean DEFAULT true NOT NULL,
	"emailSystemNoticeEnabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EmailTemplate" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"html" text NOT NULL,
	"updatedByUserId" integer
);
--> statement-breakpoint
CREATE TABLE "collaboration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaborator_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"operator_id" integer NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RequestTime" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp(6) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"expected" bigint DEFAULT 0 NOT NULL,
	"accepted" bigint DEFAULT 0 NOT NULL,
	"past" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" "collaborator_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserIdentity" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" text NOT NULL,
	"providerUserId" text NOT NULL,
	"providerUsername" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserIdentity_provider_providerUserId_unique" UNIQUE("providerUserId","provider")
);
--> statement-breakpoint
CREATE TABLE "CardCode" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"status" "card_code_status" DEFAULT 'AVAILABLE' NOT NULL,
	"lockedBy" integer,
	"lockedAt" timestamp,
	"redeemedBy" integer,
	"redeemedAt" timestamp,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "Song" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"requesterId" integer NOT NULL,
	"played" boolean DEFAULT false NOT NULL,
	"playedAt" timestamp,
	"semester" text,
	"preferredPlayTimeId" integer,
	"cover" text,
	"musicPlatform" text,
	"musicId" text,
	"playUrl" text,
	"hitRequestId" integer,
	"submissionNote" text,
	"submissionNotePublic" boolean DEFAULT false NOT NULL,
	"cardCodeId" integer
);
--> statement-breakpoint
CREATE TABLE "CardCodeRedeemLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"cardCodeId" integer,
	"codeSnapshot" text NOT NULL,
	"redeemedBy" integer NOT NULL,
	"redeemedAt" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'UNKNOWN' NOT NULL,
	"songId" integer
);
--> statement-breakpoint
CREATE TABLE "song_replay_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"song_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "replay_request_status" DEFAULT 'PENDING' NOT NULL,
	"preferred_play_time_id" integer,
	"submission_note" text,
	"submission_note_public" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"songId" integer NOT NULL,
	"playDate" timestamp NOT NULL,
	"played" boolean DEFAULT false NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"playTimeId" integer,
	"isDraft" boolean DEFAULT false NOT NULL,
	"publishedAt" timestamp,
	"replay_request_id" integer
);
--> statement-breakpoint
CREATE TABLE "PasswordAuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"actorId" integer,
	"action" text NOT NULL,
	"success" boolean NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"failureReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PasswordRateLimit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"resetAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"username" text NOT NULL,
	"name" text,
	"grade" text,
	"class" text,
	"role" text DEFAULT 'USER' NOT NULL,
	"password" text NOT NULL,
	"lastLogin" timestamp,
	"lastLoginIp" text,
	"passwordChangedAt" timestamp,
	"forcePasswordChange" boolean DEFAULT false NOT NULL,
	"meowNickname" text,
	"meowBoundAt" timestamp,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"statusChangedAt" timestamp DEFAULT now(),
	"statusChangedBy" integer,
	"email" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"emailVerifiedAt" timestamp,
	"tokenVersion" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"userId" integer NOT NULL,
	"songId" integer,
	"batchId" text,
	"source" text DEFAULT 'SYSTEM' NOT NULL,
	"senderId" integer,
	"senderName" text,
	"senderUsername" text,
	"title" text,
	"important" boolean DEFAULT false NOT NULL,
	"userDeleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BackupHistory" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"filename" text NOT NULL,
	"totalRecords" integer DEFAULT 0 NOT NULL,
	"backupSize" integer DEFAULT 0 NOT NULL,
	"methods" text NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"triggeredBy" text
);
--> statement-breakpoint
CREATE TABLE "SystemSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"enablePlayTimeSelection" boolean DEFAULT false NOT NULL,
	"siteTitle" text,
	"siteLogoUrl" text,
	"schoolLogoHomeUrl" text,
	"schoolLogoPrintUrl" text,
	"siteDescription" text,
	"submissionGuidelines" text,
	"icpNumber" text,
	"enableSubmissionLimit" boolean DEFAULT false NOT NULL,
	"dailySubmissionLimit" integer,
	"weeklySubmissionLimit" integer,
	"showBlacklistKeywords" boolean DEFAULT false NOT NULL,
	"hideStudentInfo" boolean DEFAULT true NOT NULL,
	"smtpEnabled" boolean DEFAULT false NOT NULL,
	"smtpHost" text,
	"smtpPort" integer DEFAULT 587,
	"smtpSecure" boolean DEFAULT false NOT NULL,
	"smtpUsername" text,
	"smtpPassword" text,
	"smtpFromEmail" text,
	"smtpFromName" text,
	"enableRequestTimeLimitation" boolean DEFAULT false NOT NULL,
	"forceBlockAllRequests" boolean DEFAULT false NOT NULL,
	"enableReplayRequests" boolean DEFAULT false NOT NULL,
	"monthlySubmissionLimit" integer,
	"gonganNumber" text,
	"enableCollaborativeSubmission" boolean DEFAULT true NOT NULL,
	"enableSubmissionRemarks" boolean DEFAULT false NOT NULL,
	"customOAuthEnabled" boolean DEFAULT false NOT NULL,
	"customOAuthDisplayName" text,
	"customOAuthAuthorizeUrl" text,
	"customOAuthTokenUrl" text,
	"customOAuthUserInfoUrl" text,
	"customOAuthScope" text,
	"customOAuthClientId" text,
	"customOAuthClientSecret" text,
	"customOAuthUserIdField" text,
	"customOAuthUsernameField" text,
	"customOAuthNameField" text,
	"customOAuthEmailField" text,
	"customOAuthAvatarField" text,
	"oauthRedirectUri" text,
	"oauthStateSecret" text,
	"oauthProviders" text DEFAULT '[]',
	"githubOAuthEnabled" boolean DEFAULT false NOT NULL,
	"githubClientId" text,
	"githubClientSecret" text,
	"casdoorOAuthEnabled" boolean DEFAULT false NOT NULL,
	"casdoorServerUrl" text,
	"casdoorClientId" text,
	"casdoorClientSecret" text,
	"casdoorOrganizationName" text,
	"googleOAuthEnabled" boolean DEFAULT false NOT NULL,
	"googleClientId" text,
	"googleClientSecret" text,
	"showBeianIcon" boolean DEFAULT false NOT NULL,
	"allowOAuthRegistration" boolean DEFAULT false NOT NULL,
	"captchaEnabled" boolean DEFAULT false NOT NULL,
	"captchaMaxFailures" integer DEFAULT 3 NOT NULL,
	"captchaProvider" text DEFAULT 'graphic' NOT NULL,
	"turnstileSiteKey" text,
	"turnstileSecretKey" text,
	"instance_id" text,
	"telemetryEnabled" boolean DEFAULT true NOT NULL,
	"enableCardCodeRequests" boolean DEFAULT false NOT NULL,
	"requireCardCodeForRequests" boolean DEFAULT false NOT NULL,
	"enableCardCodeLimitBypass" boolean DEFAULT false NOT NULL,
	"aggregateOAuthEnabled" boolean DEFAULT false NOT NULL,
	"aggregateOAuthAppId" text,
	"aggregateOAuthAppKey" text,
	"aggregateOAuthLoginType" text DEFAULT 'qq',
	"aggregateOAuthEndpoint" text DEFAULT 'https://a.idcfx.net/connect.php',
	"forcePasswordChangeOnFirstLogin" boolean DEFAULT false NOT NULL,
	"autoBackupEnabled" boolean DEFAULT false NOT NULL,
	"autoBackupConfig" text,
	"enabledPlatforms" text DEFAULT '["netease","tencent","bilibili","migu"]',
	"platformOrder" text DEFAULT '["netease","tencent","bilibili","migu"]'
);
--> statement-breakpoint
ALTER TABLE "user_status_logs" ADD CONSTRAINT "user_status_logs_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_status_logs" ADD CONSTRAINT "user_status_logs_operator_id_User_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_User_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_permissions" ADD CONSTRAINT "api_key_permissions_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCode" ADD CONSTRAINT "CardCode_lockedBy_User_id_fk" FOREIGN KEY ("lockedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCode" ADD CONSTRAINT "CardCode_redeemedBy_User_id_fk" FOREIGN KEY ("redeemedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Song" ADD CONSTRAINT "Song_cardCodeId_CardCode_id_fk" FOREIGN KEY ("cardCodeId") REFERENCES "public"."CardCode"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeRedeemLog" ADD CONSTRAINT "CardCodeRedeemLog_redeemedBy_User_id_fk" FOREIGN KEY ("redeemedBy") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeRedeemLog" ADD CONSTRAINT "CardCodeRedeemLog_songId_Song_id_fk" FOREIGN KEY ("songId") REFERENCES "public"."Song"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeRedeemLog" ADD CONSTRAINT "CardCodeRedeemLog_cardCodeId_CardCode_id_fk" FOREIGN KEY ("cardCodeId") REFERENCES "public"."CardCode"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_statusChangedBy_User_id_fk" FOREIGN KEY ("statusChangedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vote_user_song_idx" ON "Vote" USING btree ("userId" int4_ops,"songId" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_status_logs_created_at" ON "user_status_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_user_status_logs_user_id" ON "user_status_logs" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_active" ON "api_keys" USING btree ("is_active" bool_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_api_keys_created_by" ON "api_keys" USING btree ("created_by_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_key_permissions_api_key_id" ON "api_key_permissions" USING btree ("api_key_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_api_logs_api_key_id" ON "api_logs" USING btree ("api_key_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_api_logs_created_at" ON "api_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_api_logs_endpoint" ON "api_logs" USING btree ("endpoint" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_logs_status_code" ON "api_logs" USING btree ("status_code" int4_ops);--> statement-breakpoint
CREATE INDEX "song_collaborators_song_status_idx" ON "song_collaborators" USING btree ("song_id" int4_ops,"status" int4_ops);--> statement-breakpoint
CREATE INDEX "song_collaborators_user_status_idx" ON "song_collaborators" USING btree ("user_id" int4_ops,"status" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "CardCode_code_unique" ON "CardCode" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "song_card_code_id_idx" ON "Song" USING btree ("cardCodeId" int4_ops);--> statement-breakpoint
CREATE INDEX "song_requester_id_idx" ON "Song" USING btree ("requesterId" int4_ops);--> statement-breakpoint
CREATE INDEX "song_semester_created_at_idx" ON "Song" USING btree ("semester" timestamp_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "CardCodeRedeemLog_cardCodeId_idx" ON "CardCodeRedeemLog" USING btree ("cardCodeId" int4_ops);--> statement-breakpoint
CREATE INDEX "CardCodeRedeemLog_redeemedAt_idx" ON "CardCodeRedeemLog" USING btree ("redeemedAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "CardCodeRedeemLog_redeemedBy_idx" ON "CardCodeRedeemLog" USING btree ("redeemedBy" int4_ops);--> statement-breakpoint
CREATE INDEX "card_code_redeem_log_card_code_id_idx" ON "CardCodeRedeemLog" USING btree ("cardCodeId" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "song_replay_requests_pending_song_user_unique" ON "song_replay_requests" USING btree ("song_id" int4_ops,"user_id" int4_ops) WHERE (status = 'PENDING'::replay_request_status);--> statement-breakpoint
CREATE INDEX "song_replay_requests_user_status_song_idx" ON "song_replay_requests" USING btree ("user_id" enum_ops,"status" int4_ops,"song_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_schedule_draft_date" ON "Schedule" USING btree ("isDraft" timestamp_ops,"playDate" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_schedule_is_draft" ON "Schedule" USING btree ("isDraft" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_schedule_published_at" ON "Schedule" USING btree ("publishedAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "schedule_published_date_idx" ON "Schedule" USING btree ("isDraft" bool_ops,"playDate" bool_ops);--> statement-breakpoint
CREATE INDEX "schedule_published_song_idx" ON "Schedule" USING btree ("isDraft" timestamp_ops,"songId" timestamp_ops,"playDate" timestamp_ops);--> statement-breakpoint
CREATE INDEX "PasswordAuditLog_user_created_idx" ON "PasswordAuditLog" USING btree ("userId" int4_ops,"createdAt" int4_ops);--> statement-breakpoint
CREATE INDEX "PasswordRateLimit_reset_idx" ON "PasswordRateLimit" USING btree ("resetAt" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_status" ON "User" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "notification_batch_id_idx" ON "Notification" USING btree ("batchId" text_ops);--> statement-breakpoint
CREATE INDEX "notification_user_important_read_created_idx" ON "Notification" USING btree ("userId" timestamp_ops,"userDeleted" timestamp_ops,"important" timestamp_ops,"read" timestamp_ops,"createdAt" int4_ops);--> statement-breakpoint
CREATE INDEX "backup_history_created_at_idx" ON "BackupHistory" USING btree ("createdAt" timestamp_ops);
*/