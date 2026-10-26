CREATE TYPE "public"."card_code_assignment_status" AS ENUM('ASSIGNED', 'USED', 'RECYCLED', 'FAILED');--> statement-breakpoint
ALTER TYPE "public"."card_code_status" ADD VALUE 'ASSIGNED' BEFORE 'LOCKED';--> statement-breakpoint
CREATE TABLE "CardCodeAssignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"cardCodeId" integer,
	"codeSnapshot" text NOT NULL,
	"userId" integer,
	"userNameSnapshot" text,
	"assignedBy" integer,
	"assignedByName" text,
	"assignedAt" timestamp DEFAULT now() NOT NULL,
	"status" "card_code_assignment_status" DEFAULT 'ASSIGNED' NOT NULL,
	"usedAt" timestamp,
	"recycledAt" timestamp,
	"recycledBy" integer,
	"recycledByName" text,
	"recycleReason" text,
	"failureReason" text,
	"notifyStatus" text DEFAULT 'SKIPPED' NOT NULL,
	"notifyError" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "CardCodeDispatchPlan" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"countPerUser" integer DEFAULT 1 NOT NULL,
	"recipientIds" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"note" text,
	"notify" boolean DEFAULT true NOT NULL,
	"prefix" text,
	"scheduleType" text DEFAULT 'once' NOT NULL,
	"startAt" timestamp NOT NULL,
	"endAt" timestamp,
	"weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"dayOfMonth" integer,
	"nextRunAt" timestamp,
	"lastRunAt" timestamp,
	"runningAt" timestamp,
	"lastStatus" text,
	"lastMessage" text,
	"runCount" integer DEFAULT 0 NOT NULL,
	"createdBy" integer,
	"createdByName" text,
	CONSTRAINT "card_code_dispatch_plan_schedule_type" CHECK ("CardCodeDispatchPlan"."scheduleType" IN ('once', 'daily', 'weekly', 'monthly')),
	CONSTRAINT "card_code_dispatch_plan_count_per_user" CHECK ("CardCodeDispatchPlan"."countPerUser" BETWEEN 1 AND 100),
	CONSTRAINT "card_code_dispatch_plan_day_of_month" CHECK ("CardCodeDispatchPlan"."dayOfMonth" IS NULL OR "CardCodeDispatchPlan"."dayOfMonth" BETWEEN 1 AND 31),
	CONSTRAINT "card_code_dispatch_plan_end_after_start" CHECK ("CardCodeDispatchPlan"."endAt" IS NULL OR "CardCodeDispatchPlan"."endAt" > "CardCodeDispatchPlan"."startAt")
);
--> statement-breakpoint
CREATE TABLE "CardCodeDispatchRun" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"planId" integer,
	"planName" text,
	"triggerSource" text DEFAULT 'SCHEDULED' NOT NULL,
	"startedAt" timestamp NOT NULL,
	"finishedAt" timestamp,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"assignedCount" integer DEFAULT 0 NOT NULL,
	"failedCount" integer DEFAULT 0 NOT NULL,
	"servedRecipients" integer DEFAULT 0 NOT NULL,
	"message" text
);
--> statement-breakpoint
ALTER TABLE "CardCode" ADD COLUMN "assignedTo" integer;--> statement-breakpoint
ALTER TABLE "CardCode" ADD COLUMN "assignedAt" timestamp;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "CardCodeAssignment" ADD CONSTRAINT "CardCodeAssignment_cardCodeId_CardCode_id_fk" FOREIGN KEY ("cardCodeId") REFERENCES "public"."CardCode"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeAssignment" ADD CONSTRAINT "CardCodeAssignment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeAssignment" ADD CONSTRAINT "CardCodeAssignment_assignedBy_User_id_fk" FOREIGN KEY ("assignedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeAssignment" ADD CONSTRAINT "CardCodeAssignment_recycledBy_User_id_fk" FOREIGN KEY ("recycledBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeDispatchPlan" ADD CONSTRAINT "CardCodeDispatchPlan_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeDispatchRun" ADD CONSTRAINT "CardCodeDispatchRun_planId_CardCodeDispatchPlan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."CardCodeDispatchPlan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_code_assignment_card_code_id_idx" ON "CardCodeAssignment" USING btree ("cardCodeId");--> statement-breakpoint
CREATE UNIQUE INDEX "card_code_assignment_active_per_card_unique" ON "CardCodeAssignment" USING btree ("cardCodeId") WHERE "CardCodeAssignment"."status" = 'ASSIGNED';--> statement-breakpoint
CREATE INDEX "card_code_assignment_user_status_idx" ON "CardCodeAssignment" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "card_code_assignment_status_assigned_at_idx" ON "CardCodeAssignment" USING btree ("status","assignedAt");--> statement-breakpoint
CREATE INDEX "card_code_assignment_assigned_at_idx" ON "CardCodeAssignment" USING btree ("assignedAt");--> statement-breakpoint
CREATE INDEX "card_code_dispatch_plan_due_idx" ON "CardCodeDispatchPlan" USING btree ("enabled","nextRunAt");--> statement-breakpoint
CREATE INDEX "card_code_dispatch_run_plan_started_idx" ON "CardCodeDispatchRun" USING btree ("planId","startedAt");--> statement-breakpoint
ALTER TABLE "CardCode" ADD CONSTRAINT "CardCode_assignedTo_User_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_code_assigned_to_status_idx" ON "CardCode" USING btree ("assignedTo","status");--> statement-breakpoint
CREATE INDEX "user_tags_gin_idx" ON "User" USING gin ("tags");--> statement-breakpoint
ALTER TABLE "CardCode" ADD CONSTRAINT "card_code_assigned_status_has_holder" CHECK (CAST("CardCode"."status" AS text) <> 'ASSIGNED' OR "CardCode"."assignedTo" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "CardCode" ADD CONSTRAINT "card_code_unassigned_status_no_holder" CHECK (CAST("CardCode"."status" AS text) NOT IN ('AVAILABLE', 'INVALID') OR "CardCode"."assignedTo" IS NULL);