CREATE TYPE "public"."song_quota_source" AS ENUM('PERIOD_EXPIRED', 'PERIOD_GRANT', 'ADMIN_ADJUST', 'ADMIN_BULK_ADJUST', 'OPEN_API_ADJUST', 'SONG_REQUEST', 'SONG_WITHDRAW_RETURN', 'SONG_WITHDRAW_EXPIRED', 'LEGACY_CARD_CONVERT');--> statement-breakpoint
CREATE TYPE "public"."song_quota_type" AS ENUM('PERIODIC', 'PERMANENT');--> statement-breakpoint
CREATE TABLE "SongQuotaAccount" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"periodicBalance" integer DEFAULT 0 NOT NULL,
	"permanentBalance" integer DEFAULT 0 NOT NULL,
	"periodKey" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "SongQuotaAccount_userId_unique" UNIQUE("userId"),
	CONSTRAINT "song_quota_account_periodic_balance_nonnegative" CHECK ("SongQuotaAccount"."periodicBalance" >= 0),
	CONSTRAINT "song_quota_account_permanent_balance_nonnegative" CHECK ("SongQuotaAccount"."permanentBalance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "SongQuotaTransaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" integer NOT NULL,
	"quotaType" "song_quota_type" NOT NULL,
	"source" "song_quota_source" NOT NULL,
	"delta" integer NOT NULL,
	"balanceAfter" integer NOT NULL,
	"periodKey" text,
	"idempotencyKey" text,
	"requestFingerprint" text,
	"songId" integer,
	"administratorId" integer,
	"apiKeyId" uuid,
	"publicDescription" text,
	"internalNote" text,
	"externalReference" text,
	"snapshot" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "SongQuotaTransaction_idempotencyKey_unique" UNIQUE("idempotencyKey"),
	CONSTRAINT "song_quota_transaction_balance_after_nonnegative" CHECK ("SongQuotaTransaction"."balanceAfter" >= 0)
);
--> statement-breakpoint
ALTER TABLE "Song" DROP CONSTRAINT "Song_cardCodeId_CardCode_id_fk";
--> statement-breakpoint
DROP INDEX "card_code_redeem_log_card_code_id_idx";--> statement-breakpoint
DROP INDEX "song_card_code_id_idx";--> statement-breakpoint
ALTER TABLE "SystemSettings" ALTER COLUMN "enabledPlatforms" SET DEFAULT '["netease","tencent","bilibili","migu"]';--> statement-breakpoint
ALTER TABLE "SystemSettings" ALTER COLUMN "platformOrder" SET DEFAULT '["netease","tencent","bilibili","migu"]';--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "requestId" text;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "quotaConsumed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "quotaType" "song_quota_type";--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "quotaTransactionId" integer;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "quotaPeriodKey" text;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "quotaReturned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "quotaReturnTransactionId" integer;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "songQuotaEnabled" boolean;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "songQuotaPeriodType" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "songQuotaPeriodAmount" integer;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "adminSongQuotaExempt" boolean;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "blockOnSongQuotaInsufficient" boolean;--> statement-breakpoint
ALTER TABLE "SongQuotaAccount" ADD CONSTRAINT "SongQuotaAccount_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SongQuotaTransaction" ADD CONSTRAINT "SongQuotaTransaction_accountId_SongQuotaAccount_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."SongQuotaAccount"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SongQuotaTransaction" ADD CONSTRAINT "SongQuotaTransaction_songId_Song_id_fk" FOREIGN KEY ("songId") REFERENCES "public"."Song"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SongQuotaTransaction" ADD CONSTRAINT "SongQuotaTransaction_administratorId_User_id_fk" FOREIGN KEY ("administratorId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SongQuotaTransaction" ADD CONSTRAINT "SongQuotaTransaction_apiKeyId_api_keys_id_fk" FOREIGN KEY ("apiKeyId") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "song_quota_transaction_account_created_at_idx" ON "SongQuotaTransaction" USING btree ("accountId","createdAt");--> statement-breakpoint
CREATE INDEX "song_quota_transaction_song_id_idx" ON "SongQuotaTransaction" USING btree ("songId");--> statement-breakpoint
CREATE INDEX "song_quota_transaction_administrator_id_idx" ON "SongQuotaTransaction" USING btree ("administratorId");--> statement-breakpoint
CREATE INDEX "song_quota_transaction_api_key_id_idx" ON "SongQuotaTransaction" USING btree ("apiKeyId");--> statement-breakpoint
ALTER TABLE "Song" ADD CONSTRAINT "Song_quotaTransactionId_SongQuotaTransaction_id_fk" FOREIGN KEY ("quotaTransactionId") REFERENCES "public"."SongQuotaTransaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Song" ADD CONSTRAINT "Song_quotaReturnTransactionId_SongQuotaTransaction_id_fk" FOREIGN KEY ("quotaReturnTransactionId") REFERENCES "public"."SongQuotaTransaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "song_quota_transaction_id_unique" ON "Song" USING btree ("quotaTransactionId");--> statement-breakpoint
CREATE UNIQUE INDEX "song_quota_return_transaction_id_unique" ON "Song" USING btree ("quotaReturnTransactionId");--> statement-breakpoint
CREATE UNIQUE INDEX "song_request_id_unique" ON "Song" USING btree ("requestId");--> statement-breakpoint
ALTER TABLE "Song" DROP COLUMN "cardCodeId";--> statement-breakpoint
ALTER TABLE "SystemSettings" DROP COLUMN "enableCardCodeRequests";--> statement-breakpoint
ALTER TABLE "SystemSettings" DROP COLUMN "requireCardCodeForRequests";--> statement-breakpoint
ALTER TABLE "SystemSettings" DROP COLUMN "enableCardCodeLimitBypass";--> statement-breakpoint
ALTER TABLE "Song" ADD CONSTRAINT "song_quota_consumption_consistent" CHECK ((
    ("Song"."quotaConsumed" = false AND "Song"."quotaType" IS NULL AND "Song"."quotaTransactionId" IS NULL AND "Song"."quotaPeriodKey" IS NULL AND "Song"."quotaReturned" = false AND "Song"."quotaReturnTransactionId" IS NULL)
    OR
    ("Song"."quotaConsumed" = true AND "Song"."quotaType" IS NOT NULL AND "Song"."quotaTransactionId" IS NOT NULL AND ("Song"."quotaType" = 'PERMANENT' OR "Song"."quotaPeriodKey" IS NOT NULL) AND (("Song"."quotaReturned" = false AND "Song"."quotaReturnTransactionId" IS NULL) OR ("Song"."quotaReturned" = true AND "Song"."quotaReturnTransactionId" IS NOT NULL)))
  ));