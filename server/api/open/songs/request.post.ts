import { db, users } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { requestSongForUser } from '~~/server/services/songRequestService'

const ALLOWED_FIELDS = [
  'title',
  'artist',
  'cover',
  'musicPlatform',
  'musicId',
  'bilibiliCid',
  'bilibiliPage',
  'playUrl',
  'submissionNote',
  'submissionNotePublic',
  'preferredPlayTimeId',
  'cardCode',
  'collaborators'
]

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey

  if (!apiKey) {
    throw createError({
      statusCode: 401,
      message: 'API认证失败'
    })
  }

  const userResult = await db
    .select({
      id: users.id,
      role: users.role,
      status: users.status
    })
    .from(users)
    .where(eq(users.id, apiKey.createdByUserId))
    .limit(1)
  const user = userResult[0]

  if (!user || user.status !== 'active') {
    throw createError({
      statusCode: 403,
      message: '令牌所属用户不可用'
    })
  }

  const body = await readBody(event)
  const payload = ALLOWED_FIELDS.reduce((result: Record<string, any>, field) => {
    if (Object.prototype.hasOwnProperty.call(body || {}, field)) {
      result[field] = body[field]
    }
    return result
  }, {})

  return await requestSongForUser(event, user, payload)
})
