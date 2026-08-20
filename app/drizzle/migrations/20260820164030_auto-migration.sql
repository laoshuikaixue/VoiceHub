ALTER TYPE "public"."user_status" ADD VALUE 'pending' BEFORE 'withdrawn';--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "allowRegister" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "registerRequiresApproval" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "remark" text;