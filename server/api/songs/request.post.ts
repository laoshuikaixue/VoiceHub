import { requestSongForUser } from '~~/server/services/songRequestService'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能点歌'
    })
  }

  const body = await readBody(event)

  return await requestSongForUser(event, user, body)
})
