ALTER TABLE "SystemSettings" ADD COLUMN "instance_id" text;
ALTER TYPE "user_status" ADD VALUE IF NOT EXISTS 'graduate';