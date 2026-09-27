import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (url: string) => readFileSync(new URL(url, import.meta.url), 'utf8')

// SYSTEM_SETTINGS_DEFAULTS 带 ~~ 别名无法直接 import，从源码提取顶层键（两空格缩进，截到对象闭合）
const defaultsSource = read('../../server/utils/system-settings-defaults.ts')
const defaultsStart = defaultsSource.indexOf('SYSTEM_SETTINGS_DEFAULTS')
const defaultsBody = defaultsSource.slice(defaultsStart, defaultsSource.indexOf('\n}', defaultsStart))
const defaultKeys = new Set(
  [...defaultsBody.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1])
)

// schema 中 SystemSettings 表的列名
const schemaSource = read('../../app/drizzle/schema.ts')
const tableStart = schemaSource.indexOf('export const systemSettings = pgTable')
const tableEnd = schemaSource.indexOf('export const ', tableStart + 1)
const schemaKeys = new Set(
  [...schemaSource.slice(tableStart, tableEnd).matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1])
)

const whitelists: Array<[string, string]> = [
  ['restore.post.ts', 'const systemSettingsFields = ['],
  ['restore-chunk.post.ts', 'const fields = [']
]

for (const [file, marker] of whitelists) {
  const source = read(`../../server/api/admin/backup/${file}`)
  const start = source.indexOf(marker)
  assert.ok(start > -1, `${file} 未找到系统设置恢复白名单`)
  const fields = new Set(
    [...source.slice(start, source.indexOf(']', start)).matchAll(/'([a-zA-Z0-9]+)'/g)].map((m) => m[1])
  )

  test(`${file} 的恢复白名单覆盖全部默认字段`, () => {
    const missing = [...defaultKeys].filter((key) => !fields.has(key))
    assert.deepEqual(missing, [], `${file} 白名单缺少: ${missing.join(', ')}`)
  })

  test(`${file} 的恢复白名单不含 schema 不存在的字段`, () => {
    const unknown = [...fields].filter((key) => !schemaKeys.has(key))
    assert.deepEqual(unknown, [], `${file} 白名单含无效字段: ${unknown.join(', ')}`)
  })
}
