import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 匿名取链限流边界：只约束未登录请求，且不改变前端登录态复验判定
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const RESOLVE_URL = read('../../server/api/music/resolve-url.post.ts')
const MUSIC_URL = read('../../app/utils/musicUrl.ts')

test('限流仅作用于匿名请求且在解析工作之前', () => {
  assert.match(RESOLVE_URL, /const ANONYMOUS_RESOLVE_LIMIT = 10/, '匿名阈值应为每分钟 10 次')
  assert.match(RESOLVE_URL, /const ANONYMOUS_RESOLVE_WINDOW_MS = 60 \* 1000/)
  const handlerHead = RESOLVE_URL.match(
    /export default defineEventHandler[\s\S]*?const body = await readBody/
  )?.[0]
  assert.ok(handlerHead, '限流应位于读取请求体之前')
  assert.match(handlerHead, /if \(!event\.context\.user\) \{/)
  assert.match(handlerHead, /checkDistributedRateLimit\(/)
  assert.match(handlerHead, /music_resolve_url_ip:\$\{getClientIP\(event\)\}/, '限流键须按来源 IP 区分')
})

test('超限返回可本地化的 429', () => {
  const block = RESOLVE_URL.match(/if \(!event\.context\.user\) \{[\s\S]*?\n {2}\}/)?.[0] ?? ''
  assert.match(block, /429/)
  assert.match(block, /SERVER_ERROR_CODES\.AUTH_RATE_LIMITED_SECONDS/)
  assert.match(block, /\{ params: \[waitSeconds\] \}/, '动态等待秒数需通过 params 交给词典占位符')
})

test('被限流不得清除本地 QQ 登录态', () => {
  const branch = MUSIC_URL.match(/if \(qqMusicCookie && isQqVip[\s\S]*?\n {4}\}/)?.[0] ?? ''
  assert.ok(branch, '未找到官方链路降级分支')
  assert.match(branch, /status !== 429/)
  assert.match(branch, /await revalidateQqLoginAfterFailure\(\)/)
})
