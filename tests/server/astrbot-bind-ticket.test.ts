import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { astrbotBindTickets } from '../../app/drizzle/schema.ts'
import {
  ASTRBOT_BIND_TICKET_TTL_SECONDS,
  createAstrbotBindTicket,
  hashAstrbotBindTicket
} from '../../server/utils/astrbot-notification.ts'

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const issueLink = source('server/api/bot/voicehub/bind-link.post.ts')
const preview = source('server/api/notifications/astrbot/bind-ticket.get.ts')
const confirm = source('server/api/notifications/astrbot/bind-ticket.post.ts')
const page = source('app/pages/bind/[token].vue')

test('绑定票据只存摘要，票据原文长度足以抗枚举', () => {
  const ticket = createAstrbotBindTicket()
  assert.match(ticket, /^[a-f0-9]{48}$/)
  assert.equal(hashAstrbotBindTicket(ticket), hashAstrbotBindTicket(ticket))
  assert.notEqual(hashAstrbotBindTicket(ticket), ticket)
  assert.ok(ASTRBOT_BIND_TICKET_TTL_SECONDS > 0 && ASTRBOT_BIND_TICKET_TTL_SECONDS <= 900)
})

test('票据表以 tokenHash 为主键并带过期索引，不存票据原文', () => {
  const config = getTableConfig(astrbotBindTickets)
  const columnNames = config.columns.map((column) => column.name)
  assert.ok(columnNames.includes('tokenHash'))
  assert.equal(
    columnNames.some((name) => name === 'token'),
    false,
    '不得存票据原文'
  )
  assert.deepEqual(columnNames.includes('consumedByUserId'), true, '幂等需要记录确认账号')
  const tokenHash = config.columns.find((column) => column.name === 'tokenHash')
  assert.equal(tokenHash?.primary, true, 'tokenHash 必须是主键')
  assert.equal(tokenHash?.notNull, true)
  assert.deepEqual(
    config.indexes.map((index) => index.config.name),
    ['AstrbotBindTicket_expires_idx']
  )
})

test('获取绑定链接：机器人令牌鉴权、校验私聊会话与平台开关，只返回链接不落库绑定', () => {
  assert.match(issueLink, /ASTRBOT_TOKEN_HEADER/)
  assert.match(issueLink, /equalAstrbotToken/)
  assert.match(issueLink, /parseAstrbotPrivateUmo/)
  assert.match(issueLink, /isAstrbotPlatformEnabled/)
  assert.match(issueLink, /insert\(astrbotBindTickets\)/)
  assert.match(issueLink, /hashAstrbotBindTicket\(ticket\)/)
  assert.match(issueLink, /\/bind\/\$\{ticket\}/)
  // 发链接阶段绝不能写绑定表：绑定只能由用户在浏览器确认后落库。
  assert.doesNotMatch(issueLink, /astrbotBindings/)
})

test('链接预览是只读的：GET 不得出现任何写操作', () => {
  assert.doesNotMatch(preview, /\.insert\(/)
  assert.doesNotMatch(preview, /\.update\(/)
  assert.doesNotMatch(preview, /\.delete\(/)
  assert.match(preview, /confirmedByMe/)
  assert.match(preview, /available/)
})

test('确认绑定：登录态 + POST、原子消费票据、行锁与归属冲突、同账号重复确认幂等', () => {
  assert.match(confirm, /event\.context\.user/)
  assert.match(confirm, /readBody\(event\)/)
  assert.match(confirm, /for\('update'\)/)
  assert.match(confirm, /isNull\(astrbotBindTickets\.consumedAt\)/)
  assert.match(confirm, /gt\(astrbotBindTickets\.expiresAt/)
  assert.match(confirm, /consumedByUserId: user\.id/)
  // 同账号重复确认返回成功，而不是"链接已使用"。
  assert.match(confirm, /row\.consumedByUserId === user\.id[\s\S]{0,200}return \{ success: true/)
  assert.match(confirm, /ASTRBOT_UMO_BOUND/)
  assert.match(confirm, /onConflictDoUpdate/)
  assert.match(confirm, /adapterToAstrbotPlatform\(row\.adapter\) !== row\.platform/)
})

test('页面只在用户点击后发 POST 确认，GET 预览不改状态', () => {
  assert.match(page, /method: 'POST'/)
  assert.match(page, /'\/api\/notifications\/astrbot\/bind-ticket'/)
  // 预览请求不得带 method，必须落在 GET 上。
  const previewBlock = page.slice(
    page.indexOf('const loadPreview'),
    page.indexOf('const confirm =')
  )
  assert.match(previewBlock, /query: \{ token: token\.value \}/)
  assert.doesNotMatch(previewBlock, /method:/)
})
