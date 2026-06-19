DO $$ BEGIN
  CREATE TYPE "public"."card_code_status" AS ENUM('AVAILABLE','LOCKED','REDEEMED','INVALID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "CardCode" (
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
);--> statement-breakpoint

ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "cardCodeId" integer;--> statement-breakpoint

ALTER TABLE "SystemSettings"
  ADD COLUMN IF NOT EXISTS "enableCardCodeRequests" boolean DEFAULT false NOT NULL;--> statement-breakpoint

ALTER TABLE "SystemSettings"
  ADD COLUMN IF NOT EXISTS "requireCardCodeForRequests" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "CardCode_code_unique" ON "CardCode" ("code");--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "CardCode"
    ADD CONSTRAINT "CardCode_lockedBy_User_id_fk"
    FOREIGN KEY ("lockedBy") REFERENCES "public"."User"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "CardCode"
    ADD CONSTRAINT "CardCode_redeemedBy_User_id_fk"
    FOREIGN KEY ("redeemedBy") REFERENCES "public"."User"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "Song"
    ADD CONSTRAINT "Song_cardCodeId_CardCode_id_fk"
    FOREIGN KEY ("cardCodeId") REFERENCES "public"."CardCode"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "CardCodeRedeemLog" (
  "id" serial PRIMARY KEY NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "cardCodeId" integer NOT NULL,
  "codeSnapshot" text NOT NULL,
  "redeemedBy" integer NOT NULL,
  "redeemedAt" timestamp DEFAULT now() NOT NULL,
  "source" text DEFAULT 'UNKNOWN' NOT NULL,
  "songId" integer
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "CardCodeRedeemLog_cardCodeId_idx" ON "CardCodeRedeemLog" ("cardCodeId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "CardCodeRedeemLog_redeemedBy_idx" ON "CardCodeRedeemLog" ("redeemedBy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "CardCodeRedeemLog_redeemedAt_idx" ON "CardCodeRedeemLog" ("redeemedAt");--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "CardCodeRedeemLog"
    ADD CONSTRAINT "CardCodeRedeemLog_cardCodeId_CardCode_id_fk"
    FOREIGN KEY ("cardCodeId") REFERENCES "public"."CardCode"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "CardCodeRedeemLog"
    ADD CONSTRAINT "CardCodeRedeemLog_redeemedBy_User_id_fk"
    FOREIGN KEY ("redeemedBy") REFERENCES "public"."User"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "CardCodeRedeemLog"
    ADD CONSTRAINT "CardCodeRedeemLog_songId_Song_id_fk"
    FOREIGN KEY ("songId") REFERENCES "public"."Song"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
