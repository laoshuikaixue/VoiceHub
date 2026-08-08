CREATE TABLE "operations_dependency_buckets" (
  "bucket_start" timestamp with time zone NOT NULL,
  "instance_id" varchar(128) NOT NULL,
  "source" varchar(32) NOT NULL,
  "call_count" integer DEFAULT 0 NOT NULL,
  "success_count" integer DEFAULT 0 NOT NULL,
  "empty_result_count" integer DEFAULT 0 NOT NULL,
  "semantic_failure_count" integer DEFAULT 0 NOT NULL,
  "timeout_count" integer DEFAULT 0 NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "fallback_count" integer DEFAULT 0 NOT NULL,
  "total_duration_ms" integer DEFAULT 0 NOT NULL,
  "max_duration_ms" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "operations_dependency_buckets_instance_source_bucket_unique" UNIQUE("bucket_start", "instance_id", "source")
);
--> statement-breakpoint
CREATE INDEX "operations_dependency_buckets_bucket_start_idx" ON "operations_dependency_buckets" USING btree ("bucket_start");
--> statement-breakpoint
CREATE INDEX "operations_dependency_buckets_source_bucket_start_idx" ON "operations_dependency_buckets" USING btree ("source", "bucket_start");
