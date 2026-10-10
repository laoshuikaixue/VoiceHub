/**
 * 分享链接解析：把用户粘贴的网易云/QQ音乐/B站分享文本解析为统一候选。
 *
 * 解析规则（纯函数，无网络）：
 * - 从文本中提取 URL（含短链域名）；
 * - 按域名路由到对应音源平台；
 * - 从 URL 提取歌曲 ID（网易云 song?id=、QQ 音乐 songDetail/<mid>、B站 BV 号）。
 */

/** 已知音源域名 → 平台键（hostname 精确或子域匹配）。 */
const SHARE_LINK_HOSTS: { domain: string; platform: 'netease' | 'tencent' | 'bilibili' }[] = [
  { domain: 'music.163.com', platform: 'netease' },
  { domain: '163cn.tv', platform: 'netease' },
  { domain: 'y.qq.com', platform: 'tencent' },
  { domain: 'b23.tv', platform: 'bilibili' },
  { domain: 'bilibili.com', platform: 'bilibili' }
]

/** 需要跟随跳转才能拿到歌曲标识的入口域名（hostname 精确匹配）。 */
const SHORT_LINK_HOSTS = new Set(['163cn.tv', 'b23.tv', 'c6.y.qq.com'])

/** 从任意文本中提取第一个 http(s) 链接。 */
export function extractShareUrl(text: unknown): string | null {
  const raw = String(text ?? '')
  const match = raw.match(/https?:\/\/[^\s"'<>「」【】，。；！？、]+/i)
  return match ? match[0] : null
}

/** 解析 URL 的 hostname；非 http(s) 或非法 URL 返回 null。 */
function parseHttpHostname(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname.toLowerCase()
  } catch {
    return null
  }
}

/** 某个 hostname 归属的音源平台；未知返回 null。 */
function platformFromHostname(hostname: string): 'netease' | 'tencent' | 'bilibili' | null {
  for (const { domain, platform } of SHARE_LINK_HOSTS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return platform
  }
  return null
}

/** 判断分享文本是否可路由到已知音源平台（按首个链接的 hostname 判定，防路径伪造）。 */
export function detectSharePlatform(text: unknown): 'netease' | 'tencent' | 'bilibili' | null {
  const url = extractShareUrl(text)
  if (!url) return null
  const hostname = parseHttpHostname(url)
  return hostname ? platformFromHostname(hostname) : null
}

/** 从网易云链接提取歌曲 ID（song?id= 或 /song/123）。 */
export function extractNeteaseSongId(url: string): string | null {
  return url.match(/[?&]id=(\d+)/)?.[1] ??
    url.match(/\/song\/(\d+)/)?.[1] ??
    null
}

/** 从 QQ 音乐链接提取歌曲标识（songDetail/<mid>、songid= 或 songmid=）。 */
export function extractTencentSongId(url: string): string | null {
  return url.match(/[?&]song(?:id|mid)=([\w-]+)/i)?.[1] ??
    url.match(/\/songDetail\/([\w-]+)/i)?.[1] ??
    url.match(/\/song\/([\w-]+)/i)?.[1] ??
    null
}

/** 从 B站链接提取 BV 号（b23.tv 短链没有 BV，由调用方跟随跳转后再取）。 */
export function extractBilibiliBvid(url: string): string | null {
  return url.match(/\/video\/(BV[\w]+)/i)?.[1] ??
    url.match(/[?&]bvid=(BV[\w]+)/i)?.[1] ??
    null
}

/** 是否短链入口域名（hostname 精确匹配，需跟随跳转才能拿到歌曲标识）。 */
export function isShortLink(url: string): boolean {
  const hostname = parseHttpHostname(url)
  return hostname !== null && SHORT_LINK_HOSTS.has(hostname)
}

/** 短链跳转是否允许跟随：目标必须是 http(s) 且属于已知音源域名。 */
export function isTrustedShareHost(url: string): boolean {
  const hostname = parseHttpHostname(url)
  return hostname !== null && platformFromHostname(hostname) !== null
}
