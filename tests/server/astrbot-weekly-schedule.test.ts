import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
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

test('机器人路由：weekly GET 与全部 POST 端点由同一集合放行，pull 不开放 GET', () => {
  assert.equal(BOT_ROUTES.has('GET /api/bot/voicehub/weekly-schedule'), true)
  assert.match(middlewareSrc, /BOT_ROUTES\.has\(`\$\{method\} \$\{pathname\}`\)/)
  assert.equal(BOT_ROUTES.has('GET /api/bot/voicehub/pull'), false)
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

test('API 鉴权：统一令牌头与 equalAstrbotToken，失败 401 且同时检查总开关', () => {
  assert.ok(apiSrc.includes('ASTRBOT_TOKEN_HEADER'), '应导入 ASTRBOT_TOKEN_HEADER')
  assert.ok(apiSrc.includes('equalAstrbotToken'), '应使用 equalAstrbotToken')
  assert.ok(apiSrc.includes('NOTIFICATION_AUTH_REQUIRED'), '鉴权失败应使用 NOTIFICATION_AUTH_REQUIRED')
  assert.ok(apiSrc.includes('401'), '鉴权失败应返回 401')
  assert.ok(apiSrc.includes('settings?.enabled'), '应检查 astrbotEnabled 总开关')
})

test('全部 AstrBot 服务端模块禁止裸 new Date()，端点使用 getServerDate()', () => {
  assert.ok(apiSrc.includes('getServerDate()'), '应使用 getServerDate()')
  const stripComments = (code: string) => code.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const dirs = ['server/services', 'server/utils', 'server/plugins', 'server/api/bot/voicehub', 'server/api/notifications']
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(full)
      else if (/astrbot.*\.ts$/.test(entry.name) && !entry.name.endsWith('.test.ts')) files.push(full)
    }
  }
  dirs.forEach(walk)
  assert.ok(files.length >= 8, `应扫描到 AstrBot 服务端模块，实际 ${files.length}`)
  for (const file of files) {
    // 注释里的 new Date() 是说明，不作为违规；只看真实代码。
    assert.ok(!stripComments(readFileSync(join(process.cwd(), file), 'utf8')).includes('new Date()'),
      `${file} 禁止直接使用 new Date()`)
  }
})

test('本周区间按北京时间周一至周日，weekRange 格式 YYYY/MM/DD - YYYY/MM/DD', () => {
  assert.ok(apiSrc.includes('getBeijingStartOfWeek'), '应使用 getBeijingStartOfWeek')
  assert.match(apiSrc, /getBeijingEndOfWeek\(now\)\.getTime\(\) \+ 1/)

  // 周日（2026-09-27）应向前退到本周一 2026-09-21
  const sunday = dayjs.tz('2026-09-27 12:00:00', BEIJING_TIMEZONE).toDate()
  assert.equal(formatDateTime(getBeijingStartOfWeek(sunday), 'YYYY-MM-DD'), '2026-09-21')
  // 周一（2026-09-21）diff=0，返回当天
  const monday = dayjs.tz('2026-09-21 08:00:00', BEIJING_TIMEZONE).toDate()
  assert.equal(formatDateTime(getBeijingStartOfWeek(monday), 'YYYY-MM-DD'), '2026-09-21')
  // 区间恰好覆盖 7 天，且 weekRange 由 timeUtils 格式化
  assert.equal(getBeijingEndOfWeek(sunday).getTime() + 1 - getBeijingStartOfWeek(sunday).getTime(),
    7 * 24 * 60 * 60 * 1000)
  assert.ok(apiSrc.includes("formatDateTime(weekStart, 'YYYY/MM/DD')"), 'weekRange 应使用 timeUtils 格式化')
  assert.ok(apiSrc.includes('weekRange'), '应返回 weekRange 字段')
})

test('日期与星期标签由 timeUtils 统一生成（YYYY/MM/DD 周X）', () => {
  assert.match(apiSrc, /getBeijingWeekdayLabel\(row\.playDate\)/)
  assert.doesNotMatch(apiSrc, /CN_WEEKDAYS|dayjs\.extend|BEIJING_TIMEZONE/)
  const playDate = dayjs.tz('2026-09-21 00:00:00', BEIJING_TIMEZONE).toDate()
  assert.equal(`${formatDateTime(playDate, 'YYYY/MM/DD')} ${getBeijingWeekdayLabel(playDate)}`, '2026/09/21 周一')
  const sunday = dayjs.tz('2026-09-27 00:00:00', BEIJING_TIMEZONE).toDate()
  assert.equal(getBeijingWeekdayLabel(sunday), '周日')
})

test('响应字段与排序：generatedAt/siteTitle/sequence/playDate asc/isDraft 过滤', () => {
  assert.ok(apiSrc.includes('formatDateTime(now)'), 'generatedAt 应为 formatDateTime(now)')
  assert.ok(apiSrc.includes('systemSettings.siteTitle'), '应查询 siteTitle 字段')
  assert.ok(apiSrc.includes('settings.siteTitle'), '应将 siteTitle 放入响应')
  assert.ok(apiSrc.includes('schedules.sequence'), '应查询 schedules.sequence')
  assert.ok(apiSrc.includes('sequence: row.sequence'), '应将 sequence 映射到输出')
  assert.ok(
    apiSrc.includes('asc(schedules.playDate)') && apiSrc.includes('asc(schedules.sequence)'),
    '应按 playDate asc、sequence asc 排序'
  )
  assert.ok(apiSrc.includes('eq(schedules.isDraft, false)'), '应过滤 isDraft = false，只返回已发布排期')
})

test('voteCount 聚合与联合投稿人拼接', () => {
  assert.ok(apiSrc.includes('votes.songId'), '应 join votes 表')
  assert.ok(apiSrc.includes('groupBy'), '应对 votes 做 groupBy 聚合')
  assert.ok(apiSrc.includes('voteCountMap.get(row.songId) ?? 0'), '无投票时默认为 0')
  assert.ok(apiSrc.includes('songCollaborators'), '应查询 songCollaborators')
  assert.ok(apiSrc.includes("eq(songCollaborators.status, 'ACCEPTED')"), '应只取 ACCEPTED 状态的协作者')
  assert.ok(apiSrc.includes('collaboratorsMap'), '应用 collaboratorsMap 缓存协作者')
  assert.ok(
    apiSrc.includes("' & '") || apiSrc.includes('" & "') || apiSrc.includes('} & ${') || apiSrc.includes("} & '"),
    '联合投稿人应以 & 连接'
  )
})

test('displayConfig 读取持久化配置并对脏数据回退默认（归一化唯一权威）', () => {
  const fields = [
    'layoutStyle', 'listColumns', 'showLogo', 'showSchoolLogo', 'showCover', 'showTitle',
    'showArtist', 'showSequence', 'showRequester', 'showVotes', 'showPlayTime', 'showDate'
  ]
  const defaults = readFileSync(join(import.meta.dirname, '../../server/utils/astrbot-weekly-config.ts'), 'utf8')
  const schema = readFileSync(join(import.meta.dirname, '../../app/drizzle/schema.ts'), 'utf8')
  for (const f of fields) {
    assert.ok(defaults.includes(`${f}:`), `默认配置应包含 ${f}`)
  }
  assert.ok(schema.includes("jsonb('astrbotWeeklyConfig')"))
  assert.ok(apiSrc.includes('weeklyConfig: systemSettings.astrbotWeeklyConfig'))
  // 归一化唯一权威：排版与列数必须经 normalizeAstrbotWeeklyConfig，禁止回退成「只认布尔」的内联实现
  assert.ok(apiSrc.includes('normalizeAstrbotWeeklyConfig'), '应复用归一化权威')
  assert.ok(
    !apiSrc.includes('typeof settings.weeklyConfig?.'),
    '不得保留只透传布尔值的内联实现（会吞掉 layoutStyle / listColumns）'
  )
})

test('同时提供纯文本字段，并支持 format=text 直接返回文本', () => {
  assert.match(apiSrc, /formatAstrbotWeeklyScheduleText\(/)
  assert.match(apiSrc, /getQuery\(event\)\.format === 'text'/)
  assert.match(apiSrc, /content-type', 'text\/plain; charset=utf-8'/)
  assert.match(apiSrc, /暂无已发布排期/)
})

test('导入路径符合规范：~/drizzle、~~/server、~/utils', () => {
  assert.ok(apiSrc.includes("from '~/drizzle/db'"), 'db 应从 ~/drizzle/db 导入')
  assert.ok(apiSrc.includes("from '~/drizzle/schema'"), 'schema 应从 ~/drizzle/schema 导入')
  assert.ok(apiSrc.includes("from '~~/server/utils/apiError'"), '应从 ~~/server/utils/apiError 导入')
  assert.ok(apiSrc.includes("from '~~/server/utils/serverTime'"), '应从 ~~/server/utils/serverTime 导入')
  assert.ok(apiSrc.includes("from '~~/server/utils/astrbot-notification'"), '应从 ~~/server 导入 astrbot-notification')
  assert.ok(apiSrc.includes("from '~/utils/timeUtils'"), 'timeUtils 应从 ~/utils/timeUtils（app 目录）导入')
})
