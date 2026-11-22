import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { hasAdminPermission, PRIV_SYSTEM_UPDATE, ROLE_PERMISSION_TEMPLATES_DEFAULT } from '../../app/utils/admin-permissions.ts'
import { createPackage, inspectPackage, isNewerVersion, runtimeFingerprint, UpdatePackageError } from '../../scripts/web-update/package.mjs'
import { commandFile, publishJson, readJson, updatePending } from '../../scripts/web-update/state.mjs'

test('升级私有权限只有站点全权模板可用，且允许显式拒绝', () => {
  assert.equal(hasAdminPermission({ perms: ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN }, PRIV_SYSTEM_UPDATE), false)
  assert.equal(hasAdminPermission({ perms: ['priv:admin-console', 'priv:*'] }, PRIV_SYSTEM_UPDATE), false)
  assert.equal(hasAdminPermission({ perms: ROLE_PERMISSION_TEMPLATES_DEFAULT.SUPER_ADMIN }, PRIV_SYSTEM_UPDATE), true)
  assert.equal(hasAdminPermission({ perms: ['*', `!${PRIV_SYSTEM_UPDATE}`] }, PRIV_SYSTEM_UPDATE), false)
})

test('安装允许跨过中间上游版本，重复安装和向后安装均拒绝', () => {
  assert.equal(isNewerVersion('1.6.0.9', '1.6.0.7'), true)
  assert.equal(isNewerVersion('1.6.0.7', '1.6.0.7'), false)
  assert.equal(isNewerVersion('1.6.0.6', '1.6.0.7'), false)
})

test('签名包拒绝错误公钥、被修改的载荷和不兼容的迁移', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'voicehub-update-test-'))
  try {
    await mkdir(join(dir, 'app/drizzle/migrations'), { recursive: true })
    await mkdir(join(dir, '.output/server'), { recursive: true })
    await writeFile(join(dir, '.output/server/index.mjs'), 'export {}')
    await writeFile(join(dir, 'package.json'), JSON.stringify({ version: '1.6.0.7', vtcsyRevision: 'e' }))
    await writeFile(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9')
    const migration = join(dir, 'app/drizzle/migrations/snapshot.sql')
    await writeFile(migration, 'SELECT 1')
    const keys = generateKeyPairSync('ed25519')
    const keyFile = join(dir, 'private.pem')
    const publicPem = keys.publicKey.export({ type: 'spki', format: 'pem' })
    await writeFile(keyFile, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }))
    const update = join(dir, 'test.vhu')
    const fingerprint = await runtimeFingerprint(dir)
    await createPackage(dir, update, keyFile)
    assert.equal((await inspectPackage(update, publicPem, fingerprint)).version, '1.6.0.7-e')

    const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' })
    await assert.rejects(inspectPackage(update, other, fingerprint), UpdatePackageError)

    await writeFile(migration, 'SELECT 2')
    await assert.rejects(inspectPackage(update, publicPem, await runtimeFingerprint(dir)), UpdatePackageError)

    const damaged = await readFile(update)
    damaged[damaged.length - 1] ^= 1
    await writeFile(update, damaged)
    await assert.rejects(inspectPackage(update, publicPem, fingerprint), UpdatePackageError)
  } finally {
    await rm(dir, { force: true, recursive: true })
  }
})

test('已有升级请求时不能用后来的请求覆盖', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'voicehub-update-queue-'))
  try {
    assert.equal(await updatePending(dir), false)
    const first = { id: 'first', action: 'install' }
    await publishJson(commandFile(dir), first, false)
    assert.equal(await updatePending(dir), true)
    await assert.rejects(publishJson(commandFile(dir), { id: 'second', action: 'rollback' }, false), { code: 'EEXIST' })
    assert.deepEqual(await readJson(commandFile(dir)), first)
  } finally {
    await rm(dir, { force: true, recursive: true })
  }
})
