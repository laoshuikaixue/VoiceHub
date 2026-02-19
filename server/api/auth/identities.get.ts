import { db, eq, and, userIdentities } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const identities = await db.query.userIdentities.findMany({
    where: eq(userIdentities.userId, user.id),
    columns: {
      provider: true,
      providerUsername: true,
      createdAt: true
    }
  })

  return identities
})
