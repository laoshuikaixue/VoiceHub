import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songBlacklists, systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { title, artist } = body

  if (!title) {
    throw createError({
      statusCode: 400,
      message: '歌曲标题不能为空'
    })
  }

  try {
    // 获取系统设置
    const systemSettingsResult = await db.select().from(systemSettings).limit(1)
    const systemSettingsData = systemSettingsResult[0]
    const showBlacklistKeywords = systemSettingsData?.showBlacklistKeywords ?? false

    // 获取所有活跃的黑名单项
    const blacklistItems = await db
      .select()
      .from(songBlacklists)
      .where(eq(songBlacklists.isActive, true))

    const songFullName = `${title} - ${artist || ''}`.toLowerCase()
    const blocked = []

    for (const item of blacklistItems) {
      if (item.type === 'SONG') {
        // 检查具体歌曲
        if (songFullName.includes(item.value.toLowerCase())) {
          blocked.push({
            type: 'song',
            value: item.value,
            reason: item.reason || '该歌曲已被加入黑名单'
          })
        }
      } else if (item.type === 'KEYWORD') {
        // 检查关键词
        if (songFullName.includes(item.value.toLowerCase())) {
          blocked.push({
            type: 'keyword',
            value: showBlacklistKeywords ? item.value : null, // 根据设置决定是否显示具体关键词
            reason:
              item.reason || (showBlacklistKeywords ? `包含关键词：${item.value}` : '包含关键词')
          })
        }
      }
    }

    return {
      isBlocked: blocked.length > 0,
      reasons: blocked,
      song: {
        title,
        artist
      }
    }
  } catch (error) {
    console.error('检查黑名单失败:', error)
    throw createError({
      statusCode: 500,
      message: '检查黑名单失败'
    })
  }
})
