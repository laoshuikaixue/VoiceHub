import { db } from '~/drizzle/db'
import { sql } from 'drizzle-orm'

// 修复单个表的序列
async function fixTableSequence(table: string, dbTableName: string) {
  try {
    // 获取表的最大ID
    const maxIdResult = await db.execute(sql.raw(`SELECT MAX(id) as max_id FROM "${dbTableName}"`))
    const maxId = Number((maxIdResult as any)[0]?.max_id || 0)

    if (maxId === 0) {
      return {
        success: true,
        table: table,
        message: `表 ${table} 为空，无需修复序列`,
        data: {
          table: table,
          maxId: 0,
          skipped: true
        }
      }
    }

    // 获取序列名称
    const sequenceNameResult = await db.execute(
      sql.raw(`SELECT pg_get_serial_sequence('"${dbTableName}"', 'id') as sequence_name`)
    )
    const sequenceName = (sequenceNameResult as any)[0]?.sequence_name

    if (!sequenceName) {
      return {
        success: false,
        table: table,
        error: `无法找到表 ${table}.id 的序列`
      }
    }

    // 获取当前序列值
    const currentSeqResult = await db.execute(sql.raw(`SELECT last_value FROM ${sequenceName}`))
    const currentSeqValue = Number((currentSeqResult as any)[0]?.last_value || 0)

    // 重置序列值到最大ID + 1
    const newSequenceValue = maxId + 1

    // 检查序列是否已经正确
    if (currentSeqValue >= newSequenceValue) {
      return {
        success: true,
        table: table,
        message: `表 ${table} 序列值已正确，无需修复`,
        data: {
          table: table,
          maxId: maxId,
          currentSequenceValue: currentSeqValue,
          alreadyCorrect: true
        }
      }
    }

    await db.execute(sql.raw(`SELECT setval('${sequenceName}', ${newSequenceValue})`))

    return {
      success: true,
      table: table,
      message: `表 ${table} 的序列已成功重置 (${currentSeqValue} → ${newSequenceValue})`,
      data: {
        table: table,
        maxId: maxId,
        oldSequenceValue: currentSeqValue,
        newSequenceValue: newSequenceValue,
        sequenceName: sequenceName
      }
    }
  } catch (error) {
    return {
      success: false,
      table: table,
      error: error instanceof Error ? error.message : '未知错误'
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
        statusMessage: '需要管理员权限'
      })
    }

    const body = await readBody(event)
    const { table } = body

    // 支持的表列表和表名映射
    const supportedTables = [
      'Song',
      'User',
      'Vote',
      'Schedule',
      'Notification',
      'NotificationSettings',
      'PlayTime',
      'Semester',
      'SystemSettings',
      'SongBlacklist',
      'SongReplayRequest',
      'RequestTime'
    ]

    // Prisma模型名到数据库表名的映射
    const tableNameMap: Record<string, string> = {
      Song: 'Song',
      User: 'User',
      Vote: 'Vote',
      Schedule: 'Schedule',
      Notification: 'Notification',
      NotificationSettings: 'NotificationSettings',
      PlayTime: 'PlayTime',
      Semester: 'Semester',
      SystemSettings: 'SystemSettings',
      SongBlacklist: 'SongBlacklist',
      SongReplayRequest: 'song_replay_requests',
      RequestTime: 'RequestTime'
    }

    // 如果没有指定表名或指定为'all'，则修复所有表
    if (!table || table === 'all') {
      const results = []
      let hasError = false
      let fixedCount = 0
      let skippedCount = 0
      let errorCount = 0

      for (const tableName of supportedTables) {
        try {
          const result = await fixTableSequence(tableName, tableNameMap[tableName])
          results.push(result)

          if (result.success) {
            if (result.data?.skipped || result.data?.alreadyCorrect) {
              skippedCount++
            } else {
              fixedCount++
            }
          } else {
            hasError = true
            errorCount++
          }
        } catch (error) {
          const errorResult = {
            success: false,
            table: tableName,
            error: error instanceof Error ? error.message : '未知错误'
          }
          results.push(errorResult)
          hasError = true
          errorCount++
        }
      }

      return {
        success: !hasError,
        message: hasError ? `序列修复完成，但有 ${errorCount} 个表失败` : `所有表序列修复完成`,
        summary: {
          total: supportedTables.length,
          fixed: fixedCount,
          skipped: skippedCount,
          errors: errorCount
        },
        results: results
      }
    }

    if (!supportedTables.includes(table)) {
      return {
        success: false,
        error: `不支持的表名。支持的表: ${supportedTables.join(', ')}, 或使用 'all' 修复所有表`
      }
    }

    const dbTableName = tableNameMap[table]

    // 使用辅助函数修复单个表
    return await fixTableSequence(table, dbTableName)
  } catch (error) {
    console.error('Fix sequence error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
})
