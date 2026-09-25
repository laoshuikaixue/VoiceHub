import type { ColorVec3 } from '@applemusic-like-lyrics/core'

type AMLLCoreModule = typeof import('@applemusic-like-lyrics/core')

/**
 * 封面取色与歌词主题色
 * 依赖 AMLL 0.6.0 的调色板与色彩空间 API；core 由调用方懒加载后传入，
 * 避免本模块把 AMLL 的 WebGL 依赖带入 SSR 包
 */

/** 封面主色，供装饰性元素（当前行圆点、歌词底色 wash）使用 */
const COVER_ACCENT_VAR = '--main-cover-color'
/** 已按当前底色调整明度的歌词文字色 */
const COVER_LYRIC_COLOR_VAR = '--main-cover-lyric-color'

/** 取色聚类数，仅需主题色，过多会拖慢 K-Means */
const PALETTE_CLUSTER_COUNT = 5

/**
 * 歌词文字在深色底上的目标明度（CIELAB L*）
 * 取接近白的亮度：歌词层此前一直是纯白，压低会直接看不清
 */
const LYRIC_L_STAR_ON_DARK = 98
/** 歌词文字在浅色底上的目标明度 */
const LYRIC_L_STAR_ON_LIGHT = 30
/** 歌词文字保留的封面彩度比例，只留很淡的色相，避免整片歌词变成浑浊的封面色 */
const LYRIC_CHROMA_SCALE = 0.25

/** 输出为 CSS rgb()/rgba() 可拼接的逗号形式，兼容 rgba(var(--x), .14) 用法 */
const toCssTriple = (rgb: readonly number[]): string =>
  rgb
    .slice(0, 3)
    .map((value) => Math.round(Math.min(255, Math.max(0, value))))
    .join(', ')

/**
 * 由封面主色派生歌词文字色
 * 明度固定按当前底色取接近白或足够深的值，彩度按比例压到很低，
 * 既不随封面亮度波动而看不清，也不会整片染上封面色
 */
const resolveReadableCoverColor = (
  core: AMLLCoreModule,
  rgb: ColorVec3,
  surfaceIsDark: boolean
): ColorVec3 => {
  const lab = core.rgbToLab(rgb)
  const lStar = surfaceIsDark ? LYRIC_L_STAR_ON_DARK : LYRIC_L_STAR_ON_LIGHT
  return core.labToRgb([lStar, lab[1] * LYRIC_CHROMA_SCALE, lab[2] * LYRIC_CHROMA_SCALE])
}

/**
 * 从封面计算歌词主题色
 * @param image 已按 CORS 匿名方式加载完成的封面 img 元素
 * @param surfaceIsDark 当前主题底色是否为深色
 * @returns CSS 变量值，取色失败时返回 null
 */
export const extractCoverTheme = (
  core: AMLLCoreModule,
  image: HTMLImageElement,
  surfaceIsDark: boolean
): { accent: string; lyricColor: string } | null => {
  try {
    const { themeColor } = core.createPaletteFromImage(image, PALETTE_CLUSTER_COUNT)
    return {
      accent: toCssTriple(themeColor.color),
      lyricColor: toCssTriple(resolveReadableCoverColor(core, themeColor.color, surfaceIsDark))
    }
  } catch (error) {
    // 封面尺寸过小 / 画布被污染等，回退到各使用处的 CSS 静态兜底色
    console.warn('[coverTheme] 封面取色失败:', error)
    return null
  }
}

const COVER_VARS = [COVER_ACCENT_VAR, COVER_LYRIC_COLOR_VAR]

/** 把封面主题色写入根节点；传 null 时清除以便回退到静态兜底 */
export const applyCoverTheme = (theme: ReturnType<typeof extractCoverTheme> | null) => {
  const root = document.documentElement
  if (!theme) {
    COVER_VARS.forEach((name) => root.style.removeProperty(name))
    return
  }
  root.style.setProperty(COVER_ACCENT_VAR, theme.accent)
  root.style.setProperty(COVER_LYRIC_COLOR_VAR, theme.lyricColor)
}
