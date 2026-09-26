/**
 * 机器人点歌的搜索适配层。
 *
 * 与上游音源的对接放在 astrbot-song-sources.ts，本文件只负责：
 * - 音源键与关键词/序号的规范化（供端点与测试直接调用，纯函数、无网络）；
 * - 把各音源的上游条目映射为统一候选结构 SongCandidate；
 * - 把候选与发起会话（UMO）绑定成可校验的票据载荷。
 *
 * 上游实现按需动态载入，避免把音源 SDK（含 Nuxt 别名）拖进纯逻辑层。
 */

export const ASTRBOT_SONG_SOURCES = ['netease', 'tencent', 'migu', 'bilibili'] as const

export type AstrbotSongSource = typeof ASTRBOT_SONG_SOURCES[number]

/** 默认音源：缺省与站点搜索默认值保持一致（网易云音乐）。 */
export const DEFAULT_ASTRBOT_SONG_SOURCE: AstrbotSongSource = 'netease'

/** 关键词长度上限（trim 后）。 */
export const ASTRBOT_SONG_KEYWORD_MAX_LENGTH = 100

/** 单次搜索返回的候选上限，也是序号 index 的合法上界。 */
export const ASTRBOT_SONG_CANDIDATE_LIMIT = 5

/** 点歌票据用途，与站点其它密封票据（plugin ticket）按 purpose 隔离。 */
export const ASTRBOT_SONG_TICKET_PURPOSE = 'astrbot-song'

/** 点歌票据有效期：10 分钟，够用户看完列表再回复指令。 */
export const ASTRBOT_SONG_TICKET_TTL_MS = 600 * 1000

/** 各音源统一后的候选结构：端点只依赖这些字段。 */
export type SongCandidate = {
  platform: string
  musicId: string
  title: string
  artist: string
  cover: string | null
  durationSeconds: number | null
}

/** 搜索票据载荷：候选与发起会话、音源、关键词一起密封，防止序号被换绑。 */
export type AstrbotSongTicket = {
  umo: string
  platform: AstrbotSongSource
  keyword: string
  createdAt: number
  candidates: SongCandidate[]
}

/** 上游取数函数签名；默认实现按需载入音源层，测试可注入替身。 */
export type AstrbotSongSourceFetcher = (
  source: AstrbotSongSource,
  keyword: string,
  page: number
) => Promise<unknown>

export function parseAstrbotSongSource(value: unknown): AstrbotSongSource | null {
  return typeof value === 'string' && (ASTRBOT_SONG_SOURCES as readonly string[]).includes(value)
    ? value as AstrbotSongSource
    : null
}

function toText(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

/** 时长统一为「秒」的整数；缺失或非正数视为未知（站点侧允许 null）。 */
function toDurationSeconds(value: unknown) {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null
}

/**
 * 封面只接受可直接嵌入播放器的完整链接：
 * 协议相对地址（咪咕/哔哩哔哩常见）补全为 https，其余非法值一律置空。
 */
function toCoverUrl(value: unknown) {
  const raw = toText(value)
  if (!raw) return null
  if (raw.startsWith('//')) return `https:${raw}`
  return /^https?:\/\//i.test(raw) ? raw : null
}

/** 网易云/QQ 音乐/咪咕搜索结果转统一候选；缺 musicId 或标题的条目直接丢弃。 */
export function mapNativeSongCandidate(
  platform: AstrbotSongSource,
  item: unknown
): SongCandidate | null {
  if (platform === 'bilibili' || !item || typeof item !== 'object') return null
  const raw = item as Record<string, unknown>
  const musicId = toText(raw.songmid)
  const title = toText(raw.name)
  if (!musicId || !title) return null
  return {
    platform,
    musicId,
    title,
    artist: toText(raw.singer) || '未知艺术家',
    cover: toCoverUrl(raw.img),
    durationSeconds: toDurationSeconds(raw.duration)
  }
}

/** 哔哩哔哩搜索结果（biConvertSong 输出）转统一候选；musicId 取 BV 号。 */
export function mapBilibiliSongCandidate(item: unknown): SongCandidate | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as Record<string, unknown>
  const musicId = toText(raw.id)
  const title = toText(raw.title)
  if (!musicId || !title) return null
  return {
    platform: 'bilibili',
    musicId,
    title,
    artist: toText(raw.artist) || '未知艺术家',
    cover: toCoverUrl(raw.cover),
    durationSeconds: toDurationSeconds(raw.duration)
  }
}

/** 上游原始列表 → 统一候选；同时过滤脏数据并截断到上限。 */
export function normalizeAstrbotSongCandidates(
  platform: AstrbotSongSource,
  list: unknown
): SongCandidate[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => platform === 'bilibili'
      ? mapBilibiliSongCandidate(item)
      : mapNativeSongCandidate(platform, item))
    .filter((candidate): candidate is SongCandidate => candidate !== null)
    .slice(0, ASTRBOT_SONG_CANDIDATE_LIMIT)
}

function isSongCandidate(value: unknown): value is SongCandidate {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SongCandidate>
  return typeof candidate.platform === 'string' && parseAstrbotSongSource(candidate.platform) !== null &&
    typeof candidate.musicId === 'string' && candidate.musicId.length > 0 &&
    typeof candidate.title === 'string' && candidate.title.length > 0 &&
    typeof candidate.artist === 'string' &&
    (candidate.cover === null || typeof candidate.cover === 'string') &&
    (candidate.durationSeconds === null || typeof candidate.durationSeconds === 'number')
}

/**
 * 票据结构校验：票据必须属于当前会话（UMO 一致），候选数量与形状合规。
 * 解封成功但内容不符（例如换会话重放）时同样按「票据无效」处理。
 */
export function isAstrbotSongTicket(ticket: unknown, umo: string): ticket is AstrbotSongTicket {
  if (!ticket || typeof ticket !== 'object') return false
  const value = ticket as Partial<AstrbotSongTicket>
  if (value.umo !== umo) return false
  if (parseAstrbotSongSource(value.platform) === null) return false
  if (typeof value.keyword !== 'string' || !value.keyword) return false
  if (typeof value.createdAt !== 'number') return false
  if (!Array.isArray(value.candidates) || value.candidates.length === 0 ||
    value.candidates.length > ASTRBOT_SONG_CANDIDATE_LIMIT) return false
  return value.candidates.every(isSongCandidate)
}

/** 默认取数实现：按需载入音源层，避免纯逻辑层静态依赖 Nuxt 别名模块。 */
async function fetchFromSongSource(source: AstrbotSongSource, keyword: string, page: number) {
  const { fetchAstrbotSongSource } = await import('./astrbot-song-sources.ts')
  return await fetchAstrbotSongSource(source, keyword, page)
}

/**
 * 按音源搜索并把结果映射为统一候选。
 *
 * 上游失败、超时或返回空结果一律降级为空数组：第三方抖动不应让机器人回复 500。
 */
export async function searchSongs(
  platform: unknown,
  keyword: string,
  page: number,
  fetchSource: AstrbotSongSourceFetcher = fetchFromSongSource
): Promise<SongCandidate[]> {
  const source = parseAstrbotSongSource(platform)
  const normalizedKeyword = typeof keyword === 'string' ? keyword.trim() : ''
  if (!source || !normalizedKeyword) return []
  const safePage = Number.isInteger(page) && Number(page) > 0 ? Number(page) : 1

  try {
    return normalizeAstrbotSongCandidates(source, await fetchSource(source, normalizedKeyword, safePage))
  } catch (error) {
    console.warn('[astrbot-song] 音源搜索失败，按空候选降级:', error instanceof Error ? error.message : error)
    return []
  }
}
