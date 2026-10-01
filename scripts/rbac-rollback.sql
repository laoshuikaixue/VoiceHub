-- ============================================================================
-- VoiceHub RBAC + API Key 增强 数据层回滚（S1-8 · D1 / R-36）
-- ============================================================================
-- 正向迁移 : app/drizzle/migrations/20260927090250_auto-migration.sql
-- Journal  : idx 52 / tag 20260927090250_auto-migration / when 1790499770823
-- SHA-256  : 4abe5a3b5299086f422b21105093860f8ac4d92b488215396ec640f7a413f1a2
-- 目标库   : PostgreSQL >= 13
--
-- 用途
-- ----------------------------------------------------------------------------
-- drizzle-kit 没有 `down` 子命令，这是本次迁移的唯一数据层回滚手段：
-- 逆依赖顺序 DROP 本次迁移创建的全部对象，并清掉 drizzle 记账表里的对应行，
-- 使后续 `drizzle-kit migrate` 重新视为「未应用」。
--
-- 数据损失警告（执行前必读）
-- ----------------------------------------------------------------------------
-- 本脚本会**永久销毁**：
--   * permissions / role_permissions / user_permissions 的全部行（目录 + 角色矩阵 + 个人加授）
--   * permission_migration_log（旧→新权限 key 的审计）
--   * api_rate_limit_counters / api_usage_daily / api_usage_monthly（用量遥测）
--   * webhook_failures（投递失败日志）
--   * api_keys 8 个新列中的全部值（ownerType / ownerId / rateLimitPerMinute / quotaDaily /
--     quotaMonthly / ipWhitelist / webhookUrl / webhookSecretHash）；api_keys 行本身保留
--
-- 执行前置：
--   1. 先备份：pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump
--   2. 把应用代码回退到引入本次迁移之前的提交（否则运行时会查询已不存在的表/列）
--   3. S5 上线（开始写配额 / 白名单 / webhook 配置）后，本脚本必须改为「保留列、只回滚代码」
--
-- 幂等：所有 DROP 均带 IF EXISTS，重复执行是 no-op。
--
-- 用法：
--   pnpm rbac:rollback
--   或 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rbac-rollback.sql
--
-- 依赖顺序（正向迁移的逆序）
-- ----------------------------------------------------------------------------
--   1. user_permissions      （FK → User、permissions）
--   2. role_permissions     （FK → permissions）
--   3. permissions          （被 1、2 引用）
--   4. permission_migration_log
--   5. webhook_failures
--   6. api_usage_monthly
--   7. api_usage_daily
--   8. api_rate_limit_counters
--   9. api_keys 的 8 个新列
--  10. 记账表 public.__drizzle_migrations__ 中本次迁移记录
-- ============================================================================

BEGIN;

-- Step 1-3：先删有外键引用的两张关联表，再删权限目录
DROP TABLE IF EXISTS "public"."user_permissions";
DROP TABLE IF EXISTS "public"."role_permissions";
DROP TABLE IF EXISTS "public"."permissions";

-- Step 4-8：其余 RBAC / 遥测表（无外键，顺序仅需与正向相反）
DROP TABLE IF EXISTS "public"."permission_migration_log";
DROP TABLE IF EXISTS "public"."webhook_failures";
DROP TABLE IF EXISTS "public"."api_usage_monthly";
DROP TABLE IF EXISTS "public"."api_usage_daily";
DROP TABLE IF EXISTS "public"."api_rate_limit_counters";

-- Step 9：剥离 api_keys 的 8 个新列（行保留，列内数据永久丢失）
ALTER TABLE "public"."api_keys"
  DROP COLUMN IF EXISTS "ownerType",
  DROP COLUMN IF EXISTS "ownerId",
  DROP COLUMN IF EXISTS "rateLimitPerMinute",
  DROP COLUMN IF EXISTS "quotaDaily",
  DROP COLUMN IF EXISTS "quotaMonthly",
  DROP COLUMN IF EXISTS "ipWhitelist",
  DROP COLUMN IF EXISTS "webhookUrl",
  DROP COLUMN IF EXISTS "webhookSecretHash";

-- Step 10：清理记账表，使后续 migrate 重新应用本次迁移
--   匹配三选一：drizzle-kit 写入的 sha256 / db-sync.js 补齐的 legacy:<tag> / journal 的 when
DO $rbac_rollback$
DECLARE
  v_removed integer := 0;
  v_total integer := 0;
  v_hash text := '4abe5a3b5299086f422b21105093860f8ac4d92b488215396ec640f7a413f1a2';
  v_legacy_hash text := 'legacy:20260927090250_auto-migration';
  v_when bigint := 1790499770823;
BEGIN
  IF to_regclass('public.__drizzle_migrations__') IS NULL THEN
    RAISE NOTICE 'rbac-rollback: public.__drizzle_migrations__ 不存在，跳过迁移记录清理';
    RETURN;
  END IF;

  SELECT count(*) INTO v_total FROM public.__drizzle_migrations__;

  DELETE FROM public.__drizzle_migrations__
   WHERE hash = v_hash
      OR hash = v_legacy_hash
      OR created_at = v_when;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  RAISE NOTICE 'rbac-rollback: 删除记账行 % 条（删除前共 % 条）', v_removed, v_total;
  IF v_removed = 0 THEN
    RAISE NOTICE 'rbac-rollback: 未匹配到本次迁移记录（hash / legacy hash / created_at 均不匹配）——可能已被清理';
  END IF;
END
$rbac_rollback$;

COMMIT;

-- ============================================================================
-- 回滚后核对（期望均为 0）：
--   SELECT count(*) FROM information_schema.tables
--    WHERE table_schema='public'
--      AND table_name IN ('permissions','role_permissions','user_permissions',
--                         'permission_migration_log','api_rate_limit_counters',
--                         'api_usage_daily','api_usage_monthly','webhook_failures');
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='api_keys'
--      AND column_name IN ('ownerType','ownerId','rateLimitPerMinute','quotaDaily',
--                          'quotaMonthly','ipWhitelist','webhookUrl','webhookSecretHash');
-- ============================================================================
