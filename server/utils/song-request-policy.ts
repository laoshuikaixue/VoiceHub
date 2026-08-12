import { createHash } from 'node:crypto'
import { createApiError } from './apiError.ts'

const ADMINISTRATOR_ROLES = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']

function normalizeNullableString(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

export function isSongAdministrator(role: string) {
  return ADMINISTRATOR_ROLES.includes(role)
}

export function fingerprintSongRequestPayload(input: {
  userId: number
  title: string
  artist: string
  cover?: string | null
  musicPlatform?: string | null
  musicId?: string | null
  playUrl?: string | null
  submissionNote?: string | null
  submissionNotePublic?: boolean
  preferredPlayTimeId?: number | null
  collaboratorIds?: number[]
}) {
  return fingerprintSongRequest({
    ...input,
    semester: null,
    hitRequestId: null
  })
}

export function fingerprintSongRequest(input: {
  userId: number
  semester: string | null
  title: string
  artist: string
  cover?: string | null
  musicPlatform?: string | null
  musicId?: string | null
  playUrl?: string | null
  submissionNote?: string | null
  submissionNotePublic?: boolean
  preferredPlayTimeId?: number | null
  hitRequestId?: number | null
  collaboratorIds?: number[]
}) {
  const payload = {
    userId: input.userId,
    semester: normalizeNullableString(input.semester),
    title: input.title.trim(),
    artist: input.artist.trim(),
    cover: normalizeNullableString(input.cover),
    musicPlatform: normalizeNullableString(input.musicPlatform),
    musicId: normalizeNullableString(input.musicId),
    playUrl: normalizeNullableString(input.playUrl),
    submissionNote: normalizeNullableString(input.submissionNote),
    submissionNotePublic: input.submissionNotePublic === true,
    preferredPlayTimeId: input.preferredPlayTimeId ?? null,
    hitRequestId: input.hitRequestId ?? null,
    collaboratorIds: [...new Set(input.collaboratorIds ?? [])].sort((a, b) => a - b)
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export async function executeIdempotentSongRequest<T extends { id: number; title?: string; requestId?: string | null; fingerprint?: string | null }>(
  store: {
    lockRequestIdentity(requestId: string): Promise<void>
    findSongByRequestId(requestId: string): Promise<T | null>
  },
  input: {
    requestId: string
    fingerprint: string
    insertSong(): Promise<T>
  }
) {
  const requestId = typeof input.requestId === 'string' ? input.requestId.trim() : ''
  const fingerprint = typeof input.fingerprint === 'string' ? input.fingerprint.trim() : ''
  if (!requestId || !fingerprint) {
    throw new Error('点歌请求必须提供 requestId 和完整指纹')
  }

  await store.lockRequestIdentity(requestId)
  const existingByRequestId = await store.findSongByRequestId(requestId)
  if (existingByRequestId) {
    if (existingByRequestId.fingerprint !== fingerprint) {
      throw createApiError(
        409,
        'SONG_REQUEST_IDEMPOTENCY_CONFLICT',
        '请求 ID 已用于不同的点歌请求'
      )
    }
    return existingByRequestId
  }

  return input.insertSong()
}

export function createImportSongRequestId(batchId: string, index: number, sourceId: number) {
  const normalizedBatchId = typeof batchId === 'string' ? batchId.trim() : ''
  if (!normalizedBatchId) throw new Error('导入请求必须提供批次 ID')
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('导入请求索引无效')
  if (!Number.isSafeInteger(sourceId) || sourceId <= 0) throw new Error('导入请求源歌曲标识无效')
  return `song-import:${normalizedBatchId}:${index}:${sourceId}`
}

export function validateAdminSongAddBody(body: Record<string, unknown>, userId: number) {
  if (Object.prototype.hasOwnProperty.call(body, 'requester')) {
    throw createApiError(400, 'COMMON_INVALID_PARAMS', '不允许指定投稿人')
  }
  const { cardCode: _cardCode, ...compatibleBody } = body
  return {
    ...compatibleBody,
    title: typeof body.title === 'string' ? body.title.trim() : body.title,
    artist: typeof body.artist === 'string' ? body.artist.trim() : body.artist,
    requesterId: userId
  }
}
