import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const README = read('../../README.md')
const SCHEDULE_API = read('../../server/api/bot/voicehub/weekly-schedule.get.ts')
const SEND_API = read('../../server/api/admin/notifications/send.post.ts')
const OUTBOX = read('../../server/services/astrbotOutboxService.ts')
const GROUP = read('../../server/services/astrbotGroupService.ts')
const SONG_SOURCES = read('../../server/utils/astrbot-song-sources.ts')
const BILIBILI = read('../../server/utils/native_bilibili.ts')
const ERROR_HANDLER = read('../../server/plugins/error-handler.ts')
const UNBIND = read('../../server/api/bot/voicehub/unbind.post.ts')
const SOCIAL = read('../../app/components/Account/SocialBindings.vue')
const NOTIFICATION_SERVICE = read('../../server/services/astrbotNotificationService.ts')

// ── 上游审查：本周歌单纯文本不得泄漏已关闭的标题/歌手 ──────────────

test('同时关闭 showTitle 与 showArtist 时不得回退输出歌名', () => {
  assert.ok(
    !/song \|\| item\.title/.test(SCHEDULE_API),
    '不得用 `song || item.title` 回退：管理员关闭标题后仍会泄漏歌名'
  )
  assert.match(SCHEDULE_API, /formatAstrbotWeeklyScheduleText/)
})

// ── 上游审查：群转发必须独立于站内收件人数量 ────────────────────────

test('群聊转发在站内收件人为空时仍要执行', () => {
  const emptyBranch = SEND_API.match(/if \(userIds\.length === 0\) \{[\s\S]*?\n  \}/)
  assert.ok(emptyBranch, '应存在 userIds 为空的提前返回分支')
  assert.ok(
    /forwardSystemNoticeToGroups\(broadcastToGroups, title, content\)/.test(emptyBranch[0]),
    '空收件人分支必须先执行群转发再返回，否则勾选转发也收不到'
  )
  // 群转发调用次数应足以覆盖两条路径（单用户 / 批量）
  const calls = SEND_API.match(/forwardSystemNoticeToGroups\(/g) ?? []
  assert.ok(calls.length >= 3, `群转发应覆盖单用户、批量与非空批量三条路径，实际 ${calls.length - 1} 处调用`)
})

// ── 上游审查：入队必须按序列化字节预算切分 ──────────────────────────

test('私聊入队按目标字节预算切分，不再只按固定 200 条分批', () => {
  assert.ok(OUTBOX.includes('chunkAstrbotTargets'), '入队应复用 chunkAstrbotTargets')
  assert.ok(
    !/for \(let index = 0; index < umos\.length; index \+= ASTRBOT_MAX_TARGETS_PER_REQUEST\)/.test(OUTBOX),
    '不得保留按固定条数切分的入队逻辑'
  )
  assert.ok(
    /chunkAstrbotTargets\(umos, title, content\)/.test(OUTBOX),
    '入队必须以目标+正文的序列化预算切分'
  )
  assert.ok(
    !/fitsAstrbotPayload\(\[\], title, content, false\)/.test(OUTBOX),
    '不得只校验正文而忽略目标字节数'
  )
  assert.ok(/if \(skipped\)/.test(OUTBOX), '超限目标必须计入日志而非静默丢弃')
})

test('群事件入队同样按字节预算切分并记录超限目标', () => {
  assert.ok(GROUP.includes('chunkAstrbotTargets'), '群事件入队应复用 chunkAstrbotTargets')
  assert.ok(
    !/if \(!fitsAstrbotPayload\(fresh, title, content, true\)\)/.test(GROUP),
    '不得整批预算失败就静默跳过入队'
  )
})

test('字节预算切分工具确实存在且被多处复用（单一权威）', () => {
  assert.match(NOTIFICATION_SERVICE, /chunkAstrbotTargets/)
  const payload = read('../../server/utils/astrbot-payload.ts')
  assert.match(payload, /export function chunkAstrbotTargets/)
})

// ── 上游审查：Bilibili 分页必须与其它音源一致 ────────────────────────

test('Bilibili 搜索接收并传递页码', () => {
  assert.match(
    BILIBILI,
    /searchBilibiliVideos\(\s*keyword: string,\s*page\s*=\s*1/,
    'searchBilibiliVideos 应接收 page 参数'
  )
  assert.ok(!/page: 1,/.test(BILIBILI.split('export async function searchBilibiliVideos')[1]?.slice(0, 900) ?? ''),
    '不得把请求页码写死为 1')
  assert.match(SONG_SOURCES, /searchBilibiliVideos\(keyword, page/, '调用方应传递 page')
})

// ── 上游审查：README 项目结构必须与文件系统一致 ──────────────────────

test('README 项目结构列出全部 bot/voicehub 端点', () => {
  const dir = join(import.meta.dirname, '../../server/api/bot/voicehub')
  const files = readFileSync(join(import.meta.dirname, '../../README.md'), 'utf8')
  for (const name of ['bind.post.ts', 'unbind.post.ts', 'verify-targets.post.ts', 'pull.post.ts', 'ack.post.ts',
    'song-search.post.ts', 'song-request.post.ts', 'weekly-schedule.get.ts']) {
    assert.ok(files.includes(name), `README 项目结构缺少 ${name}`)
  }
  void dir
})

// ── 上游审查：解绑必须限定候选本身，避免跨账号解绑 ────────────────────

test('解绑删除同时限定候选 id 与 platform', () => {
  const deleteCall = UNBIND.match(/tx\.delete\(astrbotBindings\)\.where\(([\s\S]*?)\)\.returning\(\)/)
  assert.ok(deleteCall, '应有删除绑定的事务内操作')
  assert.ok(/candidate\.id/.test(deleteCall[1]), '删除条件应限定候选 userId')
  assert.ok(/candidate\.platform/.test(deleteCall[1]), '删除条件应限定候选 platform')
})

// ── 上游审查：绑定用户标识必须保留 ──────────────────────────────────

test('前端绑定状态保留接口返回的 boundUser', () => {
  const assignment = SOCIAL.match(/platformStatus\.value\[platform\] = \{[\s\S]*?\n {6}\}/)
  assert.ok(assignment, '应重建 platformStatus 状态对象')
  assert.match(assignment[0], /boundUser:\s*entry\?\.boundUser/, '重建状态时必须保存接口返回的 boundUser')
})

// ── 上游审查：未处理拒绝必须无条件上报 ──────────────────────────────

test('未处理拒绝先规范化为字符串并无条件上报', () => {
  const rejectBlock = ERROR_HANDLER.match(/process\.on\('unhandledRejection',[\s\S]*?\n  \}\)/)
  assert.ok(rejectBlock, '应存在 unhandledRejection 处理')
  const reportIndex = rejectBlock[0].indexOf('reportSystemError')
  const objectBranchIndex = rejectBlock[0].indexOf("typeof reason === 'object'")
  assert.ok(reportIndex > -1, '应上报 systemError 群事件')
  assert.ok(
    reportIndex < objectBranchIndex,
    '上报必须在对象判断之前无条件执行，否则 Promise.reject(\'...\') 等原始值会被漏报'
  )
  assert.match(rejectBlock[0], /String\(reason\)/, '原始值拒绝应规范化为字符串')
})
