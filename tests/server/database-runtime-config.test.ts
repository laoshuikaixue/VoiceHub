import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveDatabaseConnectionString,
  resolveDatabasePoolConfig
} from '../../app/drizzle/runtime-config.ts'

const base = {
  databaseUrl: 'postgres://direct.example/db',
  isNeon: false
}

test('Cloudflare 优先使用 Hyperdrive 连接串', () => {
  assert.equal(
    resolveDatabaseConnectionString({
      ...base,
      isCloudflare: true,
      hyperdriveUrl: 'postgres://hyperdrive.local/db'
    }),
    'postgres://hyperdrive.local/db'
  )
})

test('Cloudflare 未配置 Hyperdrive 时快速报配置错误', () => {
  assert.throws(
    () => resolveDatabaseConnectionString({ ...base, isCloudflare: true }),
    /requires a HYPERDRIVE binding/
  )
})

test('Cloudflare 数据库连接池限制为单连接并快速释放', () => {
  assert.deepEqual(resolveDatabasePoolConfig({ ...base, isCloudflare: true }), {
    max: 1,
    idle_timeout: 0,
    connect_timeout: 5,
    max_lifetime: 60,
    fetch_types: false,
    backoff: 0
  })
})
