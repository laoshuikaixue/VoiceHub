import { getMusicFreePluginsConfig } from '~~/server/utils/musicfree'

export default defineEventHandler(async () => {
  try {
    // 没有 search 方法的插件无法作为独立平台参与搜索，不暴露
    const data = (await getMusicFreePluginsConfig())
      .filter((plugin: any) => typeof plugin?.search === 'function')
      .map((plugin: any) => {
        const platform = String(plugin.platform).trim()
        return {
          platform: `musicfree:${platform}`,
          displayName: platform.replace(/_/g, ' ')
        }
      })
    return { success: true, data }
  } catch (error: any) {
    throw createError({ statusCode: 502, message: error?.message || '获取 MusicFree 插件列表失败' })
  }
})
