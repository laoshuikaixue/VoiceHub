#!/usr/bin/env node
// server 目录不在任何 tsconfig include 中，引用不存在的字段/方法（db.$transaction、
// users.lastLoginAt 之类）只有运行时才暴露。本脚本借 Nuxt 生成的服务端 tsconfig，
// 只把"成员/模块/参数不匹配"这一族错误当作构建闸门，其余历史错误不纳入。
// 用法：pnpm typecheck:server（需先有 .nuxt/tsconfig.server.json，由 nuxt prepare 生成）

import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const TSCONFIG = '.nuxt/tsconfig.server.json'
const TSC = resolve('node_modules/typescript/bin/tsc')

// 纳入闸门的错误码：属性不存在且给出建议 / 对象字面量未知属性 / 实参数量不符 /
// 模块无此导出 / 找不到模块
const GATED_CODES = new Set(['2551', '2561', '2554', '2305', '2307'])

// 已知且暂无法在仓库内消除的条目（文件 + 错误码 + 出现次数），新增或超出即失败。
const BASELINE = {
  'server/api/notifications/settings.post.ts|TS2307': 1,
  'server/utils/music-source-plugins/network.ts|TS2554': 1,
  'server/utils/qq_music_sdk.ts|TS2554': 1
}

if (!existsSync(TSCONFIG)) {
  console.error(`❌ 缺少 ${TSCONFIG}，请用 pnpm typecheck:server 执行（会先 nuxt prepare）`)
  process.exit(1)
}

// include 必须覆盖 server 目录，否则 tsc 查的是空项目，闸门形同虚设
if (!readFileSync(TSCONFIG, 'utf8').includes('../server/')) {
  console.error(`❌ ${TSCONFIG} 的 include 未覆盖 server 目录，请重新 nuxt prepare`)
  process.exit(1)
}

const tsc = spawnSync(process.execPath, [TSC, '-p', TSCONFIG, '--noEmit'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
})

if (tsc.error || tsc.signal) {
  console.error('❌ tsc 进程未能正常结束：', tsc.error?.message ?? `signal=${tsc.signal}`)
  process.exit(1)
}

const output = `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`
const counts = new Map()
let total = 0

for (const line of output.split('\n')) {
  const matched = /^(.+?)\(\d+,\d+\): error TS(\d+):/.exec(line)
  if (!matched) continue
  total++
  const [, file, code] = matched
  if (!GATED_CODES.has(code)) continue
  const key = `${file}|TS${code}`
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

// 退出码随 tsc 版本/配置含义不一（本项目当前有诊断为 2），一律以能否解析出错误为准；
// 报错了却解析不出任何条目，说明输出格式与正则不符或 tsc 提前中止，放行等于闸门失效
if (total === 0 && (tsc.status !== 0 || output.includes('error TS'))) {
  console.error('❌ tsc 未正常产出可解析的错误列表（status=' + tsc.status + '），请检查下方输出')
  console.error(output.trim().slice(0, 4000) || '(空输出)')
  process.exit(1)
}

const failures = []
for (const [key, count] of counts) {
  const allowed = BASELINE[key] ?? 0
  if (count > allowed) failures.push(`${key}: ${count} 处（白名单 ${allowed} 处）`)
}

const obsolete = Object.keys(BASELINE).filter((key) => !counts.has(key))
if (obsolete.length) {
  console.log(`提示：以下白名单条目已无对应错误，可删除：\n  ${obsolete.join('\n  ')}`)
}

if (failures.length) {
  const failingKeys = new Set(failures.map((failure) => failure.split(':')[0]))
  console.error('❌ 服务端类型检查发现引用不存在的成员/模块：')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('\n完整错误原文：')
  for (const line of output.split('\n')) {
    const matched = /^(.+?)\(\d+,\d+\): error TS(\d+):/.exec(line)
    if (matched && failingKeys.has(`${matched[1]}|TS${matched[2]}`)) console.error(`  ${line.trim()}`)
  }
  process.exit(1)
}

console.log(`✅ 服务端类型检查通过（总错误 ${total} 条，闸门族 ${[...counts.values()].reduce((a, b) => a + b, 0)} 条均在白名单内）`)
