export default defineNitroPlugin(async (nitroApp) => {
  const isCloudflareWorker =
    typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

  // Workers（stateless）下连接不得跨请求存活：socket 归属创建请求的上下文，
  // 复用会产生跨请求 promise resolve（被运行时取消）或请求挂死。
  // 每请求结束即关闭该请求的数据库客户端。
  if (isCloudflareWorker) {
    const { closeRequestDb } = await import('~/drizzle/db');
    nitroApp.hooks.hook('afterResponse', async (event) => {
      const close = closeRequestDb(event as unknown as object);
      const waitUntil = (event as unknown as {
        context?: { cloudflare?: { context?: { waitUntil?: (p: Promise<unknown>) => void } } }
      }).context?.cloudflare?.context?.waitUntil;
      if (waitUntil) waitUntil(close);
      else await close;
    });
    return;
  }

  // 健康检查依赖只在 Node 运行时加载，避免边缘运行时求值数据库连接模块。
  const [{ db }, { sql }] = await Promise.all([
    import('~/drizzle/db'),
    import('drizzle-orm')
  ])

  // 全局未处理的Promise拒绝处理器
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)

    // 检查是否是数据库连接错误
    if (reason && typeof reason === 'object' && 'message' in reason) {
      const errorMessage = (reason as Error).message

      if (
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('Connection terminated') ||
        errorMessage.includes('Connection lost')
      ) {
        console.log('Database connection error detected, attempting to reconnect...')

        try {
          // 尝试重新连接数据库
          // 注意: Drizzle 没有显式的 connect/disconnect 方法
          // 连接由库自动管理
          await new Promise((resolve) => setTimeout(resolve, 2000)) // 等待2秒
          console.log('Database reconnection successful')
        } catch (reconnectError) {
          console.error('Database reconnection failed:', reconnectError)

          // 如果重连失败，等待更长时间后再次尝试
          setTimeout(async () => {
            try {
              // Note: Drizzle doesn't have explicit connect/disconnect methods
              await new Promise((resolve) => setTimeout(resolve, 5000)) // 等待5秒
              console.log('Database delayed reconnection successful')
            } catch (delayedReconnectError) {
              console.error('Database delayed reconnection failed:', delayedReconnectError)
            }
          }, 10000) // 10秒后重试
        }
      }
    }

    // 不要让进程退出，继续运行
    console.log('Process will continue running despite the error')
  })

  // 全局未捕获异常处理器
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)

    // 检查是否是数据库相关错误
    if (
      error.message.includes('ECONNRESET') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ETIMEDOUT')
    ) {
      console.log('Database-related uncaught exception, process will continue')
      return // 不退出进程
    }

    // 对于其他严重错误，记录但不退出
    console.error('Non-database uncaught exception, process will continue')
  })

  // 定期健康检查
  const healthCheckInterval = setInterval(async () => {
    try {
      await db.execute(sql`SELECT 1 as health_check`)
    } catch (error) {
      console.error('Health check failed:', error)

      // 尝试重新连接
      try {
        // Note: Drizzle doesn't have explicit connect/disconnect methods
        await new Promise((resolve) => setTimeout(resolve, 1000))
        console.log('Health check reconnection successful')
      } catch (reconnectError) {
        console.error('Health check reconnection failed:', reconnectError)
      }
    }
  }, 60000) // 每分钟检查一次

  // 在Nitro关闭时清理
  nitroApp.hooks.hook('close', () => {
    clearInterval(healthCheckInterval)
  })

  console.log('Global error handler initialized')
})
