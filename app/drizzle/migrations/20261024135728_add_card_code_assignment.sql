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
ALTER TABLE "CardCode" ADD COLUMN "assignedTo" integer;--> statement-breakpoint
ALTER TABLE "CardCode" ADD COLUMN "assignedAt" timestamp;--> statement-breakpoint
ALTER TABLE "CardCodeAssignment" ADD CONSTRAINT "CardCodeAssignment_cardCodeId_CardCode_id_fk" FOREIGN KEY ("cardCodeId") REFERENCES "public"."CardCode"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeAssignment" ADD CONSTRAINT "CardCodeAssignment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeAssignment" ADD CONSTRAINT "CardCodeAssignment_assignedBy_User_id_fk" FOREIGN KEY ("assignedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardCodeAssignment" ADD CONSTRAINT "CardCodeAssignment_recycledBy_User_id_fk" FOREIGN KEY ("recycledBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_code_assignment_card_code_id_idx" ON "CardCodeAssignment" USING btree ("cardCodeId");--> statement-breakpoint
CREATE INDEX "card_code_assignment_user_id_idx" ON "CardCodeAssignment" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "card_code_assignment_status_idx" ON "CardCodeAssignment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "card_code_assignment_assigned_at_idx" ON "CardCodeAssignment" USING btree ("assignedAt");--> statement-breakpoint
ALTER TABLE "CardCode" ADD CONSTRAINT "CardCode_assignedTo_User_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;