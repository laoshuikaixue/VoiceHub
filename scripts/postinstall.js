#!/usr/bin/env node

import fs from 'fs'
import { execSync } from 'child_process'

const isCI = process.env.CI || process.env.NETLIFY || process.env.VERCEL

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
