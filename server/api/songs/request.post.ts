import { requestSongForUser } from '~~/server/services/songRequestService'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, 'SONG_LOGIN_REQUIRED_REQUEST', '需要登录才能点歌')
  }

  const body = await readBody(event)

  return await requestSongForUser(event, user, body)
})
