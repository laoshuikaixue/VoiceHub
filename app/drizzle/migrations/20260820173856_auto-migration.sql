CREATE TABLE "GradeClass" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"grade" text NOT NULL,
	"class" text NOT NULL,
	CONSTRAINT "GradeClass_grade_class_unique" UNIQUE("grade","class")
);
