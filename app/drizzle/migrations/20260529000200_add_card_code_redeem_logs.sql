CREATE TABLE IF NOT EXISTS "CardCodeRedeemLog" (
  "id" serial PRIMARY KEY NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "cardCodeId" integer NOT NULL,
  "codeSnapshot" text NOT NULL,
  "redeemedBy" integer NOT NULL,
  "redeemedAt" timestamp DEFAULT now() NOT NULL,
  "source" text DEFAULT 'UNKNOWN' NOT NULL,
  "songId" integer
);

CREATE INDEX IF NOT EXISTS "CardCodeRedeemLog_cardCodeId_idx" ON "CardCodeRedeemLog" ("cardCodeId");
CREATE INDEX IF NOT EXISTS "CardCodeRedeemLog_redeemedBy_idx" ON "CardCodeRedeemLog" ("redeemedBy");
CREATE INDEX IF NOT EXISTS "CardCodeRedeemLog_redeemedAt_idx" ON "CardCodeRedeemLog" ("redeemedAt");

DO $$ BEGIN
  ALTER TABLE "CardCodeRedeemLog"
    ADD CONSTRAINT "CardCodeRedeemLog_cardCodeId_CardCode_id_fk"
    FOREIGN KEY ("cardCodeId") REFERENCES "public"."CardCode"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CardCodeRedeemLog"
    ADD CONSTRAINT "CardCodeRedeemLog_redeemedBy_User_id_fk"
    FOREIGN KEY ("redeemedBy") REFERENCES "public"."User"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CardCodeRedeemLog"
    ADD CONSTRAINT "CardCodeRedeemLog_songId_Song_id_fk"
    FOREIGN KEY ("songId") REFERENCES "public"."Song"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
