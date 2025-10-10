import {asc, db, eq, requestTimes, systemSettings} from '~/drizzle/db'
import type {PlayTime} from '~/drizzle/schema'
import {gte, lt, lte, gt, or, and} from "drizzle-orm";

export default defineEventHandler(async (event) => {
    try {
        // 检查用户认证
        const user = event.context.user
        
        const settingsResult = await db.select().from(systemSettings).limit(1)
        const settings = settingsResult[0] || null
        let enabled = settings?.enableRequestTimeLimitation || false
        const forceBlockAllRequests = settings?.forceBlockAllRequests || false
        let hit = false;
        let accepted = 0;
        let expected = 0;

        if (enabled && (!user || user.role !== 'SUPER_ADMIN')) {
            const now = new Date();

            const hitRequestTimeResult = await db.select().from(requestTimes).where(and(and(lte(requestTimes.startTime, now), gt(requestTimes.endTime, now)), eq(requestTimes.enabled, true))).limit(1)
            const hitRequestTime = hitRequestTimeResult[0]

            if (hitRequestTime) {
                hit = true;
                accepted = hitRequestTime?.accepted || 0;
                expected = hitRequestTime?.expected || 0;
            }
        } else {
            hit = true;
        }

        if (forceBlockAllRequests && (!user || user.role !== 'SUPER_ADMIN')) {
            hit = false;
            enabled = true;
        }

        return {
            hit,
            enabled,
            accepted,
            expected
        }
    } catch (error) {
        console.error('获取播出时段失败:', error)
        throw createError({
            statusCode: 500,
            message: '获取播出时段失败'
        })
    }
})