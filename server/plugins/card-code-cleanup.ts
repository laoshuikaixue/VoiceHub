import { cleanupExpiredCardCodes } from '~~/server/services/cardCodeCleanupService'

let cleanupTimer: ReturnType<typeof setInterval> | null = null
let cleanupRunning = false

const runCleanup = async () => {
  if (cleanupRunning) return
  cleanupRunning = true
  try {
    const result = await cleanupExpiredCardCodes()
    if (result.deleted > 0) {
      console.log(`[CardCode Cleanup] 已自动删除 ${result.deleted} 张过期点歌券`)
    }
  } catch (error) {
    console.error('[CardCode Cleanup] 自动清理点歌券失败:', error)
  } finally {
    cleanupRunning = false
  }
}

export default defineNitroPlugin(() => {
  if (cleanupTimer) return
  runCleanup()
  cleanupTimer = setInterval(runCleanup, 60 * 60 * 1000)
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref()
})
