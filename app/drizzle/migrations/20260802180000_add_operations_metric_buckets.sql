CREATE TABLE "operations_metric_buckets" (
  "bucket_start" timestamp with time zone NOT NULL,
  "instance_id" varchar(128) NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "client_error_count" integer DEFAULT 0 NOT NULL,
  "server_error_count" integer DEFAULT 0 NOT NULL,
  "total_duration_ms" integer DEFAULT 0 NOT NULL,
  "max_duration_ms" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "operations_metric_buckets_instance_bucket_unique" UNIQUE("bucket_start", "instance_id")
);
--> statement-breakpoint
CREATE INDEX "operations_metric_buckets_bucket_start_idx" ON "operations_metric_buckets" USING btree ("bucket_start");
