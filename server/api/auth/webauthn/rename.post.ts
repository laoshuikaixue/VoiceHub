import { db, eq, and, userIdentities, sql } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  interface RenameRequestBody {
    id: string
    name: string
  }
  const body = await readBody<RenameRequestBody>(event)
  const { id, name: rawName } = body
  const name = typeof rawName === 'string' ? rawName.trim() : ''

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
    // 使用 jsonb_set 原子更新 label，避免覆盖 concurrent login 产生的 counter 更新
    await db.update(userIdentities)
      .set({ 
        providerUsername: sql`jsonb_set(${userIdentities.providerUsername}::jsonb, '{label}', ${JSON.stringify(name)}::jsonb)::text` 
      })
      .where(eq(userIdentities.id, id))

    return { success: true }
  } catch (e) {
    console.error('更新设备名称失败:', e)
    throw createError({ statusCode: 500, message: '更新失败' })
  }
})
