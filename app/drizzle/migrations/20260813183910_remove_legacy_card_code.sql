ALTER TABLE "CardCodeRedeemLog" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "CardCode" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "CardCodeRedeemLog" CASCADE;--> statement-breakpoint
DROP TABLE "CardCode" CASCADE;--> statement-breakpoint
ALTER TABLE "SongQuotaTransaction" DROP CONSTRAINT "SongQuotaTransaction_legacyCardId_CardCode_id_fk";
--> statement-breakpoint
ALTER TABLE "Song" DROP CONSTRAINT "Song_cardCodeId_CardCode_id_fk";
--> statement-breakpoint
DROP INDEX "song_quota_transaction_legacy_card_id_idx";--> statement-breakpoint
DROP INDEX "song_card_code_id_idx";--> statement-breakpoint
ALTER TABLE "SongQuotaTransaction" DROP COLUMN "legacyCardId";--> statement-breakpoint
ALTER TABLE "Song" DROP COLUMN "cardCodeId";--> statement-breakpoint
ALTER TABLE "SystemSettings" DROP COLUMN "enableCardCodeRequests";--> statement-breakpoint
ALTER TABLE "SystemSettings" DROP COLUMN "requireCardCodeForRequests";--> statement-breakpoint
ALTER TABLE "SystemSettings" DROP COLUMN "enableCardCodeLimitBypass";--> statement-breakpoint
ALTER TABLE "SystemSettings" DROP COLUMN "legacyCardConversionEnabled";--> statement-breakpoint
DROP TYPE "public"."card_code_status";