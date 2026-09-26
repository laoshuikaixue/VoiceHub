// 旧版 AstrBot 分支迁移已被合并为一笔新迁移；旧库不能直接重放建表。
const SUPERSEDED_MIGRATIONS = new Set([
  1790326842814n, 1790342504449n, 1790359178874n,
  1790380598636n, 1790381044650n, 1790396438534n, 1790402496386n
])
const COMBINED_MIGRATION = 1790435780014n
const ASTRBOT_TABLES = ['AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox']

export async function rejectSupersededAstrbotMigrations(sql) {
  const [table] = await sql`SELECT to_regclass('public.__drizzle_migrations__') AS table_name`
  const records = table?.table_name
    ? await sql`SELECT created_at FROM public.__drizzle_migrations__`
    : []
  const applied = new Set(records.map((row) => BigInt(row.created_at)))
  if ([...SUPERSEDED_MIGRATIONS].some((when) => applied.has(when))) {
    throw new Error('旧版 AstrBot 迁移已执行：当前合并迁移不可直接重放，须先使用受控升级方案；已停止自动同步')
  }
  const tables = await sql`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox')`
  const existing = new Set(tables.map((row) => row.table_name))
  if (applied.has(COMBINED_MIGRATION)) {
    if (ASTRBOT_TABLES.some((name) => !existing.has(name))) {
      throw new Error('AstrBot 合并迁移记录与表结构不一致：停止自动修复，须先核对数据库')
    }
    return
  }
  if (tables.length) {
    throw new Error('已有 AstrBot 表但未登记合并迁移：不能直接重放建表或强推结构；须先核对数据库并使用受控升级方案')
  }
}
