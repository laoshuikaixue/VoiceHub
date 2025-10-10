CREATE TABLE IF NOT EXISTS "EmailTemplate" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"html" text NOT NULL,
	"updatedByUserId" integer
);
