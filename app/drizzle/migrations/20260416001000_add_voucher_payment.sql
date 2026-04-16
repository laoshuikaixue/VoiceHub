DO $$ BEGIN
  CREATE TYPE voucher_redeem_task_status AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE voucher_code_status AS ENUM ('ACTIVE', 'USED', 'DISABLED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "SystemSettings"
  ADD COLUMN IF NOT EXISTS "enableVoucherPayment" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "voucherRedeemDeadlineMinutes" integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "voucherRemindWindowMinutes" integer NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS "voucher_redeem_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" integer NOT NULL,
  "song_id" integer NOT NULL,
  "status" voucher_redeem_task_status NOT NULL DEFAULT 'PENDING',
  "redeem_deadline_at" timestamp with time zone NOT NULL,
  "token_hash" varchar(255) NOT NULL,
  "remind_sent_at" timestamp with time zone,
  "redeemed_at" timestamp with time zone,
  "voucher_code_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "voucher_redeem_tasks_song_id_unique" UNIQUE("song_id"),
  CONSTRAINT "voucher_redeem_tasks_token_hash_unique" UNIQUE("token_hash")
);

CREATE INDEX IF NOT EXISTS "voucher_redeem_tasks_status_deadline_idx"
  ON "voucher_redeem_tasks" ("status", "redeem_deadline_at");

CREATE TABLE IF NOT EXISTS "user_song_restrictions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" integer NOT NULL UNIQUE,
  "reason" text,
  "created_by_user_id" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "voucher_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code_hash" varchar(255) NOT NULL,
  "code_tail" varchar(16) NOT NULL,
  "status" voucher_code_status NOT NULL DEFAULT 'ACTIVE',
  "used_by_user_id" integer,
  "used_at" timestamp with time zone,
  "used_task_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "voucher_codes_code_hash_unique" UNIQUE("code_hash")
);

DO $$ BEGIN
  ALTER TABLE "voucher_redeem_tasks"
    ADD CONSTRAINT "voucher_redeem_tasks_user_id_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "voucher_redeem_tasks"
    ADD CONSTRAINT "voucher_redeem_tasks_song_id_song_fk"
    FOREIGN KEY ("song_id") REFERENCES "public"."Song"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "voucher_redeem_tasks"
    ADD CONSTRAINT "voucher_redeem_tasks_voucher_code_id_fk"
    FOREIGN KEY ("voucher_code_id") REFERENCES "public"."voucher_codes"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_song_restrictions"
    ADD CONSTRAINT "user_song_restrictions_user_id_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_song_restrictions"
    ADD CONSTRAINT "user_song_restrictions_created_by_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."User"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "voucher_codes"
    ADD CONSTRAINT "voucher_codes_used_by_user_id_fk"
    FOREIGN KEY ("used_by_user_id") REFERENCES "public"."User"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "voucher_codes"
    ADD CONSTRAINT "voucher_codes_used_task_id_fk"
    FOREIGN KEY ("used_task_id") REFERENCES "public"."voucher_redeem_tasks"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
