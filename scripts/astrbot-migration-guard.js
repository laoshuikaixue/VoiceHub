// 旧版 AstrBot 分支迁移已被合并为一笔新迁移；旧库不能直接重放建表。
const SUPERSEDED_MIGRATIONS = new Set([
  1790326842814n, 1790342504449n, 1790359178874n,
  1790380598636n, 1790381044650n, 1790396438534n, 1790402496386n
])
const COMBINED_MIGRATION = 1790435780014n
const ASTRBOT_TABLES = ['AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox']
export const ASTRBOT_LEGACY_BRIDGE_HASH = 'astrbot-legacy-bridge:v1'

export async function inspectLegacyAstrbotUpgrade(sql) {
  const [migrationTable] = await sql`SELECT to_regclass('public.__drizzle_migrations__') AS table_name`
  if (!migrationTable?.table_name) throw new Error('旧版 AstrBot 迁移链不完整：缺少迁移记录表')
  const records = await sql`SELECT created_at FROM public.__drizzle_migrations__`
  const applied = new Set(records.map((row) => BigInt(row.created_at)))
  if ([...SUPERSEDED_MIGRATIONS].some((when) => !applied.has(when)) || applied.has(COMBINED_MIGRATION)) {
    throw new Error('旧版 AstrBot 迁移链不完整或合并迁移已执行')
  }
  const tables = await sql`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox')`
  const existing = new Set(tables.map((row) => row.table_name))
  if (ASTRBOT_TABLES.some((name) => !existing.has(name))) throw new Error('缺少 AstrBot 表，无法受控升级')
  if (!applied.has(1790340222774n)) throw new Error('上游 ESA 迁移未执行，须先完成上游迁移')
  const esa = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SystemSettings' AND
      column_name IN ('esaCaptchaPrefix', 'esaCaptchaScenes', 'esaCaptchaRegion')`
  const requiredEsa = [['esaCaptchaPrefix', 'YES'], ['esaCaptchaScenes', 'NO'], ['esaCaptchaRegion', 'NO']]
  if (requiredEsa.some(([name, nullable]) => !esa.some((row) => row.column_name === name && row.data_type === 'text' && row.is_nullable === nullable))) {
    throw new Error('ESA 配置列不完整：迁移记录与实际结构不一致')
  }
  return { applied, existing }
}

export async function rejectSupersededAstrbotMigrations(sql) {
  const [table] = await sql`SELECT to_regclass('public.__drizzle_migrations__') AS table_name`
  const records = table?.table_name
    ? await sql`SELECT created_at, hash FROM public.__drizzle_migrations__`
    : []
  const applied = new Set(records.map((row) => BigInt(row.created_at)))
  if ([...SUPERSEDED_MIGRATIONS].some((when) => applied.has(when))) {
    const bridge = records.filter((row) => BigInt(row.created_at) === COMBINED_MIGRATION)
    const fullChain = [...SUPERSEDED_MIGRATIONS, 1790340222774n].every((when) => applied.has(when))
    let ready = false
    if (fullChain && bridge.length === 1 && bridge[0].hash === ASTRBOT_LEGACY_BRIDGE_HASH) {
      const columns = await sql`SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND
          ((table_name = 'AstrbotOutbox' AND column_name = 'claimToken') OR
           (table_name = 'AstrbotBinding' AND column_name = 'boundAt'))`
      const outbox = columns.find((row) => row.table_name === 'AstrbotOutbox' && row.column_name === 'claimToken')
      const binding = columns.find((row) => row.table_name === 'AstrbotBinding' && row.column_name === 'boundAt')
      ready = columns.length === 2 && outbox?.data_type === 'text' && outbox.is_nullable === 'YES' &&
        binding?.data_type === 'timestamp without time zone' && binding.is_nullable === 'NO'
    }
    if (!ready) throw new Error('旧版 AstrBot 迁移已执行：当前合并迁移不可直接重放，须先使用受控升级方案；已停止自动同步')
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
