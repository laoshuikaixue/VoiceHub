import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { getHeader, getQuery, type H3Event } from 'h3'
import { db } from '~/drizzle/db'
import { broadcastPlayback } from '~/drizzle/schema'
import { hasAdminPermission, PRIV_SYSTEM_UPDATE, SUPER_ADMIN_ROLE } from '~/utils/admin-permissions'
import pkg from '~~/package.json'
import { inspectPackage, isNewerVersion, updateLimit, UpdatePackageError } from '~~/scripts/web-update/package.mjs'
import { commandFile, publishJson, readJson, stateFile, updatePending } from '~~/scripts/web-update/state.mjs'
import { SERVER_ERROR_CODES as codes } from '~~/server/config/constants'
import { lockBroadcast } from '~~/server/services/broadcastPlayback'
import { createApiError } from '~~/server/utils/apiError'
import { getServerDate } from '~~/server/utils/serverTime'

let receiving = false

export function requireUpdateAdmin(event: H3Event) {
  const user = event.context.user
  if (user?.role !== SUPER_ADMIN_ROLE || !hasAdminPermission(user, PRIV_SYSTEM_UPDATE)) {
    throw createApiError(403, codes.WEB_UPDATE_FORBIDDEN, '只有超级管理员可以升级系统')
  }
}

const currentVersion = pkg.version

export async function getUpdateStatus(event: H3Event) {
  requireUpdateAdmin(event)
  const store = process.env.VOICEHUB_UPDATE_DIR
  if (!store || !process.env.VOICEHUB_UPDATE_RUNTIME || !process.env.VOICEHUB_UPDATE_PUBLIC_KEY) {
    return { enabled: false, current: currentVersion, previous: null, status: 'idle', requestId: null, maxBytes: updateLimit, backup: null, failure: null }
  }
  const state = await readJson(stateFile(store))
  const command = await readJson(commandFile(store))
  return {
    enabled: true,
    current: currentVersion,
    previous: state?.previous?.version ?? null,
    status: command ? 'applying' : (state?.status ?? 'idle'),
    backup: state?.backup ?? null,
    failure: state?.failure ?? null,
    requestId: command?.id ?? state?.lastId ?? null,
    maxBytes: updateLimit
  }
}

export async function queueWebUpdate(event: H3Event) {
  requireUpdateAdmin(event)
  const store = process.env.VOICEHUB_UPDATE_DIR
  const runtime = process.env.VOICEHUB_UPDATE_RUNTIME
  const keyFile = process.env.VOICEHUB_UPDATE_PUBLIC_KEY
  if (!store || !runtime || !keyFile) throw createApiError(503, codes.WEB_UPDATE_DISABLED, '当前实例未启用网页升级')
  const action = getQuery(event).action
  if (action !== 'install' && action !== 'rollback') throw createApiError(400, codes.WEB_UPDATE_INVALID, '升级操作无效')
  if (receiving || await updatePending(store)) throw createApiError(409, codes.WEB_UPDATE_BUSY, '正在处理另一个更新')
  if (receiving) throw createApiError(409, codes.WEB_UPDATE_BUSY, '正在处理另一个更新')
  receiving = true
  const id = randomUUID()
  const upload = action === 'install' ? id : null
  const path = join(store, 'uploads', id)
  let queued = false
  let version = null
  try {
    if (upload) {
      if (getHeader(event, 'content-type') !== 'application/octet-stream') {
        throw createApiError(415, codes.WEB_UPDATE_INVALID, '请上传升级包')
      }
      const length = Number(getHeader(event, 'content-length'))
      if (!Number.isSafeInteger(length) || length < 1 || length > updateLimit) {
        throw createApiError(413, codes.WEB_UPDATE_SIZE, '升级包大小无效')
      }
      let received = 0
      await pipeline(event.node.req, new Transform({
        transform(chunk, _encoding, callback) {
          received += chunk.length
          callback(received > length ? new UpdatePackageError('Upload exceeded its declared size') : null, chunk)
        }
      }), createWriteStream(path, { flags: 'wx', mode: 0o600 }), { signal: AbortSignal.timeout(15 * 60_000) })
      if (received !== length) throw new UpdatePackageError('Incomplete upload')
      const manifest = await inspectPackage(path, await readFile(keyFile), runtime)
      version = manifest.version
      if (!isNewerVersion(version, currentVersion)) throw new UpdatePackageError('Target is not newer than the current version')
    } else {
      const state = await readJson(stateFile(store))
      version = state?.previous?.version
      if (!version) throw createApiError(409, codes.WEB_UPDATE_NO_ROLLBACK, '没有可回退的网页版本')
    }
    await db.transaction(async tx => {
      await lockBroadcast(tx)
      const lease = await tx.query.broadcastPlayback.findFirst({ where: eq(broadcastPlayback.id, 1) })
      if (lease && lease.expiresAt > getServerDate() && (lease.armedAt || lease.run)) {
        throw createApiError(409, codes.WEB_UPDATE_BROADCAST, '请先结束播出并退出无人值守')
      }
      await publishJson(commandFile(store), { id, action, upload }, false)
      queued = true
    })
    return { requestId: id, action, version }
  } catch (error) {
    if (error instanceof UpdatePackageError) throw createApiError(400, codes.WEB_UPDATE_INVALID, '升级包签名、版本或运行环境校验失败')
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw createApiError(409, codes.WEB_UPDATE_BUSY, '正在处理另一个更新')
    throw error
  } finally {
    receiving = false
    if (upload && !queued) await rm(path, { force: true })
  }
}
