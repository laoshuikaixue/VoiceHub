import { db, songReplayRequests } from '~/drizzle/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    // Check Admin
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        throw createError({ statusCode: 403, message: '权限不足' })
    }

    const body = await readBody(event)
    const { songId } = body

    if (!songId) {
        throw createError({ statusCode: 400, message: '缺少参数' })
    }

    await db.update(songReplayRequests)
        .set({ status: 'REJECTED' })
        .where(and(
            eq(songReplayRequests.songId, songId),
            eq(songReplayRequests.status, 'PENDING')
        ))

    return { success: true }
})
