CREATE TABLE "browser_fingerprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"fingerprint_hash" text NOT NULL,
	"label" text,
	"browser" text,
	"operating_system" text,
	"device" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_login_ip" text
);
--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "fingerprintLoginEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_fingerprints" ADD CONSTRAINT "browser_fingerprints_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "browser_fingerprints_hash_unique" ON "browser_fingerprints" USING btree ("fingerprint_hash");--> statement-breakpoint
CREATE INDEX "browser_fingerprints_user_idx" ON "browser_fingerprints" USING btree ("user_id");