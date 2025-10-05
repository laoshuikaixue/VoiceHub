import {createError, defineEventHandler} from 'h3'
import {db} from '~/drizzle/db'
import {CacheService} from '../../../services/cacheService'

// 重置所有表的自增序列
async function resetAutoIncrementSequences() {
    const tables = [
        'User',
        'Song',
        'Vote',
        'Schedule',
        'Notification',
        'NotificationSettings',
        'PlayTime',
        'Semester',
        'SystemSettings',
        'SongBlacklist'
    ]

    for (const table of tables) {
        try {
            // PostgreSQL 重置序列的 SQL 命令
            const sequenceName = `"${table}_id_seq"`
            await db.$executeRawUnsafe(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`)
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
            await db.$transaction(async (tx) => {
                // 按照外键依赖顺序删除数据
                const deletedNotifications = await tx.notification.deleteMany()
                resetResults.details.recordsDeleted += deletedNotifications.count
                resetResults.details.tablesCleared++

                const deletedNotificationSettings = await tx.notificationSettings.deleteMany()
                resetResults.details.recordsDeleted += deletedNotificationSettings.count
                resetResults.details.tablesCleared++

                const deletedSchedules = await tx.schedule.deleteMany()
                resetResults.details.recordsDeleted += deletedSchedules.count
                resetResults.details.tablesCleared++

                const deletedVotes = await tx.vote.deleteMany()
                resetResults.details.recordsDeleted += deletedVotes.count
                resetResults.details.tablesCleared++

                const deletedSongs = await tx.song.deleteMany()
                resetResults.details.recordsDeleted += deletedSongs.count
                resetResults.details.tablesCleared++

                const deletedUsers = await tx.user.deleteMany({
                    where: {
                        NOT: {
                            id: user.id // 保留当前操作的管理员账户
                        }
                    }
                })
                resetResults.details.recordsDeleted += deletedUsers.count
                resetResults.details.tablesCleared++
                resetResults.details.preservedData.push(`保留当前管理员账户: ${user.name}`)

                const deletedPlayTimes = await tx.playTime.deleteMany()
                resetResults.details.recordsDeleted += deletedPlayTimes.count
                resetResults.details.tablesCleared++

                const deletedSemesters = await tx.semester.deleteMany()
                resetResults.details.recordsDeleted += deletedSemesters.count
                resetResults.details.tablesCleared++

                // 系统设置保持不变
                resetResults.details.preservedData.push('系统设置已保留')
            })

            // 重置自增序列，但要考虑保留的管理员账户
            await resetAutoIncrementSequences()

            // 特别处理User表的序列，确保下一个用户ID不会与保留的管理员冲突
            try {
                const nextUserId = user.id + 1
                await db.$executeRawUnsafe(`ALTER SEQUENCE "User_id_seq" RESTART WITH ${nextUserId}`)
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