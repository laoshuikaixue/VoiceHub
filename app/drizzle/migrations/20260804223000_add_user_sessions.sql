CREATE TABLE "user_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "token_version" integer DEFAULT 0 NOT NULL,
  "ip_address" text NOT NULL,
  "user_agent" text,
  "browser" varchar(64) DEFAULT 'Unknown' NOT NULL,
  "device_type" varchar(32) DEFAULT 'unknown' NOT NULL,
  "last_path" varchar(500),
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by" integer,
  "revocation_reason" varchar(255),
  CONSTRAINT "user_sessions_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "user_sessions_user_active_idx" ON "user_sessions" USING btree ("user_id", "last_active_at");
--> statement-breakpoint
CREATE INDEX "user_sessions_last_active_idx" ON "user_sessions" USING btree ("last_active_at");
--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "user_sessions_browser_idx" ON "user_sessions" USING btree ("browser");
--> statement-breakpoint
CREATE INDEX "user_sessions_device_type_idx" ON "user_sessions" USING btree ("device_type");
