import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import { MUSICFREE_BUNDLES_DIR, MUSICFREE_PLUGIN_DIR } from '~~/server/config/constants'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { BUNDLED_MUSICFREE_PLUGINS } from './musicfree-bundles/manifest'

// Nitro 把 import.meta.url 重写为 file:///_entry.js，createRequire 会解析不到任何 npm 依赖；
// 固定锚定到进程工作目录（项目根，node_modules 所在层），保证本地插件的 require 在打包产物中可用
const require = createRequire(pathToFileURL(process.cwd() + sep + 'package.json').toString())
// 相对路径锚定到进程工作目录：部署环境 cwd 不一致时会静默读不到插件，日志里需能看出实际路径
const PLUGIN_ROOT = resolve(process.cwd(), MUSICFREE_PLUGIN_DIR)
const BUNDLES_ROOT = resolve(process.cwd(), MUSICFREE_BUNDLES_DIR)
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

/**
 * 校验 musicItem 的插件标识，返回插件 id 或空字符串。
 * 与 itemPluginName 一致：优先取 musicFreePlugin，回退到 musicPlatform/platform 前缀。
 * API 路由使用此函数做 400 校验，避免校验口径与运行时不一致。
 */
export const extractPluginId = (musicItem: any): string => {
  const declared = safeString(musicItem?.musicFreePlugin)
  if (declared) return declared.trim()
  const platform = safeString(musicItem?.musicPlatform || musicItem?.platform)
  return platform.startsWith('musicfree:') ? platform.slice('musicfree:'.length).trim() : ''
}

// 插件返回的数据未经类型约束，按 any 处理
const cloneJson = (value: any): any => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

// 仅防止调用方挂起；不取消底层任务，超时的 promise 仍在后台运行。
// 插件方法通常发起 HTTP 请求（axios 自带 timeout），极端情况可接受。
const withTimeout = <T = any>(task: Promise<T>, label: string): Promise<T> =>
  Promise.race([task, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), PLUGIN_TIMEOUT_MS))])

// 文件名 stem → 稳定唯一 id；与 scripts/build-musicfree-plugins.js 的 slug 规则一致，
// 保证"磁盘加载"与"构建期打包"两条路径产出相同 id，路由键不随加载方式漂移
const toPluginId = (stem: string): string => stem.replace(/[^\w\u4e00-\u9fa5-]/g, '_').replace(/^_+|_+$/g, '')

/**
 * 插件运行时句柄。
 * - id：稳定唯一路由键（文件名 stem 归一化），暴露给客户端作为 musicfree:<id> 的后缀
 * - platform：插件声明的 platform 字段，仅作显示名，不参与路由
 * - instance：插件对象，含 search/getMediaSource/getLyric 等方法
 */
export type MusicFreePluginHandle = {
  id: string
  platform: string
  displayName: string
  instance: any
}

// 同时返回 id 与原始文件名：id 作路由键，file 用于读盘
const readPluginFiles = (): { id: string; file: string }[] => {
  try {
    if (!existsSync(PLUGIN_ROOT)) return []
    return readdirSync(PLUGIN_ROOT)
      .filter((name) => name.endsWith('.js'))
      .map((name) => {
        const stem = basename(name, '.js').trim()
        return { id: toPluginId(stem), file: name }
      })
      .filter((entry) => entry.id)
      .sort((a, b) => a.id.localeCompare(b.id))
  } catch (error) {
    // 目录不可读（权限、挂载异常等）时按无插件处理，不影响内置音源
    console.warn('[MusicFree] 插件目录读取失败，按无插件模式运行:', error?.message || error)
    return []
  }
}

// 仅用于兼容性收敛（避免插件引入服务端不该暴露的模块），不是安全边界：
// vm 上下文内的插件仍可通过宿主对象原型链触达 process 等宿主能力，插件以服务器完整权限运行
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
    clearTimeout,
    // 故意不提供 setInterval/clearInterval：插件可创建永不结束的定时器，
    // 导致内存泄漏；需要轮询的插件应改用 setTimeout + 递归
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

const loadPluginFromCode = (code: string, pluginId: string): any => {
  if (!code || code.length > CODE_LIMIT) throw new Error('插件代码为空或超过大小限制')
  const { module, sandbox } = createSandbox()
  vm.runInContext(code, sandbox, { timeout: 3000, filename: `musicfree-${pluginId}.js` })

  const plugin = module.exports?.default || module.exports
  if (!plugin || typeof plugin !== 'object') throw new Error('插件未导出有效对象')
  return plugin
}

// 将裸插件对象归一化为句柄：platform 缺失时回退到 id，保证显示名总有值
const normalizeHandle = (id: string, instance: any): MusicFreePluginHandle | null => {
  if (!id || !instance || typeof instance !== 'object') return null
  const platform = safeString(instance.platform).trim() || id
  return {
    id,
    platform,
    displayName: platform.replace(/_/g, ' '),
    instance
  }
}

// 按 id 去重：同名（文件名归一化后冲突）只保留首个，避免路由歧义
const dedupHandles = (handles: MusicFreePluginHandle[]): MusicFreePluginHandle[] => {
  const seen = new Set<string>()
  const result: MusicFreePluginHandle[] = []
  for (const handle of handles) {
    if (seen.has(handle.id)) {
      console.warn(`[MusicFree] 检测到重复插件 id "${handle.id}"，已忽略后续加载`)
      continue
    }
    seen.add(handle.id)
    result.push(handle)
  }
  return result
}

// 镜像构建期固化的插件：manifest 被 Nitro 内联进服务端包，是 serverless 环境的唯一可用来源
const loadInlinedBundledPlugins = (): MusicFreePluginHandle[] =>
  (BUNDLED_MUSICFREE_PLUGINS as { id: string; instance: any }[])
    .map((entry) => normalizeHandle(safeString(entry.id), entry.instance))
    .filter((h): h is MusicFreePluginHandle => h !== null)

// 启动期打包产物文件：scripts/build-musicfree-plugins.js 在容器启动时写入，文件名即插件 id
const readBundleFiles = (): string[] => {
  try {
    if (!existsSync(BUNDLES_ROOT)) return []
    return readdirSync(BUNDLES_ROOT).filter((name) => name.endsWith('.mjs')).sort()
  } catch (error) {
    console.warn('[MusicFree] 插件产物目录读取失败，按无产物模式运行:', error?.message || error)
    return []
  }
}

// 启动期生成的打包产物：直接 import 的 ESM 模块，不依赖 node:vm；
// 与本地目录插件并行加载，允许「URL 插件 + 本地插件」共存
const loadGeneratedBundledPlugins = async (): Promise<MusicFreePluginHandle[]> => {
  const files = readBundleFiles()
  if (files.length === 0) return []
  console.info(`[MusicFree] 从 ${BUNDLES_ROOT} 读取到 ${files.length} 个打包产物`)
  const handles: MusicFreePluginHandle[] = []
  for (const file of files) {
    const id = toPluginId(basename(file, '.mjs'))
    if (!id) continue
    try {
      const mod: any = await import(pathToFileURL(join(BUNDLES_ROOT, file)).toString())
      // esbuild 把 CJS 插件导出为 default；取不到时视为无有效插件，不拿模块命名空间冒充分身
      const instance = mod.default
      if (!instance || typeof instance !== 'object') {
        console.warn(`[MusicFree] 打包产物 ${file} 未导出有效对象，已跳过`)
        continue
      }
      const handle = normalizeHandle(id, instance)
      if (handle) {
        handles.push(handle)
        console.info(`[MusicFree] 插件 ${id} 已从打包产物加载`)
      }
    } catch (error) {
      console.warn(`[MusicFree] 打包产物 ${file} 加载失败:`, error)
    }
  }
  return handles
}

// 本地目录插件：musicfree-plugins/ 下的 .js 文件，以 node:vm 加载
const loadPluginsFromDisk = async (): Promise<MusicFreePluginHandle[]> => {
  const files = readPluginFiles()
  if (files.length === 0) {
    console.warn(`[MusicFree] 未从 ${PLUGIN_ROOT} 读取到插件文件`)
    return []
  }
  console.info(`[MusicFree] 从 ${PLUGIN_ROOT} 读取到 ${files.length} 个插件文件`)

  const handles: MusicFreePluginHandle[] = []
  for (const { id, file } of files) {
    try {
      const instance = loadPluginFromCode(readFileSync(join(PLUGIN_ROOT, file), 'utf8'), id)
      const handle = normalizeHandle(id, instance)
      if (handle) {
        handles.push(handle)
        console.info(`[MusicFree] 插件 ${id} 加载成功`)
      }
    } catch (error) {
      console.warn(`[MusicFree] 插件 ${id} 加载失败:`, error)
    }
  }
  return handles
}

// 三个来源合并后按 id 去重，来源顺序即优先级（同 id 只保留首个）：
// 启动期产物（最新） > 镜像构建期固化（serverless 必需） > 本地目录（本地开发/挂载更新）
const loadPlugins = async (): Promise<MusicFreePluginHandle[]> => {
  const generated = await loadGeneratedBundledPlugins()
  const inlined = loadInlinedBundledPlugins()
  const fromDisk = await loadPluginsFromDisk()
  const handles = dedupHandles([...generated, ...inlined, ...fromDisk])
  console.info(
    `[MusicFree] 插件加载完成：共 ${handles.length} 个`
      + `（启动期产物 ${generated.length}、构建期固化 ${inlined.length}、本地目录 ${fromDisk.length}）`
  )
  return handles
}

let pluginsCache: MusicFreePluginHandle[] | null = null
let pluginsLoading: Promise<MusicFreePluginHandle[]> | null = null

// 模块级缓存：避免每次搜索/解析/歌词请求都重新读盘与编译；插件目录或产物变更后需重启服务生效
export const getMusicFreePluginsConfig = async (): Promise<MusicFreePluginHandle[]> => {
  if (pluginsCache) return pluginsCache
  if (pluginsLoading) return pluginsLoading
  pluginsLoading = loadPlugins().then((plugins) => {
    pluginsCache = plugins
    pluginsLoading = null
    return plugins
  })
  return pluginsLoading
}

/**
 * 按 id 精确定位单个实现了指定方法的插件。
 * id 是稳定唯一路由键（musicfree:<文件名>），直接匹配，不回退。
 */
const findHandle = async (method: string, id: string): Promise<MusicFreePluginHandle | null> => {
  const handles = await getMusicFreePluginsConfig()
  return handles.find((h) => h.id === id && typeof h.instance?.[method] === 'function') || null
}

// 全部实现了指定方法的插件（用于聚合搜索与插件列表）
const handlesWith = async (method: string): Promise<MusicFreePluginHandle[]> => {
  const handles = await getMusicFreePluginsConfig()
  return handles.filter((h) => typeof h.instance?.[method] === 'function')
}

// 播放链接/歌词请求里没有 musicFreePlugin 字段时，从 platform 前缀还原插件 id
const itemPluginName = (musicItem: any): string => extractPluginId(musicItem)

export const searchMusicFreePlugins = async (query: string, page = 1, limit = 20, pluginId?: string): Promise<any[]> => {
  const trimmedId = (pluginId || '').trim()
  // 传 pluginId 时只搜该插件（精确路由，不扇出）；缺省时聚合搜索全部插件
  let targets: MusicFreePluginHandle[]
  if (trimmedId) {
    const handle = await findHandle('search', trimmedId)
    targets = handle ? [handle] : []
  } else {
    targets = await handlesWith('search')
  }
  // 单插件已有 MAX_RESULTS_PER_PLUGIN 上限，这里再对聚合结果截断，保证分页语义稳定
  const maxResults = Math.min(Math.max(1, Number(limit) || 20), MAX_AGGREGATE_RESULTS)
  const results: any[] = []
  const errors: string[] = []

  await Promise.all(
    targets.map(async (handle) => {
      try {
        const result = await withTimeout(handle.instance.search(query, page, 'music'), '插件搜索超时')
        for (const item of (Array.isArray(result?.data) ? result.data : []).slice(0, MAX_RESULTS_PER_PLUGIN)) {
          const mapped = mapMusicFreeItem(item, handle)
          if (mapped) results.push(mapped)
        }
      } catch (error: any) {
        errors.push(`${handle.id}: ${error?.message || error}`)
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
  const pluginId = itemPluginName(musicItem)
  if (!pluginId) throw new Error('缺少 MusicFree 插件标识')
  // 精确定位唯一插件，不再遍历全部插件，避免空标识导致出站请求放大
  const handle = await findHandle('getMediaSource', pluginId)
  if (!handle) throw new Error(`未找到 MusicFree 插件: ${pluginId}`)

  const result = await withTimeout(handle.instance.getMediaSource(cloneJson(musicItem), quality), '插件获取播放链接超时')
  const url = safeString(result?.url || musicItem?.url).trim()
  if (!url) throw new Error('MusicFree 插件未返回播放链接')
  return { url, headers: result?.headers && typeof result.headers === 'object' ? result.headers : undefined }
}

export const getMusicFreeLyric = async (musicItem: any): Promise<{ rawLrc?: string; translation?: string } | null> => {
  const pluginId = itemPluginName(musicItem)
  if (!pluginId) return null
  const handle = await findHandle('getLyric', pluginId)
  if (!handle) return null
  try {
    const result = await withTimeout(handle.instance.getLyric(cloneJson(musicItem)), '插件获取歌词超时')
    const rawLrc = safeString(result?.rawLrc || result?.lrc).trim()
    const translation = safeString(result?.translation).trim()
    if (rawLrc || translation) return { rawLrc, translation }
  } catch (error: any) {
    console.warn(`[MusicFree] 插件歌词获取失败 ${handle.id}:`, error?.message || error)
  }
  return null
}

const mapMusicFreeItem = (item: any, handle: MusicFreePluginHandle): any | null => {
  const id = safeString(item?.id).trim()
  const title = safeString(item?.title || item?.song || item?.name).trim()
  const artist = safeString(item?.artist || item?.singer).trim()
  if (!id || !title || !artist) return null

  const duration = Number(item?.duration)
  const platform = `musicfree:${handle.id}`
  return {
    ...cloneJson(item),
    id,
    title,
    artist,
    musicId: id,
    musicPlatform: platform,
    actualMusicPlatform: platform,
    sourceInfo: { source: 'musicfree', plugin: handle.id, platform, fetchedAt: getServerTimestamp() },
    musicFreePlugin: handle.id,
    cover: safeString(item?.artwork || item?.cover || item?.pic || '').trim() || null,
    album: safeString(item?.album).trim() || '',
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    url: safeString(item?.url).trim() || undefined,
    hasUrl: !!safeString(item?.url).trim()
  }
}
