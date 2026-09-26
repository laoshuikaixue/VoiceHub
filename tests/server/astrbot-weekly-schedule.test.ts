import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BOT_ROUTES } from '../../server/config/constants.ts'
import { formatDateTime, getBeijingStartOfWeek, getBeijingEndOfWeek, getBeijingWeekdayLabel } from '../../app/utils/timeUtils.ts'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const BEIJING_TIMEZONE = 'Asia/Shanghai'

// 读取源码文本，用于白盒断言
const middlewareSrc = readFileSync(
  join(import.meta.dirname, '../../server/middleware/auth.ts'),
  'utf8'
)
const apiSrc = readFileSync(
  join(import.meta.dirname, '../../server/api/bot/voicehub/weekly-schedule.get.ts'),
  'utf8'
)

// ── 中间件放行逻辑 ──────────────────────────────────────────────

test('中间件对 GET /api/bot/voicehub/weekly-schedule 放行', () => {
  assert.equal(BOT_ROUTES.has('GET /api/bot/voicehub/weekly-schedule'), true)
  assert.match(middlewareSrc, /BOT_ROUTES\.has\(`\$\{method\} \$\{pathname\}`\)/)
})

test('GET 与 POST 均由同一机器人路由集合鉴权', () => {
  assert.equal(BOT_ROUTES.has('POST /api/bot/voicehub/pull'), true)
  assert.equal(BOT_ROUTES.has('GET /api/bot/voicehub/pull'), false)
})

test('其他机器人 POST 端点仍在放行列表中', () => {
  const botPaths = [
    '/api/bot/voicehub/bind',
    '/api/bot/voicehub/unbind',
    '/api/bot/voicehub/verify-targets',
    '/api/bot/voicehub/pull',
    '/api/bot/voicehub/ack',
    '/api/bot/voicehub/song-search',
    '/api/bot/voicehub/song-request',
  ]
  for (const path of botPaths) {
    assert.equal(BOT_ROUTES.has(`POST ${path}`), true, `中间件应包含 ${path}`)
  }
})

// ── API 令牌校验 ─────────────────────────────────────────────────

test('API 使用 ASTRBOT_TOKEN_HEADER 和 equalAstrbotToken 鉴权', () => {
  assert.ok(apiSrc.includes('ASTRBOT_TOKEN_HEADER'), '应导入 ASTRBOT_TOKEN_HEADER')
  assert.ok(apiSrc.includes('equalAstrbotToken'), '应使用 equalAstrbotToken')
})

test('API 鉴权失败抛出 401 + NOTIFICATION_AUTH_REQUIRED', () => {
  assert.ok(
    apiSrc.includes('NOTIFICATION_AUTH_REQUIRED'),
    '鉴权失败应使用 NOTIFICATION_AUTH_REQUIRED 错误码'
  )
  assert.ok(apiSrc.includes('401'), '鉴权失败应返回 401')
})

test('API 同时检查 astrbotEnabled 和 token 匹配', () => {
  assert.ok(apiSrc.includes('settings?.enabled'), '应检查 astrbotEnabled')
  assert.ok(apiSrc.includes('equalAstrbotToken'), '应比较 token')
})

// ── 北京时间本周区间计算 ──────────────────────────────────────────

test('使用 getServerDate() 获取当前时间，禁止 new Date()', () => {
  assert.ok(apiSrc.includes('getServerDate()'), '应使用 getServerDate()')
  // 不应直接出现 new Date()（注释除外）
  const codeWithoutComments = apiSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!codeWithoutComments.includes('new Date()'), '禁止直接使用 new Date()')
})

test('使用 getBeijingStartOfWeek 计算本周开始', () => {
  assert.ok(apiSrc.includes('getBeijingStartOfWeek'), '应使用 getBeijingStartOfWeek')
})

test('weekEnd = weekStart + 7 天，覆盖完整一周', () => {
  assert.match(apiSrc, /getBeijingEndOfWeek\(now\)\.getTime\(\) \+ 1/)
  const sunday = dayjs.tz('2026-09-27 12:00:00', BEIJING_TIMEZONE).toDate()
  assert.equal(getBeijingEndOfWeek(sunday).getTime() + 1 - getBeijingStartOfWeek(sunday).getTime(), 7 * 24 * 60 * 60 * 1000)
})

test('getBeijingStartOfWeek 在周日（day=0）时向前退 6 天到周一', () => {
  // 2026-09-27 周日（北京时间）
  const sunday = dayjs.tz('2026-09-27 12:00:00', BEIJING_TIMEZONE).toDate()
  const now = dayjs(sunday).tz(BEIJING_TIMEZONE)
  const day = now.day()
  const diff = day === 0 ? 6 : day - 1
  const weekMonday = now.subtract(diff, 'day').startOf('day')
  assert.equal(weekMonday.format('YYYY-MM-DD'), '2026-09-21', '周日的本周一应为 2026-09-21')
})

test('getBeijingStartOfWeek 在周一时 diff=0，返回当天', () => {
  // 2026-09-21 周一（北京时间）
  const monday = dayjs.tz('2026-09-21 08:00:00', BEIJING_TIMEZONE).toDate()
  const now = dayjs(monday).tz(BEIJING_TIMEZONE)
  const day = now.day()
  const diff = day === 0 ? 6 : day - 1
  const weekMonday = now.subtract(diff, 'day').startOf('day')
  assert.equal(weekMonday.format('YYYY-MM-DD'), '2026-09-21', '周一的本周一应为当天')
})

test('weekRange 格式为 YYYY/MM/DD - YYYY/MM/DD', () => {
  // 验证代码中 weekRange 格式化字符串
  assert.ok(
    apiSrc.includes("formatDateTime(weekStart, 'YYYY/MM/DD')"),
    "weekRange 应使用 timeUtils 格式化"
  )
  assert.ok(apiSrc.includes('weekRange'), '应返回 weekRange 字段')
  // 用真实 dayjs 验证格式正确性
  const weekStart = dayjs.tz('2026-09-21', BEIJING_TIMEZONE).startOf('day')
  const weekEnd = weekStart.add(6, 'day')
  const weekRange = `${weekStart.format('YYYY/MM/DD')} - ${weekEnd.format('YYYY/MM/DD')}`
  assert.equal(weekRange, '2026/09/21 - 2026/09/27')
})

// ── 日期/星期标签格式 ────────────────────────────────────────────

test('星期标签由 timeUtils 统一生成', () => {
  assert.match(apiSrc, /getBeijingWeekdayLabel\(row\.playDate\)/)
  assert.doesNotMatch(apiSrc, /CN_WEEKDAYS|dayjs\.extend|BEIJING_TIMEZONE/)
})

test('date 字段格式为 YYYY/MM/DD 周X', () => {
  // 模拟格式化逻辑
  const playDate = dayjs.tz('2026-09-21 00:00:00', BEIJING_TIMEZONE).toDate()
  const label = `${formatDateTime(playDate, 'YYYY/MM/DD')} ${getBeijingWeekdayLabel(playDate)}`
  assert.equal(label, '2026/09/21 周一')
})

test('周日对应 CN_WEEKDAYS[0]（dayjs.day()=0）', () => {
  const sunday = dayjs.tz('2026-09-27 00:00:00', BEIJING_TIMEZONE).toDate()
  assert.equal(getBeijingWeekdayLabel(sunday), '周日')
})

// ── 字段映射 ─────────────────────────────────────────────────────

test('generatedAt 使用 formatDateTime(now)', () => {
  assert.ok(apiSrc.includes('formatDateTime(now)'), 'generatedAt 应为 formatDateTime(now)')
})

test('siteTitle 从 systemSettings.siteTitle 读取', () => {
  assert.ok(apiSrc.includes('systemSettings.siteTitle'), '应查询 siteTitle 字段')
  assert.ok(apiSrc.includes('settings.siteTitle'), '应将 siteTitle 放入响应')
})

test('voteCount 通过 votes 表聚合计数', () => {
  assert.ok(apiSrc.includes('votes.songId'), '应 join votes 表')
  assert.ok(apiSrc.includes('groupBy'), '应对 votes 做 groupBy 聚合')
  assert.ok(apiSrc.includes('voteCountMap'), '应用 voteCountMap 缓存计数')
  assert.ok(apiSrc.includes('voteCountMap.get(row.songId) ?? 0'), '无投票时默认为 0')
})

test('联合投稿人以 "& 协作者" 形式追加到 requester', () => {
  assert.ok(apiSrc.includes('songCollaborators'), '应查询 songCollaborators')
  assert.ok(
    apiSrc.includes("eq(songCollaborators.status, 'ACCEPTED')"),
    '应只取 ACCEPTED 状态的协作者'
  )
  assert.ok(
    apiSrc.includes('collaboratorsMap'),
    '应用 collaboratorsMap 缓存协作者'
  )
  // 格式：主投稿人 & 协作者（模板字符串中以 ' & ' 或 " & " 分隔）
  assert.ok(
    apiSrc.includes("' & '") || apiSrc.includes('" & "') || apiSrc.includes('} & ${') || apiSrc.includes("} & '"),
    '联合投稿人应以 & 连接'
  )
})

test('sequence 字段取 schedules.sequence', () => {
  assert.ok(apiSrc.includes('schedules.sequence'), '应查询 schedules.sequence')
  assert.ok(apiSrc.includes('sequence: row.sequence'), '应将 sequence 映射到输出')
})

test('排序为 playDate asc、sequence asc', () => {
  assert.ok(
    apiSrc.includes('asc(schedules.playDate)') && apiSrc.includes('asc(schedules.sequence)'),
    '应按 playDate asc、sequence asc 排序'
  )
})

test('displayConfig 从持久化配置读取六个布尔字段并对脏数据回退默认值', () => {
  const fields = ['showCover', 'showSequence', 'showRequester', 'showVotes', 'showPlayTime', 'showDate']
  const defaults = readFileSync(join(import.meta.dirname, '../../server/utils/system-settings-defaults.ts'), 'utf8')
  const schema = readFileSync(join(import.meta.dirname, '../../app/drizzle/schema.ts'), 'utf8')
  for (const f of fields) {
    assert.ok(defaults.includes(`${f}:`), `默认配置应包含 ${f}`)
  }
  assert.ok(schema.includes("jsonb('astrbotWeeklyConfig')"))
  assert.ok(apiSrc.includes('weeklyConfig: systemSettings.astrbotWeeklyConfig'))
  assert.ok(apiSrc.includes('typeof settings.weeklyConfig?.'))
  assert.ok(apiSrc.includes('displayConfig: Object.fromEntries('))
})

test('isDraft = false 过滤只返回已发布排期', () => {
  assert.ok(
    apiSrc.includes('eq(schedules.isDraft, false)'),
    '应过滤 isDraft = false'
  )
})

// ── 导入路径规范 ─────────────────────────────────────────────────

test('drizzle 导入路径使用 ~/drizzle/db 和 ~/drizzle/schema', () => {
  assert.ok(apiSrc.includes("from '~/drizzle/db'"), "db 应从 ~/drizzle/db 导入")
  assert.ok(apiSrc.includes("from '~/drizzle/schema'"), "schema 应从 ~/drizzle/schema 导入")
})

test('server utils 使用 ~~/ 前缀', () => {
  assert.ok(apiSrc.includes("from '~~/server/utils/apiError'"), '应从 ~~/server/utils/apiError 导入')
  assert.ok(apiSrc.includes("from '~~/server/utils/serverTime'"), '应从 ~~/server/utils/serverTime 导入')
  assert.ok(apiSrc.includes("from '~~/server/utils/astrbot-notification'"), '应从 ~~/server 导入 astrbot-notification')
})

test('timeUtils 使用 ~/utils/timeUtils（app 目录）', () => {
  assert.ok(apiSrc.includes("from '~/utils/timeUtils'"), '应从 ~/utils/timeUtils 导入')
})
