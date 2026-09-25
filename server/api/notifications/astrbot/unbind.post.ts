import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindingCodes, users } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '请先登录')
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update')
    await tx.update(users).set({ astrbotUmo: null, astrbotPlatform: null, astrbotBoundAt: null })
      .where(eq(users.id, user.id))
    await tx.delete(astrbotBindingCodes).where(eq(astrbotBindingCodes.userId, user.id))
    return { success: true }
  })
})
