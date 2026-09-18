#!/usr/bin/env node

import fs from 'fs'
import { execSync } from 'child_process'

const isCI = process.env.CI || process.env.NETLIFY || process.env.VERCEL

// 插件部署快照是构建产物且不纳入版本控制，缺失时补一个常驻模式默认值，保证 nuxt prepare 与类型检查可用
const snapshotFile = 'server/utils/music-source-plugins/manifest.snapshot.ts'
const snapshotStub = `import type { PluginManifest } from './types'\n\n// 由 scripts/build-music-source-plugins.ts 覆盖生成，请勿手工编辑。\nexport const pluginManifest: PluginManifest = { mode: 'hot', buildId: 'development', prelude: '', artifacts: [] }\n`
try {
  if (fs.existsSync('server/utils/music-source-plugins') && !fs.existsSync(snapshotFile)) {
    fs.writeFileSync(snapshotFile, snapshotStub)
  }
} catch (error) {
  console.warn('⚠️  插件部署快照默认值写入失败:', error.message)
}

if (isCI) {
  console.log('🔧 CI 环境检测，跳过将在正式构建中重复执行的 nuxt prepare')

  try {
    if (fs.existsSync('drizzle.config.ts') && fs.existsSync('app/drizzle/schema.ts')) {
      console.log('✅ Drizzle 配置正常')
    } else {
      console.warn('⚠️  Drizzle 配置不完整')
    }
  } catch (error) {
    console.error('❌ 配置检查失败:', error.message)
  }
} else {
  console.log('📝 本地开发环境，准备 Nuxt 类型和配置')
  execSync('nuxt prepare', { stdio: 'inherit' })
}
