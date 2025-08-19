import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // 验证管理员权限
    const user = event.context.user
    if (!user || !user.isAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: '需要管理员权限'
      })
    }

    const body = await readBody(event)
    const { table } = body

    // 支持的表列表
    const supportedTables = ['Song']
    if (!table || !supportedTables.includes(table)) {
      return {
        success: false,
        error: `不支持的表名。支持的表: ${supportedTables.join(', ')}`
      }
    }

    // 获取表的最大ID
    const maxIdResult = await prisma.$queryRaw`
      SELECT MAX(id) as max_id FROM ${table}
    `
    const maxId = Number((maxIdResult as any)[0]?.max_id || 0)
    
    if (maxId === 0) {
      return {
        success: false,
        error: `表 ${table} 中没有找到记录`
      }
    }
    
    // 获取序列名称
    const sequenceNameResult = await prisma.$queryRaw`
      SELECT pg_get_serial_sequence(${table}, 'id') as sequence_name
    `
    const sequenceName = (sequenceNameResult as any)[0]?.sequence_name
    
    if (!sequenceName) {
      return {
        success: false,
        error: `无法找到表 ${table}.id 的序列`
      }
    }
    
    // 重置序列值到最大ID + 1
    const newSequenceValue = maxId + 1
    await prisma.$queryRaw`
      SELECT setval(${sequenceName}, ${newSequenceValue})
    `
    
    // 验证重置是否成功
    const verifyResult = await prisma.$queryRaw`
      SELECT nextval(${sequenceName}) as next_value
    `
    const nextValue = Number((verifyResult as any)[0]?.next_value)
    
    // 重置回正确的值（因为nextval消耗了一个值）
    await prisma.$queryRaw`
      SELECT setval(${sequenceName}, ${newSequenceValue})
    `
    
    return {
      success: true,
      message: `表 ${table} 的序列已成功重置`,
      data: {
        table: table,
        maxId: maxId,
        newSequenceValue: newSequenceValue,
        sequenceName: sequenceName,
        verified: nextValue === newSequenceValue + 1
      }
    }
  } catch (error) {
    console.error('Fix sequence error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
})