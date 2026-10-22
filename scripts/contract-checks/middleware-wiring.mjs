/**
 * 契约检查 · 中间件接线（R1-3）。
 *
 * `routePermissionMap` 在 S3-B1 落地时只是「声明」：消费它的只有它自己、route-coverage.mjs 与单测，
 * 运行时**零消费方** —— 也就是说「未登记 = 拒绝」当时只是 CI 断言，线上不成立。
 * 本模块把这条接线钉死，防止映射表再次退化成纯声明。
 *
 * A. `server/middleware/**` 必须存在同时消费 `classifyApiRoute` 与 `requirePermission` 的中间件；
 * B. 该中间件必须有对 `unmapped` 的显式分支（默认拒绝是它的核心价值）；
 * C. `/api/open/**` 的判权不得在中间件里重复实现（只允许 api-auth.ts 一处，避免双重判权）；
 * D. `server/api/**` 不得 import `routePermissionMap`：与 kernel-isolation.mjs A 的
 *    「只允许内核公共入口」重复，故不在此重复断言（见模块说明与报告）。
 *
 * 跑器：`node scripts/check-permission-contract.mjs`。
 */

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const ROOT = process.cwd()
const MIDDLEWARE_DIR = path.join(ROOT, 'server', 'middleware')
const SCAN_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.mts', '.cts'])

/** 读 `server/middleware/**` 源码文本（只读文本，不 import —— import 会拉起 Nitro 依赖） */
function readMiddlewareSources() {
  if (!fs.existsSync(MIDDLEWARE_DIR)) return []
  return fs
    .readdirSync(MIDDLEWARE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name)))
    .map((entry) => ({
      file: `server/middleware/${entry.name}`,
      text: fs.readFileSync(path.join(MIDDLEWARE_DIR, entry.name), 'utf8')
    }))
    .sort((a, b) => a.file.localeCompare(b.file))
}

/** 同时消费判定入口与权威 guard 的中间件（无 ⇒ 映射表又退化成纯声明） */
function findWiringMiddleware() {
  return (
    readMiddlewareSources().find(
      (source) =>
        source.text.includes('classifyApiRoute') && source.text.includes('requirePermission')
    ) ?? null
  )
}

function checkMiddlewareConsumesMap() {
  const consumer = findWiringMiddleware()
  assert.ok(
    consumer,
    'server/middleware/** 下没有任何中间件同时消费 classifyApiRoute 与 requirePermission —— ' +
      '映射表又退化成纯声明（CI 断言成立但运行时零消费方，「未登记 = 拒绝」线上不生效）'
  )
}

function checkUnmappedBranchExists() {
  const consumer = findWiringMiddleware()
  assert.ok(consumer, '未找到消费映射表的中间件，无法断言 unmapped 分支')
  assert.ok(
    /\bunmapped\b/.test(consumer.text),
    `${consumer.file} 没有对 'unmapped' 的显式分支 —— 未登记路由会退化成「任何登录用户可访问」`
  )
}

function checkOpenJudgementNotDuplicated() {
  const consumer = findWiringMiddleware()
  assert.ok(consumer, '未找到消费映射表的中间件，无法断言 open 域判权归属')
  assert.equal(
    consumer.text.includes('getRequiredPermission'),
    false,
    `${consumer.file} 出现了 getRequiredPermission：/api/open/** 的判权只允许在 api-auth.ts 实现，` +
      '重复实现会导致双重判权与两套错误语义'
  )
}

export const checks = [
  { name: '中间件接线 A：存在同时消费 classifyApiRoute 与 requirePermission 的中间件', run: checkMiddlewareConsumesMap },
  { name: '中间件接线 B：该中间件有 unmapped 显式分支（默认拒绝）', run: checkUnmappedBranchExists },
  { name: '中间件接线 C：/api/open/** 判权不在中间件重复实现', run: checkOpenJudgementNotDuplicated }
]
