/**
 * 歌曲类型（语种/曲风）解析工具
 * 语种/曲风仅在网易云与 QQ 音源可判定：网易云取歌曲百科（song_wiki_info），
 * QQ 取详情接口 info.lan / info.genre 官网分类名（track_info 数值码兜底）
 * 其他平台或无 musicId 的投稿一律返回 null（不参与类型黑名单匹配）
 */
import {
  QQ_LANGUAGE_CODE_MAP,
  QQ_GENRE_NAME_MAP,
  BLACKLIST_LANGUAGE_VALUES,
  BLACKLIST_GENRE_VALUES
} from '../config/constants.ts'
import {
  createTxSongDetailBody,
  normalizeTxMusicId,
  txRequest,
  TX_MUSICU_URL
} from './native_tx.ts'

export type SongTypes = {
  languages: string[]
  genres: string[]
}

// 主要语种集合（不含「其他」），用于「其他」黑名单值的兜底匹配
const KNOWN_LANGUAGES = new Set(
  BLACKLIST_LANGUAGE_VALUES.filter((value) => value !== '其他')
)

// 主要曲风一级分类集合（不含「其他」）
const KNOWN_GENRES = new Set(
  BLACKLIST_GENRE_VALUES.filter((value) => value !== '其他')
)

// 网易云语种同义词归一（存储值口径见 constants 的 BLACKLIST_LANGUAGE_VALUES）
const LANGUAGE_ALIASES: Record<string, string> = {
  国语: '华语',
  普通话: '华语'
}

// 语种文本拆分（网易云多语种以「、」等分隔，如「英语、韩语」）
export const normalizeLanguageLabels = (text: unknown): string[] => {
  if (!text) return []
  return String(text)
    .split(/[、,，;；/\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => LANGUAGE_ALIASES[part] ?? part)
}

// 解析网易云歌曲百科响应（data.blocks[].rnData.blocks[].blockInfo.wikiSubElementVos）
export const parseNeteaseWikiTypes = (payload: any): SongTypes => {
  const result: SongTypes = { languages: [], genres: [] }
  const blocks = payload?.data?.blocks
  if (!Array.isArray(blocks)) return result
  for (const outer of blocks) {
    const innerBlocks = outer?.rnData?.blocks
    if (!Array.isArray(innerBlocks)) continue
    for (const inner of innerBlocks) {
      const items = inner?.blockInfo?.wikiSubElementVos
      if (!Array.isArray(items)) continue
      for (const item of items) {
        if (item?.title === '语种' && typeof item.content === 'string') {
          result.languages.push(...normalizeLanguageLabels(item.content))
        } else if (item?.title === '曲风' && Array.isArray(item.wikiSubMetaVos)) {
          for (const meta of item.wikiSubMetaVos) {
            if (typeof meta?.text === 'string' && meta.text.trim()) {
              result.genres.push(meta.text.trim())
            }
          }
        }
      }
    }
  }
  return { languages: [...new Set(result.languages)], genres: [...new Set(result.genres)] }
}

// QQ 语种数字码 → 黑名单语种值（未收录码返回 null）
export const mapQqLanguage = (code: unknown): string | null => {
  const normalized = Number(code)
  if (!Number.isInteger(normalized)) return null
  return QQ_LANGUAGE_CODE_MAP[normalized] ?? null
}

// 解析 QQ 歌曲详情响应（data.info.lan / data.info.genre 官网分类名 + track_info 数值码兜底）
// 流派英文名仅映射候选曲风，已判定但未收录的流派名归「其他」；无法判定返回空数组（放行）
export const parseTencentSongTypes = (payload: any): SongTypes => {
  const result: SongTypes = { languages: [], genres: [] }
  const data = payload?.req?.data ?? payload?.data
  if (!data) return result

  // 语种：info.lan 官网中文分类名优先，缺失时回退 track_info.language 数值码
  const lanValues = Array.isArray(data.info?.lan?.content)
    ? data.info.lan.content
        .map((item: any) => normalizeLanguageLabels(typeof item?.value === 'string' ? item.value.trim() : ''))
        .flat()
    : []
  if (lanValues.length > 0) {
    result.languages = lanValues
  } else {
    const language = mapQqLanguage(data.track_info?.language)
    const rawCode = data.track_info?.language
    // 已判定为整数但未收录的语种码归入「其他」；缺失/非整数视为无法判定
    if (language) {
      result.languages = [language]
    } else if (
      rawCode !== null &&
      rawCode !== undefined &&
      rawCode !== '' &&
      Number.isInteger(Number(rawCode))
    ) {
      result.languages = ['其他']
    }
  }

  // 曲风：info.genre 官网英文分类名
  const genreValues = Array.isArray(data.info?.genre?.content) ? data.info.genre.content : []
  for (const item of genreValues) {
    if (typeof item?.value !== 'string' || !item.value.trim()) continue
    const mapped = QQ_GENRE_NAME_MAP[item.value.trim()]
    result.genres.push(mapped || '其他')
  }

  return { languages: [...new Set(result.languages)], genres: [...new Set(result.genres)] }
}

// 网易云曲风为「一级-二级」结构，取一级分类
const genrePrimary = (genre: string): string => String(genre || '').split('-')[0]?.trim() ?? ''

// 曲风匹配：「其他」命中已判定但一级分类不在候选列表内的曲风；其余按一级分类匹配
export const matchBlacklistGenre = (value: string, genres: string[]): boolean => {
  const target = String(value || '').trim()
  if (!target) return false
  if (target === '其他') {
    return genres.some((genre) => {
      const primary = genrePrimary(genre)
      return !!primary && !KNOWN_GENRES.has(primary)
    })
  }
  return genres.some((genre) => {
    const primary = genrePrimary(genre)
    return !!primary && (primary === target || primary.includes(target))
  })
}

// 语种匹配：「其他」命中已判定但不属于主要候选值的语种（小语种）；其余按精确匹配
export const matchBlacklistLanguage = (value: string, languages: string[]): boolean => {
  const target = String(value || '').trim()
  if (!target) return false
  if (target === '其他') {
    return languages.some((lang) => !!lang && !KNOWN_LANGUAGES.has(lang))
  }
  return languages.includes(target)
}

// 网易云增强 API 模块懒加载与配置初始化（模块级防并发）
let neteaseApiPromise: Promise<any> | null = null
let ncmConfigReady = false
let ncmConfigPromise: Promise<void> | null = null

const getNeteaseApi = async (): Promise<any> => {
  if (!neteaseApiPromise) {
    neteaseApiPromise = import('@neteasecloudmusicapienhanced/api').then((mod) => mod.default || mod)
  }
  return neteaseApiPromise
}

const ensureNcmConfig = async (): Promise<void> => {
  if (ncmConfigReady) return
  if (!ncmConfigPromise) {
    ncmConfigPromise = import('@neteasecloudmusicapienhanced/api/generateConfig.js')
      .then((mod) => (mod.default || mod)())
      .then(() => {
        ncmConfigReady = true
      })
      .catch((error: unknown) => {
        console.error('[song-type-resolver] xeapi 配置初始化失败:', error)
      })
      .finally(() => {
        ncmConfigPromise = null
      })
  }
  await ncmConfigPromise
}

const fetchNeteaseTypes = async (songId: string): Promise<SongTypes | null> => {
  try {
    const api: any = await getNeteaseApi()
    if (typeof api.song_wiki_info !== 'function') return null
    await ensureNcmConfig()
    const result: any = await api.song_wiki_info({ id: songId })
    const payload = result?.body ?? result
    if (payload?.code !== 200) return null
    return parseNeteaseWikiTypes(payload)
  } catch (error: any) {
    console.warn('[song-type-resolver] 网易云百科获取失败:', error?.message || error)
    return null
  }
}

const fetchTencentTypes = async (musicId: string): Promise<SongTypes | null> => {
  try {
    const normalized = normalizeTxMusicId(musicId)
    const result: any = await txRequest(TX_MUSICU_URL, createTxSongDetailBody(normalized))
    return parseTencentSongTypes(result)
  } catch (error: any) {
    console.warn('[song-type-resolver] QQ音乐详情获取失败:', error?.message || error)
    return null
  }
}

// 解析歌曲类型；平台不支持、无 musicId 或外部接口失败时返回 null（类型黑名单放行）
export const resolveSongTypes = async (
  musicPlatform: string | null | undefined,
  musicId: string | null | undefined
): Promise<SongTypes | null> => {
  const platform = String(musicPlatform || '').trim()
  const id = String(musicId || '').trim()
  if (!id || (platform !== 'netease' && platform !== 'tencent')) return null
  return platform === 'netease' ? fetchNeteaseTypes(id) : fetchTencentTypes(id)
}
