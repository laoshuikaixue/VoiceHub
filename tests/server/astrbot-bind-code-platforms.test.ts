import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { astrbotBindingCodes } from '../../app/drizzle/schema.ts'

// 绑定码必须按平台分开存放：主键 (userId, platform)，否则一账号四个平台互相覆盖。
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const issue = source('server/api/notifications/astrbot/bind-code.post.ts')
const userUnbind = source('server/api/notifications/astrbot/unbind.post.ts')
const account = source('app/components/Account/SocialBindings.vue')

test('绑定码表以 (userId, platform) 为复合主键，platform 非空，codeHash 唯一索引保留', () => {
  const config = getTableConfig(astrbotBindingCodes)
  assert.deepEqual(config.primaryKeys.map((key) => key.columns.map((column) => column.name)), [['userId', 'platform']])
  const platform = config.columns.find((column) => column.name === 'platform')
  assert.equal(platform?.notNull, true)
  assert.equal(platform?.primary, false)
  assert.equal(config.columns.find((column) => column.name === 'userId')?.primary, false)
  assert.deepEqual(config.indexes.map((index) => [index.config.name, index.config.unique]), [['AstrbotBindingCode_hash_unique', true]])
})

test('发码 upsert 目标为 (userId, platform)，只覆盖同平台旧码', () => {
  assert.match(issue, /target: \[astrbotBindingCodes\.userId, astrbotBindingCodes\.platform\]/)
  // 绝不能退回按 userId 单键 upsert（否则切换平台会覆盖其它平台的码）。
  assert.doesNotMatch(issue, /target: astrbotBindingCodes\.userId/)
  // 冲突时不得再改写 platform 列。
  assert.doesNotMatch(issue, /set: \{[^}]*platform/)
  assert.match(issue, /各平台可并存/)
})

test('解绑只删除该平台未消费的绑定码，已消费的保留', () => {
  const deletion = userUnbind.match(/tx\.delete\(astrbotBindingCodes\)[\s\S]*?\)\)/)?.[0] ?? ''
  assert.ok(deletion, '解绑必须删除该平台的绑定码')
  assert.match(deletion, /eq\(astrbotBindingCodes\.userId, user\.id\)/)
  assert.match(deletion, /eq\(astrbotBindingCodes\.platform, platform\)/)
  assert.match(deletion, /isNull\(astrbotBindingCodes\.consumedAt\)/)
})

test('前端发码不清空其它平台的码，解绑只清本平台的码', () => {
  assert.doesNotMatch(account, /for \(const key of platformKeys\) astrbotCodes\.value\[key\] = null/)
  assert.match(account, /astrbotCodes\.value\[platform\] = \{ code: response\.code/)
  assert.match(account, /astrbotCodes\.value\[platform\] = null/)
})

test('迁移由 drizzle-kit 生成并安全清理旧数据：先删 NULL platform 行，再改约束', () => {
  const dir = new URL('../../app/drizzle/migrations/', import.meta.url)
  const files = readdirSync(dir).filter((name) => name.endsWith('.sql'))
  const migrated = files.filter((name) => readFileSync(new URL(name, dir), 'utf8').includes('AstrbotBindingCode_userId_platform_pk'))
  assert.equal(migrated.length, 1, `应恰有一个迁移建立复合主键，实际 ${migrated.join(', ')}`)
  const sql = readFileSync(new URL(migrated[0], dir), 'utf8')
  // 结构变更必须来自 drizzle-kit（保留其生成的 PK 命名提示注释）。
  assert.match(sql, /drizzle-kit version/)
  assert.match(sql, /ALTER TABLE "AstrbotBindingCode" ALTER COLUMN "platform" SET NOT NULL/)
  assert.match(sql, /ADD CONSTRAINT "AstrbotBindingCode_userId_platform_pk" PRIMARY KEY\("userId","platform"\)/)
  // 旧单列主键按实际约束名动态删除（内联主键名为 AstrbotBindingCode_pkey，push 路径可能不同）。
  assert.match(sql, /SELECT conname INTO pk_name FROM pg_constraint/)
  assert.match(sql, /DROP CONSTRAINT %I/)
  // 清库 DML 必须排在 SET NOT NULL 之前，否则既有 NULL 行会让迁移失败。
  assert.ok(sql.indexOf('DELETE FROM "AstrbotBindingCode" WHERE "platform" IS NULL') < sql.indexOf('SET NOT NULL'))
})
