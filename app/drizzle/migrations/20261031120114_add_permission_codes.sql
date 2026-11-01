ALTER TABLE "SystemSettings" ADD COLUMN "rolePermissionTemplates" jsonb;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "permissions" jsonb;