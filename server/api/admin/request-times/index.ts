import {asc, db, desc, requestTimes} from '~/drizzle/db'
import {CacheService} from '../../../services/cacheService'
import {lt} from "drizzle-orm";

export default defineEventHandler(async (event) => {
    // 检查用户认证和权限
    const user = event.context.user

    if (!user) {
        throw createError({
            statusCode: 401,
            message: '未授权访问'
        })
    }

    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        throw createError({
            statusCode: 403,
            message: '只有管理员才能管理投稿开放时段'
        })
    }

    try {
        // 尝试从缓存获取播放时间数据
        // No Cache, No Trial
        //const cacheService = CacheService.getInstance()
        //let cachedRequestTimes = await cacheService.getRequestTimes()

        //if (cachedRequestTimes) {
        //    return cachedRequestTimes
        //}
        await db.update(requestTimes)
            .set({past: true})
            .where(lt(requestTimes.endTime, new Date().toLocaleString()))
        // 缓存中没有，从数据库获取所有投稿开放时段
        const requestTimesResult = await db.select().from(requestTimes)
            .orderBy(desc(requestTimes.enabled), asc(requestTimes.startTime))

        // 将数据存入缓存
        //try {
        //    await cacheService.setRequestTimes(requestTimesResult)
        //} catch (cacheError) {
        //    console.warn('缓存播放时间数据失败:', cacheError)
        //}

        return requestTimesResult
    } catch (error) {
        console.error('获取投稿开放时段失败:', error)
        throw createError({
            statusCode: 500,
            message: '获取投稿开放时段失败'
        })
    }
})