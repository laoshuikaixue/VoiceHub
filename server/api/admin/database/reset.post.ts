import {createError, defineEventHandler} from 'h3'
import {db} from '~/drizzle/db'
import {CacheService} from '../../../services/cacheService'
import {
    notificationSettings,
    notifications,
    playTimes,
    schedules,
    semesters,
    songBlacklists,
    songs,
    systemSettings,
    users,
    votes
} from '~/drizzle/schema'
import {ne, sql} from 'drizzle-orm'

// 重置所有表的自增序列
async function resetAutoIncrementSequences() {
    const tables = [
        'users',
        'songs',
        'votes',
        'schedules',
        'notifications',
        'notification_settings',
        'play_times',
        'semesters',
        'system_settings',
        'song_blacklists'
    ]

    for (const table of tables) {
        try {
            // PostgreSQL 重置序列的 SQL 命令
            // 注意：Drizzle 通常使用小写表名，序列名通常为 table_id_seq
            const sequenceName = `${table}_id_seq`
            await db.execute(sql.raw(`ALTER SEQUENCE "${sequenceName}" RESTART WITH 1`))
        } catch (error) {
            console.warn(`重置 ${table} 表序列失败: ${error.message}`)
        }
    }
}

export default defineEventHandler(async (event) => {
    try {
        // 验证管理员权限
        const user = event.context.user
        if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            throw createError({
                statusCode: 403,
                statusMessage: '权限不足'
            })
        }

        const resetResults = {
            success: true,
            message: '数据库重置完成',
            details: {
                tablesCleared: 0,
                recordsDeleted: 0,
                sequencesReset: 0,
                errors: [],
                preservedData: []
            }
        }

        try {
            // 使用事务确保数据一致性
            await db.transaction(async (tx) => {
                // 按照外键依赖顺序删除数据
                const deletedNotifications = await tx.delete(notifications).returning({id: notifications.id})
                resetResults.details.recordsDeleted += deletedNotifications.length
                resetResults.details.tablesCleared++

                const deletedNotificationSettings = await tx.delete(notificationSettings).returning({id: notificationSettings.id})
                resetResults.details.recordsDeleted += deletedNotificationSettings.length
                resetResults.details.tablesCleared++

                const deletedSchedules = await tx.delete(schedules).returning({id: schedules.id})
                resetResults.details.recordsDeleted += deletedSchedules.length
                resetResults.details.tablesCleared++

                const deletedVotes = await tx.delete(votes).returning({id: votes.id})
                resetResults.details.recordsDeleted += deletedVotes.length
                resetResults.details.tablesCleared++

                const deletedSongs = await tx.delete(songs).returning({id: songs.id})
                resetResults.details.recordsDeleted += deletedSongs.length
                resetResults.details.tablesCleared++

                // 删除黑名单
                const deletedBlacklists = await tx.delete(songBlacklists).returning({id: songBlacklists.id})
                resetResults.details.recordsDeleted += deletedBlacklists.length
                resetResults.details.tablesCleared++

                const deletedUsers = await tx.delete(users).where(ne(users.id, user.id)).returning({id: users.id})
                resetResults.details.recordsDeleted += deletedUsers.length
                resetResults.details.tablesCleared++
                resetResults.details.preservedData.push(`保留当前管理员账户: ${user.name}`)

                const deletedPlayTimes = await tx.delete(playTimes).returning({id: playTimes.id})
                resetResults.details.recordsDeleted += deletedPlayTimes.length
                resetResults.details.tablesCleared++

                const deletedSemesters = await tx.delete(semesters).returning({id: semesters.id})
                resetResults.details.recordsDeleted += deletedSemesters.length
                resetResults.details.tablesCleared++

                // 系统设置保持不变
                resetResults.details.preservedData.push('系统设置已保留')
            })

            // 重置自增序列，但要考虑保留的管理员账户
            await resetAutoIncrementSequences()

            // 特别处理User表的序列，确保下一个用户ID不会与保留的管理员冲突
            try {
                const nextUserId = user.id + 1
                await db.execute(sql.raw(`ALTER SEQUENCE "users_id_seq" RESTART WITH ${nextUserId}`))
            } catch (error) {
                console.warn(`调整User表序列失败: ${error.message}`)
            }

            resetResults.details.sequencesReset = 10 // 重置的表数量

            // 清除所有缓存
            try {
                const cacheService = CacheService.getInstance()
                await cacheService.clearAllCaches()
                console.log('数据库重置后缓存已清除')
            } catch (cacheError) {
                console.warn('清除缓存失败:', cacheError)
                resetResults.details.warnings = resetResults.details.warnings || []
                resetResults.details.warnings.push('清除缓存失败')
            }

            return resetResults

        } catch (error) {
            console.error('数据库重置失败:', error)
            resetResults.success = false
            resetResults.message = '数据库重置失败'
            resetResults.details.errors.push(error.message)

            throw createError({
                statusCode: 500,
                statusMessage: `数据库重置失败: ${error.message}`
            })
        }

    } catch (error) {
        console.error('重置数据库时发生错误:', error)

        if (error.statusCode) {
            throw error
        }

        throw createError({
            statusCode: 500,
            statusMessage: '服务器内部错误'
        })
    }
})