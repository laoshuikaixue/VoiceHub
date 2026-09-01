-- ============================================================================
-- VoiceHub RBAC + API Key Enhancements Migration Rollback
-- ============================================================================
-- Forward migration : app/drizzle/migrations/20260830173719_add_rbac_and_api_key_enhancements.sql
-- Journal idx       : 49
-- Snapshot file     : app/drizzle/migrations/meta/20260830173719_snapshot.json
-- SHA-256 of SQL    : 368e00332752db0a5db01c45e65981a8212d468e4c0b500934676a3f0d8ba0f4
-- Target DB         : PostgreSQL >= 13
-- Generated         : 2026-09-01 (PR #559 blocker #2)
--
-- PURPOSE
-- ---------------------------------------------------------------------------
-- drizzle-kit has no "down" command (`db:drop` only deletes migration files,
-- not data). This script is the manual, runnable rollback of the RBAC +
-- API Key enhancements migration. It drops every object created by that
-- migration, in inverse-dependency order, and clears the matching row in
-- drizzle's bookkeeping table so a future `drizzle-kit migrate` will treat
-- the migration as not yet applied.
--
-- DATA LOSS WARNING  -- READ BEFORE RUNNING
-- ---------------------------------------------------------------------------
-- Executing this script PERMANENTLY destroys:
--   * every row in `permissions`, `role_permissions`, `user_permissions`
--     (the entire RBAC catalog and every per-user grant)
--   * every row in `permission_migration_log` (the old->new permission
--     key remap audit trail)
--   * every row in `api_rate_limit_counters`, `api_usage_daily`,
--     `api_usage_monthly` (API usage telemetry)
--   * every row in `webhook_failures` (failed webhook delivery log)
--   * the values held in the 8 new columns of `api_keys`:
--       owner_type, owner_id, rate_limit_per_minute,
--       quota_daily, quota_monthly, ip_whitelist,
--       webhook_url, webhook_secret_hash
--     (`api_keys` rows themselves are preserved; only the columns vanish.)
--
-- The script is IDEMPOTENT: every DROP / ALTER uses IF EXISTS / IF EXISTS
-- IF EXISTS, so re-running on an already-rolled-back database is a no-op.
--
-- BEFORE YOU RUN
-- ---------------------------------------------------------------------------
-- 1. Take a full database backup. There is no undo.
--      pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Revert the application code to the commit BEFORE the RBAC migration
--    was introduced; otherwise the running app will query tables / columns
--    that no longer exist.
-- 3. Confirm no other migration has been written on top of this one that
--    introduces additional foreign keys to the objects being dropped.
--    As of journal idx 49, no such migration exists.
--
-- USAGE
-- ---------------------------------------------------------------------------
--   pnpm rbac:rollback
-- or
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rbac-rollback.sql
--
-- DEPENDENCY ORDER (inverse of the forward migration)
-- ---------------------------------------------------------------------------
--   1. user_permissions         (FK -> User, permissions)
--   2. role_permissions        (FK -> permissions)
--   3. permissions             (referenced by 1 & 2)
--   4. permission_migration_log
--   5. webhook_failures
--   6. api_usage_monthly
--   7. api_usage_daily
--   8. api_rate_limit_counters
--   9. ALTER api_keys DROP COLUMN *  (8 new columns)
--  10. DELETE migration record from public.__drizzle_migrations__
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Drop the join tables that hold foreign keys to `permissions` and
-- `User`. Dropping the table automatically removes its FK constraints, so
-- we do not need (and intentionally avoid) CASCADE here -- the explicit
-- order is the safety net.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "public"."user_permissions";
DROP TABLE IF EXISTS "public"."role_permissions";

-- ---------------------------------------------------------------------------
-- Step 2: Drop the `permissions` catalog now that nothing references it.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "public"."permissions";

-- ---------------------------------------------------------------------------
-- Step 3: Drop the remaining RBAC / API telemetry tables. None of them have
-- FK constraints in the forward migration (the `api_key_id` columns are
-- plain uuid, no REFERENCES clause).
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "public"."permission_migration_log";
DROP TABLE IF EXISTS "public"."webhook_failures";
DROP TABLE IF EXISTS "public"."api_usage_monthly";
DROP TABLE IF EXISTS "public"."api_usage_daily";
DROP TABLE IF EXISTS "public"."api_rate_limit_counters";

-- ---------------------------------------------------------------------------
-- Step 4: Strip the 8 new columns from `api_keys`. The `api_keys` rows are
-- preserved. All values in these columns are permanently lost.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."api_keys"
  DROP COLUMN IF EXISTS "owner_type",
  DROP COLUMN IF EXISTS "owner_id",
  DROP COLUMN IF EXISTS "rate_limit_per_minute",
  DROP COLUMN IF EXISTS "quota_daily",
  DROP COLUMN IF EXISTS "quota_monthly",
  DROP COLUMN IF EXISTS "ip_whitelist",
  DROP COLUMN IF EXISTS "webhook_url",
  DROP COLUMN IF EXISTS "webhook_secret_hash";

-- ---------------------------------------------------------------------------
-- Step 5: Remove the migration record from drizzle's bookkeeping table so a
-- subsequent `drizzle-kit migrate` treats this migration as not yet applied.
-- Match by SHA-256 hash (the canonical key) with a created_at fallback for
-- environments where db-sync.js seeded the row with `legacy:*` hashes.
-- ---------------------------------------------------------------------------
DO $rbac_rollback$
DECLARE
  v_removed integer := 0;
  v_migration_hash text := '368e00332752db0a5db01c45e65981a8212d468e4c0b500934676a3f0d8ba0f4';
  v_migration_when  bigint := 1788111439951;
BEGIN
  IF to_regclass('public.__drizzle_migrations__') IS NULL THEN
    RAISE NOTICE 'rbac-rollback: public.__drizzle_migrations__ does not exist, skipping meta cleanup';
    RETURN;
  END IF;

  -- Primary: match by the exact SHA-256 hash that drizzle-kit recorded.
  DELETE FROM public.__drizzle_migrations__
    WHERE hash = v_migration_hash;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Fallback: db-sync.js seeds rows with hash = 'legacy:<tag>' and the
  -- journal `when` timestamp. Match those by timestamp.
  IF v_removed = 0 THEN
    DELETE FROM public.__drizzle_migrations__
      WHERE created_at = v_migration_when;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
  END IF;

  IF v_removed > 0 THEN
    RAISE NOTICE 'rbac-rollback: removed % row(s) from public.__drizzle_migrations__', v_removed;
  ELSE
    RAISE NOTICE 'rbac-rollback: no matching row in public.__drizzle_migrations__ (hash or when) -- meta is already clean';
  END IF;
END
$rbac_rollback$;

COMMIT;

-- ============================================================================
-- End of rollback. Verify with:
--   \dt public.*
--   \d public.api_keys
-- ============================================================================
