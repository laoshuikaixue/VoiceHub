import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const DB_SYNC = read('../../scripts/db-sync.js')
const MIGRATE = read('../../scripts/migrate-astrbot-bindings.ts')
const SCHEDULE = read('../../server/api/bot/voicehub/weekly-schedule.get.ts')
const PUBLIC_SCHEDULE = read('../../server/api/songs/public.get.ts')
const ERROR_HANDLER = read('../../server/plugins/error-handler.ts')
const GROUP_SERVICE = read('../../server/services/astrbotGroupService.ts')
const OUTBOX = read('../../server/services/astrbotOutboxService.ts')
const ERROR_TELEMETRY = read('../../server/utils/astrbot-error-telemetry.ts')

// ── 上游审查：部署回填须兼容缺少 astrbotBoundAt 的旧库 ────────────────

test('部署回填不把 astrbotBoundAt 当作必需列', () => {
  const hasLegacy = DB_SYNC.match(/const hasLegacyBindings =([\s\S]*?)\n\s*const /)
  assert.ok(hasLegacy, '应能找到旧绑定列判定')
  assert.ok(
    !/astrbotBoundAt/.test(hasLegacy[1]),
    'astrbotBoundAt 缺失不应导致旧绑定被跳过，否则升级后丢绑定'
  )
  assert.match(hasLegacy[1], /astrbotUmo/, '仍须要求 astrbotUmo')
  assert.match(hasLegacy[1], /astrbotPlatform/, '仍须要求 astrbotPlatform')
  // 该列的有无仍须被探测，供回填回退使用
  assert.match(DB_SYNC, /hasBoundAtColumn = await columnExists\(sql, 'User', 'astrbotBoundAt'\)/)
})

test('回填插入对缺失 astrbotBoundAt 的库回退 now()', () => {
  // 独立脚本已是这个语义，保留作为参照基线
  assert.match(MIGRATE, /COALESCE\("astrbotBoundAt", now\(\)\)/)
  assert.match(MIGRATE, /: await tx`SELECT[\s\S]*?now\(\) AS bound_at/, '独立脚本应有无该列的分支')
  // 部署脚本也必须能回退，不能只在有列时才搬迁
  assert.ok(
    /hasBoundAtColumn|astrbotBoundAt/.test(DB_SYNC),
    '部署脚本应显式处理 astrbotBoundAt 的有无'
  )
})

// ── 上游审查：机器人响应不得泄露年级/班级 ────────────────────────────

test('机器人本周歌单端点不返回年级与班级', () => {
  assert.ok(
    !/requesterGrade/.test(SCHEDULE.split('const scheduleItems')[1]?.split('const displayConfig')[0] ?? ''),
    'scheduleItems 不得包含 requesterGrade'
  )
  assert.ok(
    !/requesterClass/.test(SCHEDULE.split('const scheduleItems')[1]?.split('const displayConfig')[0] ?? ''),
    'scheduleItems 不得包含 requesterClass'
  )
  assert.ok(!/requesterGrade:/.test(SCHEDULE), '不得在响应中带出 requesterGrade')
  assert.ok(!/requesterClass:/.test(SCHEDULE), '不得在响应中带出 requesterClass')
})

test('机器人端点遵循站点 hideStudentInfo 策略（与公开排期一致）', () => {
  assert.match(PUBLIC_SCHEDULE, /hideStudentInfo/, '公开排期端点应读取该策略')
  assert.match(SCHEDULE, /hideStudentInfo/, '机器人端点同样应读取该策略')
  assert.match(SCHEDULE, /maskScheduleItemsInfo|maskSongInfo/, '机器人端点应对投稿人姓名应用脱敏')
})

// ── 上游审查：群聊异常通知必须脱敏、限长 ─────────────────────────────

test('异常上报到群聊前统一脱敏并截断', () => {
  assert.ok(
    !/reportSystemError\('未捕获异常', error\?\.message \|\| String\(error\)\)/.test(ERROR_HANDLER),
    '不得把未处理的原始 message 直接入群事件'
  )
  assert.match(ERROR_HANDLER, /astrbot-error-telemetry|sanitizeAstrbotErrorDetail/,
    '应通过统一的脱敏工具处理后再上报')
  assert.match(ERROR_HANDLER, /reportSystemError\('未捕获异常',\s*sanitizeAstrbotErrorDetail/,
    '未捕获异常须先脱敏再上报')
})

test('脱敏工具屏蔽凭据样式的内容并限制长度', async () => {
  const { sanitizeAstrbotErrorDetail, ASTRBOT_ERROR_DETAIL_MAX_CHARS } = await import(
    '../../server/utils/astrbot-error-telemetry.ts'
  )

  assert.ok(ASTRBOT_ERROR_DETAIL_MAX_CHARS > 0 && ASTRBOT_ERROR_DETAIL_MAX_CHARS <= 500,
    '异常摘要长度上限应存在且足够短')

  // 连接串与密码不得原样留在摘要里
  const withDsn = sanitizeAstrbotErrorDetail('connect failed postgres://user:s3cret@db.internal:5432/voicehub')
  assert.ok(!withDsn.includes('s3cret'), `口令泄露：${withDsn}`)
  assert.ok(!/postgres:\/\/[^\s]*:[^\s@]*@/.test(withDsn), `连接串未脱敏：${withDsn}`)

  const withKey = sanitizeAstrbotErrorDetail('Authorization: Bearer abcdef1234567890')
  assert.ok(!withKey.includes('abcdef1234567890'), `令牌泄露：${withKey}`)
  assert.ok(!/Bearer\s+abcdef/i.test(sanitizeAstrbotErrorDetail('token=Bearer abcdef1234567890')),
    '方案前缀令牌在键值对之前就要被屏蔽')

  // 长度截断
  const long = sanitizeAstrbotErrorDetail('x'.repeat(5000))
  assert.ok(long.length <= ASTRBOT_ERROR_DETAIL_MAX_CHARS, `未截断：${long.length}`)

  // 普通消息保留可读摘要
  assert.match(sanitizeAstrbotErrorDetail('ECONNRESET'), /ECONNRESET/)
  assert.equal(sanitizeAstrbotErrorDetail(''), '未知错误')
})

test('异常上报入口都经过脱敏（拒绝值、未捕获异常与群事件）', () => {
  assert.match(ERROR_HANDLER, /sanitizeAstrbotErrorDetail\(rejectionDetail\)|sanitizeAstrbotErrorDetail\(reason/,
    '未处理拒绝也须脱敏')
  assert.match(GROUP_SERVICE, /sanitizeAstrbotErrorDetail/, '群事件服务须在入队前脱敏')
})

// ── 上游审查：入队不得静默丢弃超限目标 ──────────────────────────────

test('字节切分结果被完整入队且不再出现整批早退', () => {
  assert.match(OUTBOX, /chunkAstrbotTargets/, '私聊入队应按字节预算切分')
  assert.match(GROUP_SERVICE, /chunkAstrbotTargets/, '群事件入队应按字节预算切分')
  assert.ok(
    !/if \(!fitsAstrbotPayload\(fresh, title, content, true\)\)/.test(GROUP_SERVICE),
    '不得再有整批预算失败即提前返回'
  )
  // 拆出的分块必须全部插入
  assert.match(GROUP_SERVICE, /insert\(astrbotOutbox\)\.values\(chunks\.map/,
    '切分后的每一块都要入队')
  assert.match(OUTBOX, /const rowsToInsert[\s\S]*?chunks\.map/, '私聊同样按分块入队')
})
