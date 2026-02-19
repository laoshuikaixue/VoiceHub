import { db, eq, and, userIdentities } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const { id, name } = body

  if (!id || !name) {
    throw createError({ statusCode: 400, message: '参数错误' })
  }

  if (name.length > 50) {
    throw createError({ statusCode: 400, message: '设备名称过长' })
  }

  // 查找对应的 Passkey
  const identity = await db.query.userIdentities.findFirst({
    where: and(
      eq(userIdentities.id, id),
      eq(userIdentities.userId, user.id),
      eq(userIdentities.provider, 'webauthn')
    )
  })

  if (!identity) {
    throw createError({ statusCode: 404, message: '未找到该设备' })
  }

  try {
    const data = JSON.parse(identity.providerUsername)
    data.label = name
    
    await db.update(userIdentities)
      .set({ providerUsername: JSON.stringify(data) })
      .where(eq(userIdentities.id, id))

    return { success: true }
  } catch (e) {
    console.error('更新设备名称失败:', e)
    throw createError({ statusCode: 500, message: '更新失败' })
  }
})
