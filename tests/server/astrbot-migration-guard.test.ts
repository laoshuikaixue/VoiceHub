import assert from 'node:assert/strict'
import test from 'node:test'
import { rejectSupersededAstrbotMigrations } from '../../scripts/astrbot-migration-guard.js'

function fakeSql(records: bigint[], tables: string[]) {
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?')
    if (query.includes('to_regclass')) return [{ table_name: records.length ? '__drizzle_migrations__' : null }]
    if (query.includes('FROM public.__drizzle_migrations__')) return records.map((created_at) => ({ created_at }))
    if (query.includes('information_schema.tables')) return tables.map((table_name) => ({ table_name }))
    throw new Error(`意外查询：${query}`)
  }
  return sql
}

test('空库与已登记新合并迁移的库允许继续', async () => {
  await assert.doesNotReject(() => rejectSupersededAstrbotMigrations(fakeSql([], [])))
  await assert.doesNotReject(() => rejectSupersededAstrbotMigrations(fakeSql([1790435780014n], ['AstrbotBinding'])))
})

test('执行过被取代的旧迁移时停止升级，即便新迁移也有记录', async () => {
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([1790326842814n], [])), /旧版 AstrBot 迁移/)
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([1790435780014n, 1790326842814n], ['AstrbotBinding'])), /旧版 AstrBot 迁移/)
})

test('无新合并迁移记录但已有 AstrBot 表时停止升级', async () => {
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([], ['AstrbotOutbox'])), /已有 AstrBot 表/)
  await assert.rejects(() => rejectSupersededAstrbotMigrations(fakeSql([1790340222774n], ['AstrbotBindingCode'])), /已有 AstrBot 表/)
})
