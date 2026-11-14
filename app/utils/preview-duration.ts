/** 试听片段判定：实际时长低于歌曲时长的比例阈值 */
export const PREVIEW_SHORTFALL_RATIO = 0.8
/** 试听片段判定：实际时长与歌曲时长相差的秒数下限 */
export const PREVIEW_SHORTFALL_SECONDS = 30
/** 只有达到该时长的歌曲才参与试听判定，避免短音频误判 */
export const PREVIEW_MIN_EXPECTED_SECONDS = 120
/** 已知会返回试听片段的平台，解析门禁仅对这些平台预检 */
export const PREVIEW_PRONE_PLATFORMS: readonly string[] = ['tencent', 'netease']
/** 元数据探测默认超时 */
export const AUDIO_PROBE_TIMEOUT_MS = 5000

/**
 * 播放地址是否只是试听片段：实际时长明显短于歌曲时长。
 * 期望时长未知（0/NaN）或不足 2 分钟时不判定。
 */
export function isPreviewClipDuration(
  actualSeconds: unknown,
  expectedSeconds: unknown
): boolean {
  const actual = Number(actualSeconds)
  const expected = Number(expectedSeconds)
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false
  if (actual <= 0 || expected < PREVIEW_MIN_EXPECTED_SECONDS) return false
  return (
    actual < expected * PREVIEW_SHORTFALL_RATIO &&
    expected - actual > PREVIEW_SHORTFALL_SECONDS
  )
}

/** 时长归一化：大于 10000 的数值视为毫秒 */
export function normalizeDurationSeconds(value: unknown): number {
  const duration = Number(value || 0)
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return duration > 10000 ? duration / 1000 : duration
}

/** 从歌曲元信息提取期望时长（秒），兼容数据库歌曲行与搜索结果 */
export function getExpectedDurationSeconds(musicInfo?: {
  duration?: unknown
  rawItem?: { durationSeconds?: unknown; duration?: unknown } | null
} | null): number {
  const raw = musicInfo?.rawItem
  return normalizeDurationSeconds(raw?.durationSeconds ?? raw?.duration ?? musicInfo?.duration)
}

/**
 * 读取音频元数据时长（秒）：仅加载 metadata，超时返回 0，解码/加载错误返回 -1。
 * 依赖浏览器 Audio，只能在客户端调用。
 */
export function probeAudioDuration(src: string, timeoutMs = AUDIO_PROBE_TIMEOUT_MS): Promise<number> {
  if (!src) return Promise.resolve(0)
  return new Promise((resolve) => {
    const audio = new Audio()
    let settled = false
    const cleanup = () => {
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.src = ''
      audio.load()
    }
    const finish = (duration = 0) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      cleanup()
      resolve(duration)
    }
    const timeoutId = setTimeout(() => finish(0), timeoutMs)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(audio.duration)
    audio.onerror = () => finish(-1)
    audio.src = src
  })
}

/**
 * 预检播放地址是否应跳过：试听片段或无法解码的候选返回 true；
 * 期望时长未知或探测超时保守返回 false，不阻塞播放。
 */
export async function isPreviewAudioUrl(
  url: string,
  expectedSeconds: number,
  timeoutMs = AUDIO_PROBE_TIMEOUT_MS
): Promise<boolean> {
  if (!url || !(expectedSeconds >= PREVIEW_MIN_EXPECTED_SECONDS)) return false
  const actual = await probeAudioDuration(url, timeoutMs)
  if (actual < 0) return true
  return isPreviewClipDuration(actual, expectedSeconds)
}
