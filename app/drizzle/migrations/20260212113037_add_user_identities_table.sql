CREATE TABLE "UserIdentity" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" text NOT NULL,
	"providerUserId" text NOT NULL,
	"providerUsername" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserIdentity_provider_providerUserId_unique" UNIQUE("provider","providerUserId")
);
--> statement-breakpoint
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;