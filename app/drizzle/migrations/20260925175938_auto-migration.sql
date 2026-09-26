CREATE TABLE "AstrbotBinding" (
	"userId" integer NOT NULL,
	"platform" text NOT NULL,
	"adapter" text NOT NULL,
	"umo" text NOT NULL,
	"boundAt" timestamp,
	CONSTRAINT "AstrbotBinding_userId_platform_pk" PRIMARY KEY("userId","platform")
);
--> statement-breakpoint
ALTER TABLE "AstrbotBindingCode" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "astrbotPlatforms" jsonb DEFAULT '{"qq":false,"wecom":false,"dingtalk":false,"lark":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "AstrbotBinding" ADD CONSTRAINT "AstrbotBinding_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "AstrbotBinding_umo_unique" ON "AstrbotBinding" USING btree ("umo");