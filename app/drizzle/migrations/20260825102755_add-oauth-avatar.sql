ALTER TABLE "UserIdentity" ADD COLUMN "avatar" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "avatarProvider" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "avatarProviderUserId" text;