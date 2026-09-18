CREATE TABLE "MusicSourceConfigState" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MusicSourcePluginRevision" (
	"pluginId" uuid NOT NULL,
	"revision" integer NOT NULL,
	"scriptUrl" text NOT NULL,
	"protocol" text NOT NULL,
	"variables" text NOT NULL,
	"catalog" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "MusicSourcePluginRevision_pluginId_revision_pk" PRIMARY KEY("pluginId","revision")
);
--> statement-breakpoint
CREATE TABLE "MusicSourcePlugin" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"desiredRevision" integer DEFAULT 1 NOT NULL,
	"activeRevision" integer,
	"activeHash" text,
	"legacyPlatformKey" text,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "Song" ADD COLUMN "musicSourceData" jsonb;--> statement-breakpoint
ALTER TABLE "MusicSourcePluginRevision" ADD CONSTRAINT "MusicSourcePluginRevision_pluginId_MusicSourcePlugin_id_fk" FOREIGN KEY ("pluginId") REFERENCES "public"."MusicSourcePlugin"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "music_source_legacy_key" ON "MusicSourcePlugin" USING btree ("legacyPlatformKey");