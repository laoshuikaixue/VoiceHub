import {
  syncNow,
  markSynced,
  isTimeSynced,
  getTimeOffset
} from '~~/server/utils/serverTime'

export default defineNitroPlugin(async () => {
  console.log('[TimeSync] Nitro 启动，开始初始化服务器时间同步...')

  try {
    await Promise.race([
      syncNow(),
      new Promise<void>(resolve => {
        setTimeout(() => {
          if (!isTimeSynced()) {
            console.warn('[TimeSync] 启动同步超时，将使用系统本地时间')
            markSynced()
          }
          resolve()
        }, 3000)
      })
    ])
  } catch (err) {
    console.error('[TimeSync] 启动同步失败，将使用系统本地时间:', err)
    markSynced()
  }

  if (isTimeSynced()) {
    console.log(`[TimeSync] 服务端时间同步完成，偏移量: ${getTimeOffset()}ms`)
  }
})
