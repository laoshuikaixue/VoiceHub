import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import type { SystemSettings } from '~/drizzle/schema'

/**
 * 统一读取系统设置，读取失败时返回 null，由调用方按安全默认值降级。
 * 说明：随主分支 minimize-Redis 重构，此处直接查询数据库，不再经过缓存层。
 */
export async function getSystemSettingsCached(): Promise<SystemSettings | null> {
  try {
    const [settings] = await db.select().from(systemSettings).limit(1)
    return settings ?? null
  } catch (error) {
    console.warn('[SystemSettings] 读取系统设置失败:', error)
    return null
  }
}
