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
	"createdByName" text
);
--> statement-breakpoint
ALTER TABLE "CardCodeDispatchPlan" ADD CONSTRAINT "CardCodeDispatchPlan_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_code_dispatch_plan_next_run_at_idx" ON "CardCodeDispatchPlan" USING btree ("nextRunAt");--> statement-breakpoint
CREATE INDEX "card_code_dispatch_plan_enabled_idx" ON "CardCodeDispatchPlan" USING btree ("enabled");