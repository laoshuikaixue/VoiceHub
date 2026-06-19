import { db } from '~/drizzle/db'
import { cardCodes, systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '需要登录才能验证点歌券' })
  }

  const body = (await readBody(event)) || {}
  const code = typeof body.cardCode === 'string' ? body.cardCode.trim().toUpperCase() : ''
  if (!code) {
    throw createError({ statusCode: 400, message: '请输入点歌券' })
  }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const settingsRows = await db.select().from(systemSettings).limit(1)
  const settings = settingsRows[0]
  const enabled = !!(settings?.enableCardCodeRequests || settings?.requireCardCodeForRequests)
  if (!enabled && !isAdmin) {
    throw createError({ statusCode: 400, message: '点歌券投稿功能未启用' })
  }

  const rows = await db
    .select({
      id: cardCodes.id,
      status: cardCodes.status
    })
    .from(cardCodes)
    .where(eq(cardCodes.code, code))
    .limit(1)

  const found = rows[0]
  if (!found || found.status !== 'AVAILABLE') {
    throw createError({ statusCode: 400, message: '点歌券无效或已被使用' })
  }

  return {
    valid: true,
    message: '点歌券可用'
  }
})
