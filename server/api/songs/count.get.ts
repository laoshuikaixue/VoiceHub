import { defineEventHandler, getQuery, createError } from 'h3'
import { db } from '~/drizzle/db'
import { songs } from '~/drizzle/schema'
import { count, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 获取查询参数
    const queryParams = getQuery(event)
    const semester = queryParams.semester as string
    
    // 获取歌曲总数
    let dbQuery = db.select({ count: count() }).from(songs)
    
    if (semester) {
      dbQuery = dbQuery.where(eq(songs.semester, semester))
    }
    
    const result = await dbQuery
    const songCount = result[0]?.count || 0
    
    return {
      count: songCount
    }
  } catch (error) {
    console.error('Error fetching song count:', error)
    throw createError({
      statusCode: 500,
      message: '获取歌曲数量失败'
    })
  }
})