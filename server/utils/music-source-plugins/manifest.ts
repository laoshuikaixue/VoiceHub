import type { PluginManifest } from './types'

// 构建脚本生成受限解释器使用的数据；第三方脚本不作为宿主模块执行。
export const pluginManifest: PluginManifest = { mode: 'hot', buildId: 'development', prelude: '', artifacts: [] }
