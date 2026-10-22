-- 迁移记录条数 + 关键结构核对（只读）
\pset pager off
SELECT 'migration records' AS metric, count(*)::text AS value FROM public.__drizzle_migrations__;
SELECT 'api_keys columns' AS metric, string_agg(column_name, ', ' ORDER BY ordinal_position) AS value
FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys';
SELECT 'role_permissions exists' AS metric,
  (SELECT count(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_name='role_permissions') AS value;
SELECT 'permissions exists' AS metric,
  (SELECT count(*)::text FROM information_schema.tables WHERE table_schema='public' AND table_name='permissions') AS value;
SELECT 'public table count' AS metric, count(*)::text AS value
FROM information_schema.tables WHERE table_schema='public';
