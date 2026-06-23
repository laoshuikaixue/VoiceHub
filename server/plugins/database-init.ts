import { initDatabase } from '~/drizzle/db'

export default defineNitroPlugin(async () => {
  console.log('[DB] 开始数据库初始化...')
  try {
    await initDatabase()
    console.log('[DB] 数据库初始化完成')
  } catch (error) {
    console.error('[DB] 数据库初始化失败:', error)
  }
})