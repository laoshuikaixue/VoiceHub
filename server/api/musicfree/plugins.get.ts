import { getMusicFreePluginsConfig } from '~~/server/utils/musicfree'

export default defineEventHandler(async () => {
  try {
    // 没有 search 方法的插件无法作为独立平台参与搜索，不暴露
    const data = (await getMusicFreePluginsConfig())
      .filter((handle) => typeof handle.instance?.search === 'function')
      .map((handle) => ({
        platform: `musicfree:${handle.id}`,
        displayName: handle.displayName,
        // 稳定唯一 id，供客户端直接取用（与 platform 后缀一致）
        id: handle.id
      }))
    return { success: true, data }
  } catch (error: any) {
    throw createError({ statusCode: 502, message: error?.message || '获取 MusicFree 插件列表失败' })
  }
})
