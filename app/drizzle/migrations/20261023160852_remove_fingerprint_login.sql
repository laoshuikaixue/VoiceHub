ALTER TABLE "browser_fingerprints" RENAME COLUMN "last_login_ip" TO "last_used_ip";--> statement-breakpoint
ALTER TABLE "SystemSettings" RENAME COLUMN "fingerprintLoginEnabled" TO "fingerprintDataEnabled";--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "fingerprintDataEnabled" boolean DEFAULT false NOT NULL;