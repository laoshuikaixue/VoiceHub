import { flushAstrbotGroupOutbox } from '~~/server/services/astrbotGroupService'

/**
 * push 模式下的群事件投递器。
 *
 * 群事件入队时只写库（与私聊通知的入队路径一致），真正的投递由这里周期性完成：
 * 冷却闸门到点后条目才可投递，因此周期扫描同时起到「合并窗口到期即发」的作用。
 *
 * pull 模式不启动本任务：通知由插件主动领取，投递时机由插件的轮询决定。
 */
const FLUSH_INTERVAL_MS = 15_000

export default defineNitroPlugin((nitroApp) => {
  let running = false
  const timer = setInterval(async () => {
    // 单次冲刷可能慢于间隔（插件不可达时）——用标志位避免任务叠加。
    if (running) return
    running = true
    try {
      const { getSystemSettingsCached } = await import('~~/server/utils/system-settings-helper')
      const settings = await getSystemSettingsCached()
      if (settings?.astrbotPushMode !== 'pull') {
        await flushAstrbotGroupOutbox()
      }
    } catch (error) {
      console.error('[AstrBot] 群事件冲刷失败:', error)
    } finally {
      running = false
    }
  }, FLUSH_INTERVAL_MS)

  // 定时器不应拖住进程退出。
  if (typeof timer.unref === 'function') timer.unref()

  nitroApp.hooks.hook('close', () => {
    clearInterval(timer)
  })
})
