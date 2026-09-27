import assert from 'node:assert/strict'
import test from 'node:test'
import { rejectSupersededAstrbotMigrations, inspectLegacyAstrbotUpgrade } from '../../scripts/astrbot-migration-guard.js'

const esaColumns = [
  { table_name: 'SystemSettings', column_name: 'esaCaptchaPrefix', data_type: 'text', is_nullable: 'YES' },
  { table_name: 'SystemSettings', column_name: 'esaCaptchaScenes', data_type: 'text', is_nullable: 'NO' },
  { table_name: 'SystemSettings', column_name: 'esaCaptchaRegion', data_type: 'text', is_nullable: 'NO' }
]

function fakeSql(records: bigint[], tables: string[], options: { bridgeHash?: string, columns?: { table_name: string, column_name: string, data_type: string, is_nullable: string }[] } = {}) {
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?')
    if (query.includes('to_regclass')) return [{ table_name: records.length ? '__drizzle_migrations__' : null }]
    if (query.includes('FROM public.__drizzle_migrations__')) return records.map((created_at) => ({
      created_at, hash: created_at === 1790435780014n ? options.bridgeHash : 'digest'
    }))
    if (query.includes('information_schema.tables')) return tables.map((table_name) => ({ table_name }))
    if (query.includes('information_schema.columns')) return options.columns ?? []
    throw new Error(`意外查询：${query}`)
  }
  return sql
}

test('空库与已登记新合并迁移的库允许继续', async () => {
  await assert.doesNotReject(() => rejectSupersededAstrbotMigrations(fakeSql([], [])))
  await assert.doesNotReject(() => rejectSupersededAstrbotMigrations(fakeSql([1790435780014n],
    ['AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox'])))
})

test('执行过被取代的旧迁移时停止升级，即便新迁移也有记录', async () => {
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([1790326842814n], [])), /旧版 AstrBot 迁移/)
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([1790435780014n, 1790326842814n], ['AstrbotBinding'])), /旧版 AstrBot 迁移/)
})

test('无新合并迁移记录但已有 AstrBot 表时停止升级', async () => {
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([], ['AstrbotOutbox'])), /已有 AstrBot 表/)
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([1790340222774n], ['AstrbotBindingCode'])), /已有 AstrBot 表/)
})

test('已登记合并迁移但三张 AstrBot 表不齐时停止自动修复', async () => {
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([1790435780014n], [])), /合并迁移记录与表结构不一致/)
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([1790435780014n], ['AstrbotBinding'])), /合并迁移记录与表结构不一致/)
  await assert.doesNotReject(() => rejectSupersededAstrbotMigrations(fakeSql([1790435780014n],
    ['AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox'])))
})

test('受控升级只接受完整旧迁移链和全部旧表，拒绝缺记录或表', async () => {
  const records = [1790326842814n, 1790342504449n, 1790359178874n,
    1790380598636n, 1790381044650n, 1790396438534n, 1790402496386n]
  const tables = ['AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox']
  await assert.rejects(() => inspectLegacyAstrbotUpgrade(fakeSql(records.slice(1), tables)), /迁移链不完整/)
  await assert.rejects(() => inspectLegacyAstrbotUpgrade(fakeSql(records, tables.slice(1))), /缺少 AstrBot 表/)
  await assert.rejects(() => inspectLegacyAstrbotUpgrade(fakeSql([...records, 1790435780014n], tables)), /合并迁移已执行/)
  await assert.rejects(() => inspectLegacyAstrbotUpgrade(fakeSql(records.slice(0, -1), tables)), /迁移链不完整/)
  await assert.rejects(() => inspectLegacyAstrbotUpgrade(fakeSql(records, tables)), /上游 ESA 迁移未执行/)
  await assert.doesNotReject(() => inspectLegacyAstrbotUpgrade(fakeSql([...records, 1790340222774n], tables, {
    columns: esaColumns
  })))
})

test('ESA 迁移记录存在但实际列缺失时拒绝桥接', async () => {
  const old = [1790326842814n, 1790342504449n, 1790359178874n,
    1790380598636n, 1790381044650n, 1790396438534n, 1790402496386n, 1790340222774n]
  const tables = ['AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox']
  await assert.rejects(() => inspectLegacyAstrbotUpgrade(fakeSql(old, tables)), /ESA 配置列不完整/)
})

test('旧历史保留时只放行已验证的桥接标记和完整结构', async () => {
  const old = [1790326842814n, 1790342504449n, 1790359178874n,
    1790380598636n, 1790381044650n, 1790396438534n, 1790402496386n]
  const records = [...old, 1790340222774n, 1790435780014n]
  const tables = ['AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox']
  const columns = [
    { table_name: 'AstrbotOutbox', column_name: 'claimToken', data_type: 'text', is_nullable: 'YES' },
    { table_name: 'AstrbotBinding', column_name: 'boundAt', data_type: 'timestamp without time zone', is_nullable: 'NO' }
  ]
  await assert.doesNotReject(() => rejectSupersededAstrbotMigrations(fakeSql(records, tables, {
    bridgeHash: 'astrbot-legacy-bridge:v1', columns
  })))
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql(records, tables, {
    bridgeHash: 'digest', columns
  })), /旧版 AstrBot 迁移/)
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql(records, tables, {
    bridgeHash: 'astrbot-legacy-bridge:v1', columns: columns.slice(1)
  })), /旧版 AstrBot 迁移/)
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql(records, tables, {
    bridgeHash: 'astrbot-legacy-bridge:v1', columns: [columns[0], { ...columns[1], is_nullable: 'YES' }]
  })), /旧版 AstrBot 迁移/)
})
