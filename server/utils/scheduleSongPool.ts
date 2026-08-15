import { db } from '~/drizzle/db'
import { scheduleSongPool, songs } from '~/drizzle/schema'
import { eq, count } from 'drizzle-orm'

// 返回备选池有效记录数（innerJoin 排除歌曲已删除的孤立记录）
export const fetchPoolCount = async () => {
  const result = await db
    .select({ count: count() })
    .from(scheduleSongPool)
    .innerJoin(songs, eq(scheduleSongPool.songId, songs.id))
    .limit(1)
  return result[0]?.count || 0
}
