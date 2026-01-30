CREATE TYPE "public"."collaborator_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "collaboration_logs"
(
    "id"              uuid PRIMARY KEY         DEFAULT gen_random_uuid() NOT NULL,
    "collaborator_id" uuid                                               NOT NULL,
    "action"          varchar(50)                                        NOT NULL,
    "operator_id"     integer                                            NOT NULL,
    "ip_address"      text,
    "created_at"      timestamp with time zone DEFAULT now()             NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RequestTime"
(
    "id"          serial PRIMARY KEY         NOT NULL,
    "createdAt"   timestamp(6) DEFAULT now() NOT NULL,
    "updatedAt"   timestamp(6) DEFAULT now() NOT NULL,
    "name"        text                       NOT NULL,
    "startTime"   timestamp                  NOT NULL,
    "endTime"     timestamp                  NOT NULL,
    "enabled"     boolean      DEFAULT true  NOT NULL,
    "description" text,
    "expected"    bigint       DEFAULT 0     NOT NULL,
    "accepted"    bigint       DEFAULT 0     NOT NULL,
    "past"        boolean      DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_collaborators"
(
    "id"         uuid PRIMARY KEY         DEFAULT gen_random_uuid() NOT NULL,
    "song_id"    integer                                            NOT NULL,
    "user_id"    integer                                            NOT NULL,
    "status"     "collaborator_status"    DEFAULT 'PENDING'         NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()             NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()             NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Song"
    ADD COLUMN "hitRequestId" integer;--> statement-breakpoint
ALTER TABLE "SystemSettings"
    ADD COLUMN "enableRequestTimeLimitation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings"
    ADD COLUMN "forceBlockAllRequests" boolean DEFAULT false NOT NULL;