import { eq } from 'drizzle-orm'
import { scheduleSongPool, songs, users } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'

/**
 * 恢复单条备选池记录（含 songId + addedBy 外键映射校验）
 * 返回 void；歌曲不存在时记录警告并跳过
 */
export async function restoreScheduleSongPoolRecord(
  tx: any,
  record: any,
  songIdMapping: Map<number, number>,
  userIdMapping: Map<number, number>,
  stats: { warnings: string[]; created?: number },
  onInserted?: () => void
): Promise<void> {
  let validPoolSongId = record.songId
  const mappedPoolSongId = songIdMapping.get(record.songId)
  if (mappedPoolSongId) {
    validPoolSongId = mappedPoolSongId
  } else {
    const songExists = await tx
      .select()
      .from(songs)
      .where(eq(songs.id, record.songId))
      .limit(1)
    if (songExists.length === 0) {
      console.warn(`备选池记录的歌曲ID ${record.songId} 不存在，跳过此记录`)
      stats.warnings.push(`备选池歌曲ID ${record.songId} 不存在`)
      return
    }
    // mapping 未命中但歌曲存在时，使用数据库查到的 ID（merge 模式下可能已被重新分配）
    validPoolSongId = songExists[0].id
  }

  let validPoolAddedBy = record.addedBy || null
  if (validPoolAddedBy) {
    const mappedAddedBy = userIdMapping.get(validPoolAddedBy)
    if (mappedAddedBy) {
      validPoolAddedBy = mappedAddedBy
    } else {
      const userExists = await tx
        .select()
        .from(users)
        .where(eq(users.id, validPoolAddedBy))
        .limit(1)
      if (userExists.length === 0) {
        validPoolAddedBy = null
      }
    }
  }

  let createdAt = getServerDate()
  if (record.createdAt) {
    const d = new Date(record.createdAt)
    if (!Number.isNaN(d.getTime())) {
      createdAt = d
    } else {
      console.warn(`备选池记录 createdAt "${record.createdAt}" 非法，使用当前时间`)
    }
  }

  const poolData = {
    songId: validPoolSongId,
    addedBy: validPoolAddedBy,
    createdAt
  }

  const inserted = await tx.insert(scheduleSongPool).values(poolData).onConflictDoNothing({ target: [scheduleSongPool.songId] }).returning()
  if (inserted.length > 0) onInserted?.()
}
