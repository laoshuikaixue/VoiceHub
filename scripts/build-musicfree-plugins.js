#!/usr/bin/env node

/**
 * 构建期 MusicFree 插件打包
 *
 * 从 MUSICFREE_PLUGIN_ZIP_URL 指向的 zip 下载插件源码，用 esbuild 打成 ESM 模块。
 * 产物有两个消费时机，二者都直接 import 执行，不经过 node:vm 沙箱：
 * - 镜像/应用构建期：manifest 被 Nitro 内联进服务端包，可在 serverless 环境运行
 * - 容器启动期：Dockerfile 启动命令重跑本脚本，server/utils/musicfree.ts 动态 import 目录内的 *.mjs
 *
 * 失败策略：
 * - 未配置 URL → 生成空清单，退出 0（不干扰无插件用户与 CI）
 * - 已配置 URL 但下载/解压/构建失败 → 非零退出。静默降级会出货"以为有插件"的坏产物
 */

import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import esbuild from 'esbuild'

config({ path: path.resolve(process.cwd(), '.env'), quiet: true })

const ROOT = path.resolve(process.cwd())
const ZIP_URL = (process.env.MUSICFREE_PLUGIN_ZIP_URL || '').trim()
const STAGING_DIR = path.join(ROOT, '.mf-staging')
const GENERATED_DIR = path.join(ROOT, 'server', 'utils', 'musicfree-bundles')
const MANIFEST = path.join(GENERATED_DIR, 'manifest.ts')

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ZIP_BYTES = 60 * 1024 * 1024
const MAX_FILES = 30
const DOWNLOAD_TIMEOUT_MS = 120000

// 插件源码可直接引入的 npm 包，与运行时白名单保持一致
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

// 与 server/utils/musicfree.ts 的 toPluginId 规则一致，保证磁盘/打包两路径 id 相同
const toPluginId = (stem) => stem.replace(/[^\w\u4e00-\u9fa5-]/g, '_').replace(/^_+|_+$/g, '')

const log = (message) => console.log(`[MusicFree 插件构建] ${message}`)
// process.exit 不会执行 finally 块，所以用抛错代替直接退出，保证 staging 能被清理
const FAILED = Symbol('musicfree-build-failed')
const fail = (message) => {
  console.error(`[MusicFree 插件构建] ❌ ${message}`)
  const error = new Error(message)
  error[FAILED] = true
  throw error
}

// zip-slip 防护：拒绝绝对路径与 .. 逃逸
const safeJoin = (base, entryName) => {
  const normalized = entryName.replace(/\\/g, '/')
  if (normalized.startsWith('/') || normalized.startsWith('..')) return null
  const target = path.join(base, normalized)
  return target.startsWith(base + path.sep) ? target : null
}

// 从导出对象中提取 platform 声明，用于日志与清单
// 插件源码中间可能有同名局部配置（如 platform: "WebFilter"），必须限定在 module.exports 之后
const extractPlatform = (code) => {
  let scope = code
  for (const marker of ['module.exports', 'export default', 'exports.default']) {
    const index = code.lastIndexOf(marker)
    if (index >= 0) {
      scope = code.slice(index)
      break
    }
  }
  const matches = [...scope.matchAll(/platform\s*:\s*(['"])([^'"]+)\1/g)]
  return matches.length === 0 ? '' : matches[matches.length - 1][2].trim()
}

const writeIfChanged = (file, content) => {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false
  fs.writeFileSync(file, content, 'utf8')
  return true
}

// 生成插件清单模块：被 musicfree.ts 静态 import，esbuild 会打进服务端产物
const writeManifest = (built) => {
  fs.mkdirSync(GENERATED_DIR, { recursive: true })
  const header =
    '// 由 scripts/build-musicfree-plugins.js 自动生成，请勿手工编辑\n' +
    '// 运行时直接 import 这些插件模块，不经过 node:vm 沙箱\n\n'
  const content =
    built.length === 0
      ? `${header}export const BUNDLED_MUSICFREE_PLUGINS = []\n`
      : `${header}${built.map((p, index) => `import plugin${index} from './${p.file}'`).join('\n')}\n\nexport const BUNDLED_MUSICFREE_PLUGINS = [\n${built
          .map((p, index) => `  { id: ${JSON.stringify(p.id)}, instance: plugin${index} },`)
          .join('\n')}\n]\n`
  log(`清单${writeIfChanged(MANIFEST, content) ? '已更新' : '无变化'}：${built.length} 个插件`)
}

// 只拦截"从插件源码出发"的裸导入；依赖包内部的 Node 内置模块照常放行
const whitelistPlugin = (entries) => ({
  name: 'musicfree-whitelist',
  setup(build) {
    const entrySet = new Set(entries)
    build.onResolve({ filter: /.*/ }, (args) => {
      const fromEntry = entrySet.has(args.importer) || args.importer_kind === 'entry-point'
      if (!fromEntry || args.importer === args.path) return undefined
      if (ALLOWED_MODULES.has(args.path)) return undefined
      return { errors: [{ text: `MusicFree 插件禁止直接引入模块: ${args.path}` }] }
    })
  }
})

// 注入的 env：cookie 等登录态由插件源码自行携带（公用音源），getUserVariables 返回空对象以保持协议兼容
// require 锚定到进程工作目录而非 import.meta.url：Nitro 把 import.meta.url 重写为 file:///_entry.js，
// 插件内联进服务端包后 createRequire 会解析不到 axios 等依赖
const buildBanner = () =>
  `import {createRequire as __mfCr} from 'node:module';`
  + `import {pathToFileURL as __mfU} from 'node:url';`
  + `const require=__mfCr(__mfU(process.cwd()+'/package.json').toString());`
  + `var env={getUserVariables:()=>({}),os:'linux',appVersion:'1.6.0',lang:'zh-CN'}`

const buildPlugin = async (source, pluginId) => {
  // 文件名即插件 id（与清单 id 同规则）：运行时按文件名反解 id，无需解析 manifest
  const slug = toPluginId(pluginId)
  const outFile = path.join(GENERATED_DIR, `${slug}.mjs`)
  await esbuild.build({
    entryPoints: [source],
    format: 'esm',
    platform: 'node',
    bundle: true,
    minify: true,
    outfile: outFile,
    logLevel: 'warning',
    banner: { js: buildBanner() },
    plugins: [whitelistPlugin([source])]
  })
  return outFile
}

const main = async () => {
  if (!ZIP_URL) {
    // 同步清掉上一次的产物：运行时是动态 import 目录内的 *.mjs，遗留文件会加载成孤儿插件
    fs.mkdirSync(GENERATED_DIR, { recursive: true })
    for (const file of fs.readdirSync(GENERATED_DIR)) {
      if (file.endsWith('.mjs')) fs.rmSync(path.join(GENERATED_DIR, file), { force: true })
    }
    writeManifest([])
    log('未配置 MUSICFREE_PLUGIN_ZIP_URL，生成空清单并清理旧产物（运行时回退到本地插件目录）')
    return
  }

  let zipBuffer
  try {
    const response = await fetch(ZIP_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    if (!response.ok) fail(`下载失败：HTTP ${response.status}`)
    zipBuffer = Buffer.from(await response.arrayBuffer())
    if (zipBuffer.byteLength > MAX_ZIP_BYTES) fail(`zip 体积超限（${zipBuffer.byteLength} 字节）`)
    log(`已下载 zip（${zipBuffer.byteLength} 字节）`)
  } catch (error) {
    fail(`下载 zip 失败：${error?.message || error}`)
  }

  let pluginEntries
  let ignoredFiles
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(zipBuffer)
    const files = Object.values(zip.files)
    pluginEntries = files
      .filter((entry) => !entry.dir && /\.js$/i.test(entry.name))
      .map((entry) => ({ name: entry.name, entry }))
    ignoredFiles = files.filter((entry) => !entry.dir && !/\.js$/i.test(entry.name)).map((entry) => entry.name)
  } catch (error) {
    fail(`解压 zip 失败：${error?.message || error}`)
  }

  if (pluginEntries.length === 0) fail('zip 内未找到任何 .js 插件文件')
  if (pluginEntries.length > MAX_FILES) fail(`插件数量超限（${pluginEntries.length} 个）`)
  if (ignoredFiles.length > 0) {
    log(
      `已忽略 zip 内非插件文件：${ignoredFiles.slice(0, 5).join(', ')}${
        ignoredFiles.length > 5 ? ` 等 ${ignoredFiles.length} 个` : ''
      }`
    )
  }

  fs.rmSync(STAGING_DIR, { recursive: true, force: true })
  fs.mkdirSync(STAGING_DIR, { recursive: true })
  fs.mkdirSync(GENERATED_DIR, { recursive: true })
  // 项目根 package.json 声明 type=module，必须声明 commonjs，否则 esbuild 把插件当 ESM 输入
  fs.writeFileSync(path.join(STAGING_DIR, 'package.json'), '{ "type": "commonjs" }\n', 'utf8')

  try {
    const built = []
    for (const { name, entry } of pluginEntries) {
      const target = safeJoin(STAGING_DIR, name)
      if (!target) fail(`zip 内存在非法路径：${name}`)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      const data = Buffer.from(await entry.async('nodebuffer'))
      if (data.byteLength > MAX_FILE_BYTES) fail(`插件体积超限：${name}`)
      fs.writeFileSync(target, data)

      const stem = path.basename(name, path.extname(name))
      const platform = extractPlatform(data.toString('utf8'))
      try {
        const outFile = await buildPlugin(target, stem)
        built.push({ file: path.basename(outFile), id: toPluginId(stem), platform })
        log(`已构建 ${name}${platform ? `（platform: ${platform}）` : ''}`)
      } catch (error) {
        fail(`插件构建失败：${name}\n${error?.message || error}`)
      }
    }

    writeManifest(built)
    log(`完成，共 ${built.length} 个插件`)
  } finally {
    // 构建失败也要清理，否则会残留插件源码
    fs.rmSync(STAGING_DIR, { recursive: true, force: true })
  }
}

main().catch((error) => {
  if (!error?.[FAILED]) console.error(`[MusicFree 插件构建] ❌ ${error?.message || error}`)
  process.exitCode = 1
})
