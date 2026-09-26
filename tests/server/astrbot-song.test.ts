import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  isPublicApiPath,
  shouldBypassPublicApiAuthentication
} from '../../server/utils/auth-route-policy.ts'
import { BOT_ROUTES, SERVER_ERROR_CODES } from '../../server/config/constants.ts'
import {
  ASTRBOT_SONG_CANDIDATE_LIMIT,
  ASTRBOT_SONG_SOURCES,
  ASTRBOT_SONG_TICKET_PURPOSE,
  ASTRBOT_SONG_TICKET_TTL_MS,
  isAstrbotSongTicket,
  mapBilibiliSongCandidate,
  mapNativeSongCandidate,
  normalizeAstrbotSongCandidates,
  parseAstrbotSongSource,
  searchSongs,
  type SongCandidate
} from '../../server/utils/astrbot-song-search.ts'

// 机器人点歌：回调查询/投稿的鉴权、平台启用、票据、序号与错误透传契约。
// 纯映射与票据校验直接单测；端点行为按源码契约断言（与既有 astrbot-*.test.ts 同风格）。
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const middleware = source('server/middleware/auth.ts')
const songSearch = source('server/api/bot/voicehub/song-search.post.ts')
const songRequest = source('server/api/bot/voicehub/song-request.post.ts')
const searchUtils = source('server/utils/astrbot-song-search.ts')
const songSources = source('server/utils/astrbot-song-sources.ts')

const SEARCH_PATH = '/api/bot/voicehub/song-search'
const REQUEST_PATH = '/api/bot/voicehub/song-request'
const UMO = 'default:FriendMessage:1'

function ticketWith(candidates: SongCandidate[], overrides: Record<string, unknown> = {}) {
  return { umo: UMO, platform: 'netease', keyword: '告白气球', createdAt: 1, candidates, ...overrides }
}

test('两个点歌回调在中间件按精确路径放行，且不进入通用公开白名单', () => {
  for (const path of [SEARCH_PATH, REQUEST_PATH]) {
    assert.equal(BOT_ROUTES.has(`POST ${path}`), true)
    assert.match(middleware, /BOT_ROUTES\.has/)
    // 不带登录态也不能绕过：这两个端点靠自身令牌校验，不走公共白名单
    assert.equal(isPublicApiPath(path, 'POST'), false)
    assert.equal(shouldBypassPublicApiAuthentication(path, 'POST', false), false)
    assert.equal(isPublicApiPath(path, 'GET'), false)
  }
})

test('两个端点使用统一机器人令牌校验与中文文案', () => {
  for (const text of [songSearch, songRequest]) {
    assert.match(text, /SERVER_ERROR_CODES\.NOTIFICATION_AUTH_REQUIRED/)
    assert.match(text, /'机器人令牌无效'/)
    assert.match(text, /equalAstrbotToken\(getHeader\(event, ASTRBOT_TOKEN_HEADER\) \?\? '', settings\.token \?\? ''\)/)
    // UMO 形态校验（私聊），非法即 400
    assert.match(text, /isAstrbotPrivateUmoShape\(umo\)/)
    assert.match(text, /SERVER_ERROR_CODES\.ASTRBOT_UMO_INVALID/)
    assert.match(text, /'私聊会话无效'/)
  }
})

test('平台启用四项条件服务端强制：绑定行 + 总开关 + 平台开关 + 适配器归类', () => {
  for (const text of [songSearch, songRequest]) {
    assert.match(text, /!settings\?\.enabled \|\|/)
    assert.match(text, /from\(astrbotBindings\)[\s\S]{0,120}where\(eq\(astrbotBindings\.umo, umo\)\)/)
    assert.match(text, /!binding \|\| !isAstrbotPlatformEnabled\(settings\.platforms, binding\.platform\)/)
    assert.match(text, /adapterToAstrbotPlatform\(binding\.adapter\) !== binding\.platform/)
    assert.match(text, /403, SERVER_ERROR_CODES\.ASTRBOT_UMO_UNBOUND, '该会话未绑定 VoiceHub 账号'/)
  }
})

test('搜索端点：关键词与音源校验、候选默认网易云、非法音源 400', () => {
  assert.match(songSearch, /SERVER_ERROR_CODES\.ASTRBOT_SONG_KEYWORD_INVALID, '点歌关键词无效'/)
  assert.match(songSearch, /keyword\.length > ASTRBOT_SONG_KEYWORD_MAX_LENGTH/)
  assert.match(songSearch, /SERVER_ERROR_CODES\.ASTRBOT_SONG_PLATFORM_INVALID, '不支持的音源平台'/)
  assert.match(
    songSearch,
    /parseAstrbotSongSource\(body\?\.platform \?\? DEFAULT_ASTRBOT_SONG_SOURCE\)/
  )
})

test('搜索端点：seal 把候选与序号绑定，10 分钟有效，items 不回 musicId/cover', () => {
  assert.equal(ASTRBOT_SONG_TICKET_PURPOSE, 'astrbot-song')
  assert.equal(ASTRBOT_SONG_TICKET_TTL_MS, 600 * 1000)

  const sealedBlock = songSearch.match(
    /seal\(\{([\s\S]*?)\}, ASTRBOT_SONG_TICKET_PURPOSE, ASTRBOT_SONG_TICKET_TTL_MS\)/
  )
  assert.ok(sealedBlock, 'seal 必须内联票据载荷，便于审计')
  for (const key of ['umo', 'platform', 'keyword', 'createdAt', 'candidates']) {
    assert.match(sealedBlock![1], new RegExp(`\\b${key}\\b`))
  }

  assert.match(songSearch, /items: candidates\.map\(/)
  const itemsBlock = songSearch.slice(songSearch.indexOf('items: candidates.map('))
  assert.match(itemsBlock, /index: index \+ 1/)
  assert.match(itemsBlock, /durationSeconds: candidate\.durationSeconds/)
  // 聊天里只回序号与基本信息，不回 musicId/cover，避免刷屏
  assert.doesNotMatch(itemsBlock, /musicId|cover/)
})

test('搜索端点经统一音源层取候选，并截断为上限条数', () => {
  assert.match(songSearch, /import \{[\s\S]*?\} from '~~\/server\/utils\/astrbot-song-search'/)
  assert.match(songSearch, /searchSongs\(platform, keyword, page\)/)
  assert.equal(ASTRBOT_SONG_CANDIDATE_LIMIT, 5)
  assert.match(searchUtils, /export async function searchSongs\(/)
  assert.match(searchUtils, /slice\(0, ASTRBOT_SONG_CANDIDATE_LIMIT\)/)
})

test('投稿端点：unseal 校验票据，跨会话/过期统一 400 文案', () => {
  assert.match(songRequest, /unseal\(body\?\.sessionToken, ASTRBOT_SONG_TICKET_PURPOSE\)/)
  assert.match(songRequest, /isAstrbotSongTicket\(ticket, umo\)/)
  assert.match(songRequest, /SERVER_ERROR_CODES\.ASTRBOT_SONG_SESSION_INVALID, '点歌会话已过期或无效，请重新搜索'/)
  assert.match(songRequest, /SERVER_ERROR_CODES\.ASTRBOT_SONG_INDEX_INVALID, '序号超出可点歌曲范围'/)
  assert.match(songRequest, /index > ticket\.candidates\.length/)
})

test('投稿端点：按绑定账号的真实 role 投稿，绝不硬编码管理员', () => {
  assert.match(songRequest, /await requestSongForUser\(event, \{ id: binding\.userId, role: user\.role \}, payload\)/)
  assert.match(songRequest, /from\(users\)/)
  assert.match(songRequest, /user\.status !== 'active'/)
  // 管理员会豁免限额/时段/强制关闭投稿等规则，角色只能来自数据库真实行
  assert.doesNotMatch(songRequest, /'ADMIN'/)
  assert.doesNotMatch(songRequest, /SUPER_ADMIN|SONG_ADMIN/)
})

test('投稿端点：券码大写化、note 映射 submissionNote、时段按开关传入、不传站点选择票据', () => {
  assert.match(songRequest, /toUpperCase\(\)/)
  assert.match(songRequest, /submissionNote: note/)
  assert.match(songRequest, /preferredPlayTimeId: playTimeId/)
  assert.match(songRequest, /enablePlayTimeSelection === true/)
  // 候选序号已由本接口自己的票据保护，不再叠加站点选择票据
  assert.doesNotMatch(songRequest, /selectionToken/)
  // 站点侧错误必须原样透传（保留 statusCode/statusMessage/data）
  assert.match(songRequest, /throw createError\(\{/)
  assert.match(songRequest, /statusCode: error\.statusCode/)
  assert.match(songRequest, /statusMessage: error\.statusMessage/)
})

test('投稿端点：成功响应文案与字段逐字', () => {
  assert.match(songRequest, /title: song\?\.title \?\? candidate\.title/)
  assert.match(songRequest, /artist: song\?\.artist \?\? candidate\.artist/)
  assert.match(songRequest, /message: `点歌成功：\$\{title\} - \$\{artist\}`/)
  assert.match(songRequest, /songId: song\?\.id \?\? null/)
})

test('四个新错误码与 UMO 未绑定错误码已登记到 SERVER_ERROR_CODES', () => {
  const codes = SERVER_ERROR_CODES as Record<string, string>
  for (const code of [
    'ASTRBOT_SONG_KEYWORD_INVALID',
    'ASTRBOT_SONG_PLATFORM_INVALID',
    'ASTRBOT_SONG_SESSION_INVALID',
    'ASTRBOT_SONG_INDEX_INVALID',
    'ASTRBOT_UMO_UNBOUND'
  ]) {
    assert.equal(codes[code], code)
  }
})

test('searchSongs 编排：注入上游映射候选、截断上限、上游抖动降级为空数组', async () => {
  const upstreamList = Array.from({ length: 7 }, (_, index) => ({
    songmid: index + 1,
    name: `曲目${index}`,
    singer: '周杰伦',
    img: '//p1.music.126.net/x.jpg',
    duration: 100 + index
  }))

  const candidates = await searchSongs('netease', '  告白气球  ', 2, async (source, keyword, page) => {
    assert.equal(source, 'netease')
    assert.equal(keyword, '告白气球')
    assert.equal(page, 2)
    return upstreamList
  })
  assert.equal(candidates.length, ASTRBOT_SONG_CANDIDATE_LIMIT)
  assert.deepEqual(candidates[0], {
    platform: 'netease',
    musicId: '1',
    title: '曲目0',
    artist: '周杰伦',
    cover: 'https://p1.music.126.net/x.jpg',
    durationSeconds: 100
  })

  // 上游失败/空结果绝不抛给调用方，端点据空数组返回空候选
  assert.deepEqual(await searchSongs('netease', '告白气球', 1, async () => {
    throw new Error('上游抖动')
  }), [])
  assert.deepEqual(await searchSongs('netease', '告白气球', 1, async () => null), [])
  assert.deepEqual(await searchSongs('unknown', '告白气球', 1), [])
  assert.deepEqual(await searchSongs('netease', '   ', 1), [])
  assert.deepEqual(normalizeAstrbotSongCandidates('netease', []), [])
  assert.deepEqual(normalizeAstrbotSongCandidates('netease', null), [])
  assert.match(searchUtils, /catch \(error\)[\s\S]{0,200}return \[\]/)
})

test('音源层复用同进程实现，不做 /api 自请求', () => {
  assert.match(songSources, /wyEapiRequest/)
  assert.match(songSources, /searchQqMusic/)
  assert.match(songSources, /createTxSearchBody/)
  assert.match(songSources, /biConvertSong|bi_convert_song/)
  assert.doesNotMatch(songSources, /\$fetch\(\s*['"`]\/api\//)
})

test('统一候选结构：netease/tencent/migu 共用 native 映射，字段齐全', () => {
  assert.deepEqual([...ASTRBOT_SONG_SOURCES], ['netease', 'tencent', 'migu', 'bilibili'])
  assert.equal(parseAstrbotSongSource('netease'), 'netease')
  assert.equal(parseAstrbotSongSource('bilibili'), 'bilibili')
  assert.equal(parseAstrbotSongSource('qq'), null)
  assert.equal(parseAstrbotSongSource(undefined), null)

  const candidate = mapNativeSongCandidate('netease', {
    songmid: 186016,
    name: '告白气球',
    singer: '周杰伦',
    img: 'https://p1.music.126.net/x.jpg',
    duration: 215.4
  })
  assert.deepEqual(Object.keys(candidate!).sort(), [
    'artist', 'cover', 'durationSeconds', 'musicId', 'platform', 'title'
  ])
  assert.deepEqual(candidate, {
    platform: 'netease',
    musicId: '186016',
    title: '告白气球',
    artist: '周杰伦',
    cover: 'https://p1.music.126.net/x.jpg',
    durationSeconds: 215
  })

  for (const platform of ['tencent', 'migu']) {
    const item = mapNativeSongCandidate(platform, {
      songmid: '0039MnYb0qxYhV', name: '告白气球', singer: '周杰伦', img: '', duration: 215
    })
    assert.equal(item?.platform, platform)
    assert.equal(item?.musicId, '0039MnYb0qxYhV')
    assert.equal(item?.title, '告白气球')
    assert.equal(item?.artist, '周杰伦')
    assert.equal(item?.cover, null)
    assert.equal(item?.durationSeconds, 215)
  }
})

test('native 映射过滤脏数据并归一化封面与时长', () => {
  // 缺 musicId 或 title 的条目不得成为候选
  assert.equal(mapNativeSongCandidate('netease', { name: '无 ID' }), null)
  assert.equal(mapNativeSongCandidate('netease', { songmid: 1 }), null)
  assert.equal(mapNativeSongCandidate('netease', 'not-an-object'), null)
  // 时长缺失或非正数视为未知
  assert.equal(mapNativeSongCandidate('netease', { songmid: 1, name: 'x', duration: 0 })?.durationSeconds, null)
  assert.equal(mapNativeSongCandidate('netease', { songmid: 1, name: 'x' })?.durationSeconds, null)
  // 封面只接受完整 http(s) 链接（协议相对补 https，其余留空）
  assert.equal(mapNativeSongCandidate('netease', { songmid: 1, name: 'x', img: '//x/y.jpg' })?.cover, 'https://x/y.jpg')
  assert.equal(mapNativeSongCandidate('netease', { songmid: 1, name: 'x', img: 'http://x/y.jpg' })?.cover, 'http://x/y.jpg')
  assert.equal(mapNativeSongCandidate('netease', { songmid: 1, name: 'x', img: 'ftp://x/y.jpg' })?.cover, null)
  // 歌手缺失兜底
  assert.equal(mapNativeSongCandidate('netease', { songmid: 1, name: 'x' })?.artist, '未知艺术家')
})

test('bilibili 候选以 BV 号作为 musicId，脏数据被过滤', () => {
  assert.deepEqual(
    mapBilibiliSongCandidate({
      id: 'BV1xx411c7mD', title: '告白气球', artist: '周杰伦', cover: '//i0.hdslb.com/x.jpg', duration: 215
    }),
    {
      platform: 'bilibili',
      musicId: 'BV1xx411c7mD',
      title: '告白气球',
      artist: '周杰伦',
      cover: 'https://i0.hdslb.com/x.jpg',
      durationSeconds: 215
    }
  )
  assert.equal(mapBilibiliSongCandidate({ title: '无 BV' }), null)
  assert.equal(
    normalizeAstrbotSongCandidates('bilibili', [
      { id: 'BV1', title: 't', artist: 'a', duration: 3 },
      { title: '脏数据' }
    ]).length,
    1
  )
})

test('票据结构校验：UMO 必须一致，候选数量与形状受限', () => {
  const candidates = [mapNativeSongCandidate('netease', { songmid: 1, name: 'x', singer: 'y', duration: 100 })!]
  assert.equal(isAstrbotSongTicket(ticketWith(candidates), UMO), true)
  // 跨会话使用同一条错误（票据里的 UMO 必须等于请求的 UMO）
  assert.equal(isAstrbotSongTicket(ticketWith(candidates), 'other:FriendMessage:1'), false)
  assert.equal(isAstrbotSongTicket(ticketWith([]), UMO), false)
  assert.equal(isAstrbotSongTicket(ticketWith(new Array(6).fill(candidates[0])), UMO), false)
  assert.equal(isAstrbotSongTicket(ticketWith(candidates, { platform: 'qq' }), UMO), false)
  assert.equal(isAstrbotSongTicket(ticketWith(candidates, { keyword: 1 }), UMO), false)
  assert.equal(isAstrbotSongTicket(ticketWith(candidates, { createdAt: 'now' }), UMO), false)
  assert.equal(
    isAstrbotSongTicket(ticketWith([{ platform: 'netease', musicId: 1, title: 'x', artist: 'y' } as any]), UMO),
    false
  )
  assert.equal(isAstrbotSongTicket(null, UMO), false)
  assert.equal(isAstrbotSongTicket('token', UMO), false)
})
