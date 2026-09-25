CREATE TABLE "AstrbotBindingCode" (
	"userId" integer PRIMARY KEY NOT NULL,
	"codeHash" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotBaseUrl" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotToken" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotBroadcastEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "astrbotUmo" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "astrbotPlatform" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "astrbotBoundAt" timestamp;--> statement-breakpoint
ALTER TABLE "AstrbotBindingCode" ADD CONSTRAINT "AstrbotBindingCode_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "AstrbotBindingCode_hash_unique" ON "AstrbotBindingCode" USING btree ("codeHash");--> statement-breakpoint
CREATE UNIQUE INDEX "User_astrbot_umo_unique" ON "User" USING btree ("astrbotUmo");