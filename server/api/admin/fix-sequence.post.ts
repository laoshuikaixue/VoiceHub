import { db } from '~/drizzle/db'
import { sql } from 'drizzle-orm'

function getFirstRow<T>(result: any): T | undefined {
  return result?.rows?.[0] ?? result?.[0]
}

function quoteIdentifierPart(value: string) {
  const normalized =
    value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value

  return `"${normalized.replace(/"/g, '""')}"`
}

function toQualifiedIdentifier(value: string) {
  return sql.raw(value.split('.').map(quoteIdentifierPart).join('.'))
}

function toPgRelationName(value: string) {
  return value.split('.').map(quoteIdentifierPart).join('.')
}

function toRegclass(value: string) {
  return sql.raw(`'${value.replace(/'/g, "''")}'::regclass`)
}

// 修复单个表的序列
async function fixTableSequence(table: string, dbTableName: string) {
  try {
    // 获取表的最大ID
    const maxIdResult = await db.execute(
      sql`SELECT MAX(id) as max_id FROM ${toQualifiedIdentifier(dbTableName)}`
    )
    const maxId = Number(getFirstRow<{ max_id: number | string | null }>(maxIdResult)?.max_id || 0)

    // 获取序列名称
    const sequenceNameResult = await db.execute(
      sql`SELECT pg_get_serial_sequence(${toPgRelationName(dbTableName)}, 'id') as sequence_name`
    )
    const sequenceName = getFirstRow<{ sequence_name: string | null }>(sequenceNameResult)?.sequence_name

    if (!sequenceName) {
      return {
        success: false,
        table: table,
        error: `无法找到表 ${table}.id 的序列`
      }
    }

    if (maxId === 0) {
      await db.execute(sql`ALTER SEQUENCE ${toQualifiedIdentifier(sequenceName)} RESTART WITH 1`)
      return {
        success: true,
        table: table,
        message: `表 ${table} 为空，序列已重置为 1`,
        data: {
          table: table,
          maxId: 0,
          newSequenceValue: 1,
          sequenceName: sequenceName
        }
      }
    }

    const currentSeqResult = await db.execute(
      sql`SELECT last_value FROM ${toQualifiedIdentifier(sequenceName)}`
    )
    const currentSeqValue = Number(
      getFirstRow<{ last_value: number | string }>(currentSeqResult)?.last_value || 0
    )
    const newSequenceValue = maxId
    await db.execute(sql`SELECT setval(${toRegclass(sequenceName)}, ${newSequenceValue})`)

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
        message: '需要管理员权限'
      })
    }

    const body = await readBody(event)
    const { table } = body

    // 支持的表列表和表名映射
    const supportedTables = [
      'Song',
      'User',
      'UserIdentity',
      'UserStatusLog',
      'Vote',
      'Schedule',
      'Notification',
      'NotificationSettings',
      'PlayTime',
      'Semester',
      'SystemSettings',
      'SongBlacklist',
      'SongReplayRequest',
      'RequestTime',
      'EmailTemplate'
    ]

    // Prisma模型名到数据库表名的映射
    const tableNameMap: Record<string, string> = {
      Song: 'Song',
      User: 'User',
      UserIdentity: 'UserIdentity',
      UserStatusLog: 'user_status_logs',
      Vote: 'Vote',
      Schedule: 'Schedule',
      Notification: 'Notification',
      NotificationSettings: 'NotificationSettings',
      PlayTime: 'PlayTime',
      Semester: 'Semester',
      SystemSettings: 'SystemSettings',
      SongBlacklist: 'SongBlacklist',
      SongReplayRequest: 'song_replay_requests',
      RequestTime: 'RequestTime',
      EmailTemplate: 'EmailTemplate'
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
