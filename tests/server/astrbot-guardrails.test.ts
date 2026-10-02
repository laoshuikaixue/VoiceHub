import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 跨端点的 AstrBot 契约守卫：隐私、群转发、字节切分、异常脱敏与文档同步。
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const README = read('../../README.md')
const SCHEDULE_API = read('../../server/api/bot/voicehub/weekly-schedule.get.ts')
const PUBLIC_SCHEDULE = read('../../server/api/songs/public.get.ts')
const SEND_API = read('../../server/api/admin/notifications/send.post.ts')
const OUTBOX = read('../../server/services/astrbotOutboxService.ts')
const GROUP_SERVICE = read('../../server/services/astrbotGroupService.ts')
const NOTIFICATION_SERVICE = read('../../server/services/astrbotNotificationService.ts')
const SONG_SOURCES = read('../../server/utils/astrbot-song-sources.ts')
const BILIBILI = read('../../server/utils/native_bilibili.ts')
const ERROR_HANDLER = read('../../server/plugins/error-handler.ts')
const SOCIAL = read('../../app/components/Account/SocialBindings.vue')

test('机器人本周歌单不返回年级班级，并按站点 hideStudentInfo 策略脱敏', () => {
  const scheduleItems = SCHEDULE_API.split('const scheduleItems')[1]?.split('const displayConfig')[0] ?? ''
  assert.doesNotMatch(scheduleItems, /requesterGrade|requesterClass/, 'scheduleItems 不得包含年级/班级')
  assert.doesNotMatch(SCHEDULE_API, /requesterGrade:|requesterClass:/, '响应不得带出年级/班级')
  assert.match(PUBLIC_SCHEDULE, /hideStudentInfo/, '公开排期端点应读取该策略')
  assert.match(SCHEDULE_API, /hideStudentInfo/, '机器人端点同样应读取该策略')
  assert.match(SCHEDULE_API, /maskScheduleItemsInfo|maskSongInfo/, '投稿人姓名应脱敏')
})

test('同时关闭 showTitle 与 showArtist 时不得回退输出歌名', () => {
  assert.doesNotMatch(
    SCHEDULE_API,
    /song \|\| item\.title/,
    '不得用 `song || item.title` 回退：管理员关闭标题后仍会泄漏歌名'
  )
  assert.match(SCHEDULE_API, /formatAstrbotWeeklyScheduleText/)
})

test('群聊转发在站内收件人为空时仍要执行', () => {
  const emptyBranch = SEND_API.match(/if \(userIds\.length === 0\) \{[\s\S]*?\n  \}/)
  assert.ok(emptyBranch, '应存在 userIds 为空的提前返回分支')
  assert.match(emptyBranch[0], /forwardSystemNoticeToGroups\(broadcastToGroups, title, content\)/,
    '空收件人分支必须先执行群转发再返回，否则勾选转发也收不到')
  // 群转发调用次数应足以覆盖两条路径（单用户 / 批量）
  const calls = SEND_API.match(/forwardSystemNoticeToGroups\(/g) ?? []
  assert.ok(calls.length >= 3, `群转发应覆盖单用户、批量与非空批量三条路径，实际 ${calls.length - 1} 处调用`)
})

test('私聊与群事件入队统一按字节预算切分，不丢目标、不整批早退', () => {
  // 切分工具唯一权威且被多处复用
  assert.match(read('../../server/utils/astrbot-payload.ts'), /export function chunkAstrbotTargets/)
  assert.match(NOTIFICATION_SERVICE, /chunkAstrbotTargets/)
  // 私聊：按目标+正文的序列化预算切分，超限目标计入日志而非静默丢弃
  assert.match(OUTBOX, /chunkAstrbotTargets\(umos, title, content\)/, '入队必须以序列化预算切分')
  assert.doesNotMatch(OUTBOX, /for \(let index = 0; index < umos\.length; index \+= ASTRBOT_MAX_TARGETS_PER_REQUEST\)/,
    '不得保留按固定条数切分的入队逻辑')
  assert.doesNotMatch(OUTBOX, /fitsAstrbotPayload\(\[\], title, content, false\)/, '不得只校验正文而忽略目标字节数')
  assert.match(OUTBOX, /if \(skipped\)/, '超限目标必须计入日志而非静默丢弃')
  assert.match(OUTBOX, /const rowsToInsert[\s\S]*?chunks\.map/, '私聊按分块入队')
  // 群事件：同样按字节预算切分，分块必须全部入队
  assert.match(GROUP_SERVICE, /chunkAstrbotTargets/, '群事件入队应复用 chunkAstrbotTargets')
  assert.doesNotMatch(GROUP_SERVICE, /if \(!fitsAstrbotPayload\(fresh, title, content, true\)\)/,
    '不得整批预算失败就静默跳过入队')
  assert.match(GROUP_SERVICE, /insert\(astrbotOutbox\)\.values\(chunks\.map/, '切分后的每一块都要入队')
})

test('Bilibili 搜索接收并传递页码', () => {
  assert.match(
    BILIBILI,
    /searchBilibiliVideos\(\s*keyword: string,\s*page\s*=\s*1/,
    'searchBilibiliVideos 应接收 page 参数'
  )
  assert.doesNotMatch(BILIBILI.split('export async function searchBilibiliVideos')[1]?.slice(0, 900) ?? '', /page: 1,/,
    '不得把请求页码写死为 1')
  assert.match(SONG_SOURCES, /searchBilibiliVideos\(keyword, page/, '调用方应传递 page')
})

test('README 项目结构列出全部 bot/voicehub 端点', () => {
  for (const name of ['bind.post.ts', 'unbind.post.ts', 'verify-targets.post.ts', 'pull.post.ts', 'ack.post.ts',
    'song-search.post.ts', 'song-request.post.ts', 'weekly-schedule.get.ts']) {
    assert.ok(README.includes(name), `README 项目结构缺少 ${name}`)
  }
})

test('前端绑定状态保留接口返回的 boundUser', () => {
  const assignment = SOCIAL.match(/platformStatus\.value\[platform\] = \{[\s\S]*?\n {6}\}/)
  assert.ok(assignment, '应重建 platformStatus 状态对象')
  assert.match(assignment[0], /boundUser:\s*entry\?\.boundUser/, '重建状态时必须保存接口返回的 boundUser')
})

test('异常上报统一脱敏，拒绝值在对象分支之前无条件上报', () => {
  const rejectBlock = ERROR_HANDLER.match(/process\.on\('unhandledRejection',[\s\S]*?\n  \}\)/)
  assert.ok(rejectBlock, '应存在 unhandledRejection 处理')
  const reportIndex = rejectBlock[0].indexOf('reportSystemError')
  const objectBranchIndex = rejectBlock[0].indexOf("typeof reason === 'object'")
  assert.ok(reportIndex > -1, '应上报 systemError 群事件')
  assert.ok(reportIndex < objectBranchIndex,
    '上报必须在对象判断之前无条件执行，否则 Promise.reject(\'...\') 等原始值会被漏报')
  assert.match(rejectBlock[0], /String\(reason\)/, '原始值拒绝应规范化为字符串')
  assert.doesNotMatch(ERROR_HANDLER, /reportSystemError\('未捕获异常', error\?\.message \|\| String\(error\)\)/,
    '不得把未处理的原始 message 直接入群事件')
  assert.match(ERROR_HANDLER, /reportSystemError\('未捕获异常',\s*sanitizeAstrbotErrorDetail/,
    '未捕获异常须先脱敏再上报')
  assert.match(ERROR_HANDLER, /sanitizeAstrbotErrorDetail\(rejectionDetail\)|sanitizeAstrbotErrorDetail\(reason/,
    '未处理拒绝也须脱敏')
  assert.match(GROUP_SERVICE, /sanitizeAstrbotErrorDetail/, '群事件服务须在入队前脱敏')
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

test('音源搜索端点与机器人共用同一份上游实现', () => {
  const mgEndpoint = read('../../server/api/native-api/search/mg.get.ts')
  const bilibiliEndpoint = read('../../server/api/bilibili/search.get.ts')
  assert.match(mgEndpoint, /from '~~\/server\/utils\/native_mg'/, 'mg 端点应复用 utils 实现')
  assert.match(bilibiliEndpoint, /from '~~\/server\/utils\/native_bilibili'/, 'bilibili 端点应复用 utils 实现')
  assert.doesNotMatch(mgEndpoint, /async function search(?:PC|Mobile)\(/, '端点内不得再保留第二份上游实现')
  assert.doesNotMatch(bilibiliEndpoint, /bi_convert_song|htmlToPlainText/, '端点内不得再保留第二份转换逻辑')
})

test('目标按字节预算切分：不超限、不丢失、顺序保持', async () => {
  const { chunkAstrbotTargets, astrbotPayloadBytes, ASTRBOT_PAYLOAD_MAX_BYTES, ASTRBOT_MAX_TARGETS_PER_REQUEST } =
    await import('../../server/utils/astrbot-payload.ts')
  const umos = Array.from({ length: 450 }, (_, i) => `default:FriendMessage:${i}`)
  const { chunks, skipped } = chunkAstrbotTargets(umos, '标题', '内容')
  assert.equal(skipped, 0)
  assert.ok(chunks.length >= 3, '条数上限应触发切分')
  for (const chunk of chunks) {
    assert.ok(chunk.length <= ASTRBOT_MAX_TARGETS_PER_REQUEST)
    assert.ok(astrbotPayloadBytes(chunk, '标题', '内容') <= ASTRBOT_PAYLOAD_MAX_BYTES)
  }
  assert.deepEqual(chunks.flat(), umos, '切分不得丢失或重排目标')

  // 长 UMO：条数未满也应先触发字节预算切分
  const longUmos = Array.from({ length: 200 }, (_, i) => `default:FriendMessage:${i}${'y'.repeat(480)}`)
  const byBytes = chunkAstrbotTargets(longUmos, '标题', '内容')
  assert.equal(byBytes.skipped, 0)
  assert.ok(byBytes.chunks.length >= 2)
  for (const chunk of byBytes.chunks) {
    assert.ok(astrbotPayloadBytes(chunk, '标题', '内容') <= ASTRBOT_PAYLOAD_MAX_BYTES)
  }
  assert.deepEqual(byBytes.chunks.flat(), longUmos)

  // 单目标自身超限：计入 skipped，不影响其余目标
  const withSkip = chunkAstrbotTargets(['default:FriendMessage:1', 'x'.repeat(64 * 1024), 'default:FriendMessage:2'], '标题', '内容')
  assert.equal(withSkip.skipped, 1)
  assert.deepEqual(withSkip.chunks.flat(), ['default:FriendMessage:1', 'default:FriendMessage:2'])
})
