import {
    and,
    db,
    eq,
    songs,
    systemSettings,
    songReplayRequests
} from '~/drizzle/db'

export default defineEventHandler(async (event) => {
    // 1. 检查用户认证
    const user = event.context.user
    if (!user) {
        throw createError({ statusCode: 401, message: '需要登录才能申请重播' })
    }

    // 2. 读取请求体
    const body = await readBody(event)
    const { songId } = body

    if (!songId) {
        throw createError({ statusCode: 400, message: '歌曲ID不能为空' })
    }

    // 3. 检查系统设置
    const settingsResult = await db.select().from(systemSettings).limit(1)
    const settings = settingsResult[0]
    if (!settings?.enableReplayRequests) {
        throw createError({ statusCode: 403, message: '重播申请功能未开启' })
    }

    // 4. 检查歌曲
    const songResult = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
    const song = songResult[0]
    if (!song) {
        throw createError({ statusCode: 404, message: '歌曲不存在' })
    }
    if (!song.played) {
        throw createError({ statusCode: 400, message: '该歌曲尚未播放，无法申请重播' })
    }

    // 5. 检查是否重复申请
    const existing = await db.select().from(songReplayRequests).where(
        and(
            eq(songReplayRequests.songId, songId),
            eq(songReplayRequests.userId, user.id)
        )
    ).limit(1)

    if (existing.length > 0) {
        throw createError({ statusCode: 400, message: '您已经申请过重播该歌曲' })
    }

    // 6. 插入申请记录
    try {
        await db.insert(songReplayRequests).values({
            songId,
            userId: user.id
        })
        return { success: true, message: '申请重播成功' }
    } catch (error: any) {
        // 处理唯一约束冲突
        if (error.code === '23505') {
            throw createError({ statusCode: 400, message: '您已经申请过重播该歌曲' })
        }
        throw error
    }
})
