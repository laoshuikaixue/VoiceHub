import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { MUSICFREE_PLUGIN_DIR } from '~~/server/config/constants'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { BUNDLED_MUSICFREE_PLUGINS } from './musicfree-bundles/manifest'

const require = createRequire(import.meta.url)
// 相对路径锚定到进程工作目录：部署环境 cwd 不一致时会静默读不到插件，日志里需能看出实际路径
const PLUGIN_ROOT = resolve(process.cwd(), MUSICFREE_PLUGIN_DIR)
// 仅用于兼容性收敛（避免插件引入服务端不该暴露的模块），不是安全边界：
// vm 上下文内的插件仍可通过宿主对象原型链触达 process 等宿主能力，插件以服务器完整权限运行
const ALLOWED_MODULES = new Set([
  'axios',
  'cheerio',
  'crypto-js',
  'dayjs',
  'big-integer',
  'qs',
  'he',
  'webdav'
])
const PLUGIN_TIMEOUT_MS = 15000
const CODE_LIMIT = 5 * 1024 * 1024
const MAX_RESULTS_PER_PLUGIN = 50
// 聚合搜索的最终结果上限，防止插件数量多时结果无界膨胀
const MAX_AGGREGATE_RESULTS = 100

export const getMusicFreePluginDir = (): string => PLUGIN_ROOT

const safeString = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

// 插件返回的数据未经类型约束，按 any 处理
const cloneJson = (value: any): any => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

const withTimeout = <T = any>(task: Promise<T>, label: string): Promise<T> =>
  Promise.race([task, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), PLUGIN_TIMEOUT_MS))])

// 插件对象统一以自身声明的 platform 为标识（loadPluginFromCode 已保证非空）
const pluginKey = (plugin: any): string => safeString(plugin.platform).trim()

const readPluginNames = (): string[] => {
  try {
    if (!existsSync(PLUGIN_ROOT)) return []
    return readdirSync(PLUGIN_ROOT)
      .filter((name) => name.endsWith('.js'))
      .sort()
      .map((name) => basename(name, '.js').trim() || 'musicfree-plugin')
  } catch (error) {
    // 目录不可读（权限、挂载异常等）时按无插件处理，不影响内置音源
    console.warn('[MusicFree] 插件目录读取失败，按无插件模式运行:', error?.message || error)
    return []
  }
}

const loadPluginsFromDisk = async (): Promise<any[]> => {
  // 构建期打包的插件优先：直接 import 的 ESM 模块，不依赖 node:vm，可跑在 serverless 上
  if (BUNDLED_MUSICFREE_PLUGINS.length > 0) {
    console.info(`[MusicFree] 使用构建期打包的 ${BUNDLED_MUSICFREE_PLUGINS.length} 个插件`)
    return BUNDLED_MUSICFREE_PLUGINS
  }
  const names = readPluginNames()
  if (names.length === 0) {
    console.warn(`[MusicFree] 未从 ${PLUGIN_ROOT} 读取到插件文件`)
    return []
  }
  console.info(`[MusicFree] 从 ${PLUGIN_ROOT} 读取到 ${names.length} 个插件文件`)

  const plugins: any[] = []
  for (const name of names) {
    try {
      plugins.push(loadPluginFromCode(readFileSync(join(PLUGIN_ROOT, `${name}.js`), 'utf8'), name))
      console.info(`[MusicFree] 插件 ${name} 加载成功`)
    } catch (error) {
      console.warn(`[MusicFree] 插件 ${name} 加载失败:`, error)
    }
  }
  return plugins
}

let pluginsCache: any[] | null = null
let pluginsLoading: Promise<any[]> | null = null

// 模块级缓存：避免每次搜索/解析/歌词请求都重新读盘与 vm 编译；插件目录变更后需重启服务生效
export const getMusicFreePluginsConfig = async (): Promise<any[]> => {
  if (pluginsCache) return pluginsCache
  if (pluginsLoading) return pluginsLoading
  pluginsLoading = loadPluginsFromDisk().then((plugins) => {
    pluginsCache = plugins
    pluginsLoading = null
    return plugins
  })
  return pluginsLoading
}

// 按候选键读取单个插件的用户变量；文件缺失、格式非法或键不匹配时回退空对象
// 插件运行环境：cookie 等登录态由插件源码自行携带（公用音源），不另做配置入口
const createSandbox = () => {
  const module = { exports: {} as any }

  const sandbox: Record<string, any> = {
    module,
    exports: module.exports,
    require: (moduleName: string) => {
      if (!ALLOWED_MODULES.has(moduleName)) throw new Error(`MusicFree 插件不允许引入模块: ${moduleName}`)
      return require(moduleName)
    },
    console,
    Buffer,
    TextEncoder,
    TextDecoder,
    btoa: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    atob: (value: string) => Buffer.from(value, 'binary').toString('base64'),
    encodeURIComponent,
    decodeURIComponent,
    JSON,
    Math,
    Date,
    URL,
    URLSearchParams,
    AbortController,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    Promise,
    env: {
      // 保留协议方法并返回空对象：调用它的插件不会因方法缺失而报错
      getUserVariables: () => ({}),
      os: 'linux',
      appVersion: process.env.npm_package_version || '1.6.0',
      lang: 'zh-CN'
    }
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  return { module, sandbox }
}

const loadPluginFromCode = (code: string, pluginName: string): any => {
  if (!code || code.length > CODE_LIMIT) throw new Error('插件代码为空或超过大小限制')
  const { module, sandbox } = createSandbox()
  vm.runInContext(code, sandbox, { timeout: 3000, filename: `musicfree-${pluginName}.js` })

  const plugin = module.exports?.default || module.exports
  if (!plugin || typeof plugin !== 'object') throw new Error('插件未导出有效对象')
  // platform 缺失时回退到文件名，保证平台标识稳定可路由
  const declaredPlatform = safeString(plugin.platform).trim()
  if (!declaredPlatform) plugin.platform = pluginName
  return plugin
}

// 实现了 method 的插件；pluginName 非空时只取 platform 匹配的那一个
const pluginsWith = async (method: string, pluginName: string): Promise<any[]> => {
  const plugins = await getMusicFreePluginsConfig()
  return plugins.filter((plugin) => typeof plugin[method] === 'function' && (!pluginName || pluginKey(plugin) === pluginName))
}

// 播放链接/歌词请求里没有 musicFreePlugin 字段时，从 platform 前缀还原插件名
const itemPluginName = (musicItem: any): string => {
  const declared = safeString(musicItem?.musicFreePlugin)
  if (declared) return declared
  const platform = safeString(musicItem?.musicPlatform || musicItem?.platform)
  return platform.startsWith('musicfree:') ? platform.slice('musicfree:'.length) : ''
}

export const searchMusicFreePlugins = async (query: string, page = 1, limit = 20, pluginName?: string): Promise<any[]> => {
  const targets = await pluginsWith('search', pluginName || '')
  // 单插件已有 MAX_RESULTS_PER_PLUGIN 上限，这里再对聚合结果截断，保证分页语义稳定
  const maxResults = Math.min(Math.max(1, Number(limit) || 20), MAX_AGGREGATE_RESULTS)
  const results: any[] = []
  const errors: string[] = []

  await Promise.all(
    targets.map(async (plugin) => {
      try {
        const result = await withTimeout(plugin.search(query, page, 'music'), '插件搜索超时')
        for (const item of (Array.isArray(result?.data) ? result.data : []).slice(0, MAX_RESULTS_PER_PLUGIN)) {
          const mapped = mapMusicFreeItem(item, pluginKey(plugin))
          if (mapped) results.push(mapped)
        }
      } catch (error: any) {
        errors.push(`${pluginKey(plugin)}: ${error?.message || error}`)
      }
    })
  )

  if (results.length === 0 && errors.length > 0) {
    console.warn('[MusicFree] 插件搜索失败:', errors.slice(0, 5).join('; '))
  }
  return results.slice(0, maxResults)
}

export const getMusicFreeMediaSource = async (
  musicItem: any,
  quality = 'standard'
): Promise<{ url: string; headers?: Record<string, string> }> => {
  const pluginName = itemPluginName(musicItem)
  const errors: string[] = []

  for (const plugin of await pluginsWith('getMediaSource', pluginName)) {
    try {
      const result = await withTimeout(plugin.getMediaSource(cloneJson(musicItem), quality), '插件获取播放链接超时')
      const url = safeString(result?.url || musicItem?.url).trim()
      if (url) return { url, headers: result?.headers && typeof result.headers === 'object' ? result.headers : undefined }
    } catch (error: any) {
      errors.push(`${pluginKey(plugin)}: ${error?.message || error}`)
    }
  }
  throw new Error(errors[0] || 'MusicFree 插件未返回播放链接')
}

export const getMusicFreeLyric = async (musicItem: any): Promise<{ rawLrc?: string; translation?: string } | null> => {
  for (const plugin of await pluginsWith('getLyric', itemPluginName(musicItem))) {
    try {
      const result = await withTimeout(plugin.getLyric(cloneJson(musicItem)), '插件获取歌词超时')
      const rawLrc = safeString(result?.rawLrc || result?.lrc).trim()
      const translation = safeString(result?.translation).trim()
      if (rawLrc || translation) return { rawLrc, translation }
    } catch (error: any) {
      console.warn(`[MusicFree] 插件歌词获取失败 ${pluginKey(plugin)}:`, error?.message || error)
    }
  }
  return null
}

const mapMusicFreeItem = (item: any, pluginName: string): any | null => {
  const id = safeString(item?.id).trim()
  const title = safeString(item?.title || item?.song || item?.name).trim()
  const artist = safeString(item?.artist || item?.singer).trim()
  if (!id || !title || !artist) return null

  const duration = Number(item?.duration)
  const platform = `musicfree:${pluginName}`
  return {
    ...cloneJson(item),
    id,
    title,
    artist,
    musicId: id,
    musicPlatform: platform,
    actualMusicPlatform: platform,
    sourceInfo: { source: 'musicfree', plugin: pluginName, platform, fetchedAt: getServerTimestamp() },
    musicFreePlugin: pluginName,
    cover: safeString(item?.artwork || item?.cover || item?.pic || '').trim() || null,
    album: safeString(item?.album).trim() || '',
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    url: safeString(item?.url).trim() || undefined,
    hasUrl: !!safeString(item?.url).trim()
  }
}
