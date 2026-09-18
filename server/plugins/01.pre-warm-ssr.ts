import { pluginCapabilities } from '~~/server/utils/music-source-plugins/resolver'

export default defineNitroPlugin(async (nitroApp) => {
  // 预热 SSR 渲染器，避免首次请求因模块循环依赖导致的 500 错误
  // server.mjs 静态引用 renderer.mjs，renderer.mjs 动态引用 server.mjs，
  // 首次动态加载时 r.default 可能为 undefined，通过提前触发一次加载使缓存就绪
  try {
    await nitroApp.localFetch('/', { headers: { 'x-prerender-revalidate': 'true' } })
  } catch {
    // 预热失败是正常的（首次模块加载尚未完成），第一次真实请求时渲染器已就绪
  }

  // 插件预热放到后台：常驻模式会逐个下载脚本并初始化沙箱，阻塞等待会让服务在首个请求前空等数十秒
  // 未配置插件属正常情况，只是没有音源可加载
  void pluginCapabilities()
    .then((plugins) => console.info(`[音源插件] 启动预热完成，共加载 ${plugins.length} 个插件`))
    .catch((error) => console.warn('[音源插件] 启动预热失败:', error))
})
