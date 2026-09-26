import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const fields = [
  'astrbotEnabled', 'astrbotPlatforms', 'astrbotBaseUrl', 'astrbotToken',
  'astrbotBroadcastEnabled', 'astrbotGroupTargets', 'astrbotGroupEvents',
  'astrbotGroupThrottle', 'astrbotPushMode', 'astrbotWeeklyConfig'
]

for (const file of ['restore.post.ts', 'restore-chunk.post.ts']) {
  test(`${file} 的系统设置恢复白名单包含所有 AstrBot 字段`, () => {
    const source = readFileSync(new URL(`../../server/api/admin/backup/${file}`, import.meta.url), 'utf8')
    for (const field of fields) {
      assert.match(source, new RegExp(`['"]${field}['"]\\s*,`), `${file} 缺少 ${field}`)
    }
  })
}
