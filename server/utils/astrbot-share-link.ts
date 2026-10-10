/**
 * 分享链接解析：把用户粘贴的网易云/QQ音乐/B站分享文本解析为统一候选。
 *
 * 解析规则（纯函数，无网络）：
 * - 从文本中提取 URL（含短链域名）；
 * - 按域名路由到对应音源平台；
 * - 从 URL 提取歌曲 ID（网易云 song?id=、QQ 音乐 songDetail/<mid>、B站 BV 号）。
 */

/** 分享文本里可识别的音乐链接域名 → 平台键。 */
const SHARE_LINK_HOSTS: { pattern: RegExp; platform: 'netease' | 'tencent' | 'bilibili' }[] = [
  { pattern: /(?:^|\/\/|\.)(?:music\.163\.com|163cn\.tv)(?:[/?#]|$)/, platform: 'netease' },
  { pattern: /(?:^|\/\/|\.)(?:y\.qq\.com|i\.y\.qq\.com|c6\.y\.qq\.com)(?:[/?#]|$)/, platform: 'tencent' },
  { pattern: /(?:^|\/\/|\.)(?:b23\.tv|bilibili\.com)(?:[/?#]|$)/, platform: 'bilibili' }
]

/** 从任意文本中提取第一个 http(s) 链接。 */
export function extractShareUrl(text: unknown): string | null {
  const raw = String(text ?? '')
  const match = raw.match(/https?:\/\/[^\s"'<>「」【】，。；！？、]+/i)
  return match ? match[0] : null
}

/** 判断分享文本是否可路由到已知音源平台。 */
export function detectSharePlatform(text: unknown): 'netease' | 'tencent' | 'bilibili' | null {
  const raw = String(text ?? '')
  for (const { pattern, platform } of SHARE_LINK_HOSTS) {
    if (pattern.test(raw)) return platform
  }
  return null
}

/** 从网易云链接提取歌曲 ID（song?id= 或 /song/123）。 */
export function extractNeteaseSongId(url: string): string | null {
  const byQuery = url.match(/[?&]id=(\d+)/)
  if (byQuery) return byQuery[1]
  const byPath = url.match(/\/song\/(\d+)/)
  return byPath ? byPath[1] : null
}

/** 从 QQ 音乐链接提取歌曲标识（songDetail/<mid> 或 songid=）。 */
export function extractTencentSongId(url: string): string | null {
  const byQuery = url.match(/[?&]songid=([\w-]+)/i) ?? url.match(/[?&]songId=([\w-]+)/)
  if (byQuery) return byQuery[1]
  const byPath = url.match(/\/songDetail\/([\w-]+)/i) ?? url.match(/\/song\/([\w-]+)/i)
  return byPath ? byPath[1] : null
}

/** 从 B站链接提取 BV 号（b23.tv 短链没有 BV，由调用方跟随跳转后再取）。 */
export function extractBilibiliBvid(url: string): string | null {
  const byPath = url.match(/\/video\/(BV[\w]+)/i)
  if (byPath) return byPath[1]
  const byQuery = url.match(/[?&]bvid=(BV[\w]+)/i)
  return byQuery ? byQuery[1] : null
}

/** 是否短链域名（需要跟随跳转才能拿到歌曲标识）。 */
export function isShortLink(url: string): boolean {
  return /\/\/(?:163cn\.tv|b23\.tv)\//.test(url)
}
