CREATE TYPE "public"."user_status" AS ENUM('active', 'withdrawn');--> statement-breakpoint
CREATE TABLE "api_key_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"permission" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(10) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "api_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid,
	"endpoint" varchar(500) NOT NULL,
	"method" varchar(10) NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"status_code" integer NOT NULL,
	"response_time_ms" integer NOT NULL,
	"request_body" text,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "user_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"old_status" "user_status",
	"new_status" "user_status" NOT NULL,
	"reason" text,
	"operator_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Song" ALTER COLUMN "playedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "statusChangedAt" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "statusChangedBy" integer;