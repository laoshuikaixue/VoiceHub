CREATE TABLE "AstrbotBindingCode" (
	"userId" integer NOT NULL,
	"platform" text NOT NULL,
	"codeHash" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"consumedAt" timestamp with time zone,
	CONSTRAINT "AstrbotBindingCode_userId_platform_pk" PRIMARY KEY("userId","platform")
);
--> statement-breakpoint
CREATE TABLE "AstrbotBinding" (
	"userId" integer NOT NULL,
	"platform" text NOT NULL,
	"adapter" text NOT NULL,
	"umo" text NOT NULL,
	"boundAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "AstrbotBinding_userId_platform_pk" PRIMARY KEY("userId","platform")
);
--> statement-breakpoint
CREATE TABLE "AstrbotOutbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"title" text,
	"message" text NOT NULL,
	"url" text,
	"umos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"targetOwners" jsonb,
	"broadcast" boolean DEFAULT false NOT NULL,
	"eventKey" text,
	"notifyAfter" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"leasedUntil" timestamp with time zone,
	"claimToken" text,
	"deliveredAt" timestamp with time zone,
	"failedAt" timestamp with time zone,
	"lastError" text
);
--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotPlatforms" jsonb DEFAULT '{"qq":false,"wecom":false,"dingtalk":false,"lark":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotBaseUrl" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotToken" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotBroadcastEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotGroupTargets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotGroupEvents" jsonb;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotGroupThrottle" jsonb;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotPushMode" text DEFAULT 'push' NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotWeeklyConfig" jsonb DEFAULT '{"showCover":true,"showSequence":true,"showRequester":true,"showVotes":false,"showPlayTime":true,"showDate":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "AstrbotBindingCode" ADD CONSTRAINT "AstrbotBindingCode_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AstrbotBinding" ADD CONSTRAINT "AstrbotBinding_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "AstrbotBindingCode_hash_unique" ON "AstrbotBindingCode" USING btree ("codeHash");--> statement-breakpoint
CREATE UNIQUE INDEX "AstrbotBinding_umo_unique" ON "AstrbotBinding" USING btree ("umo");--> statement-breakpoint
CREATE INDEX "astrbot_outbox_pending_idx" ON "AstrbotOutbox" USING btree ("deliveredAt","failedAt","id");