ALTER TABLE "CardCodeRedeemLog"
  ALTER COLUMN "cardCodeId" DROP NOT NULL;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "CardCodeRedeemLog"
    DROP CONSTRAINT IF EXISTS "CardCodeRedeemLog_cardCodeId_CardCode_id_fk";
EXCEPTION
  WHEN undefined_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "CardCodeRedeemLog"
    ADD CONSTRAINT "CardCodeRedeemLog_cardCodeId_CardCode_id_fk"
    FOREIGN KEY ("cardCodeId") REFERENCES "public"."CardCode"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
