// @neteasecloudmusicapienhanced/unblockmusic-utils 的边缘运行时（Cloudflare Workers 等）替代实现。
// 原包入口 index.js 是 Express 服务器、match.js 用 fs.readdirSync 动态加载模块，均无法在边缘打包/运行。
// 本文件用全局 fetch 等价重写 matchID 与全部 HTTP 类音源（bugpk/byfuns/ddyr/gdmusic/msls/oi/qijieya），
// 仅省略依赖 @unblockneteasemusic/server 的 unm 音源；解灰功能在边缘环境保持可用。
// 仅在 nitro preset 为 cloudflare 系时通过别名替换，node-server 部署仍使用原包（含 unm 音源）。

const brQuality = (withFlac, withoutFlac) =>
  process.env.DISABLE_FLAC === 'true' ? withoutFlac : withFlac

const fetchJson = async (url, init = {}) => {
  const response = await fetch(url, { redirect: 'follow', ...init })
  if (!response.ok) return { response, data: null }
  try {
    return { response, data: await response.json() }
  } catch {
    return { response, data: null }
  }
}

// 3xx 重定向即返回 Location 头作为音乐直链的音源通用处理
const fetchRedirectOrText = async (url) => {
  const response = await fetch(url, { redirect: 'manual' })
  const location = response.headers.get('location')
  if (location && location.startsWith('http')) return location
  if (!response.ok) return null
  const text = await response.text()
  const trimmed = text.trim()
  return trimmed.startsWith('http') ? trimmed : null
}

const sources = {
  async bugpk(id) {
    const { data } = await fetchJson(
      `https://api.bugpk.com/api/163_music?type=json&ids=${id}&quality=${brQuality('hires', 'standard')}`
    )
    return data?.url || null
  },
  async byfuns(id) {
    return fetchRedirectOrText(`https://api.byfuns.top/1/?id=${id}&level=${brQuality('lossless', 'exhigh')}`)
  },
  async ddyr(id) {
    const { data } = await fetchJson(
      `https://yy.zddyr.top/lx/api/?source=netease&songmid=${id}&quality=${brQuality('hires', 'standard')}`
    )
    return data?.url || null
  },
  async gdmusic(id) {
    const { data } = await fetchJson(
      `https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=${id}&br=${brQuality(999, 320)}`
    )
    return data && typeof data === 'object' ? data.url || null : null
  },
  async msls(id) {
    return fetchRedirectOrText(`https://api.msls1441.com/?type=url&id=${id}`)
  },
  async oi(id) {
    const { data } = await fetchJson(`https://oiapi.net/api/Music_163?id=${id}`)
    return data?.data?.[0]?.url || null
  },
  async qijieya(id) {
    return fetchRedirectOrText(`https://api.qijieya.cn/meting/?type=url&id=${id}`)
  }
}

// 音源遍历顺序与原包 readdirSync 结果一致（unm 除外）
const SOURCE_NAMES = ['bugpk', 'byfuns', 'ddyr', 'gdmusic', 'msls', 'oi', 'qijieya']

/**
 * 匹配歌曲ID并返回可用的音乐URL，返回结构与原包一致
 * @param {string} id - 网易云音乐歌曲ID
 * @param {string|null} source - 指定的音源模块名称（可选）
 */
export async function matchID(id, source = null) {
  if (!id) {
    return { code: 400, message: 'Missing id parameter', data: null }
  }

  if (source) {
    if (!sources[source]) {
      return { code: 404, message: `Module ${source} not found`, data: null }
    }
    try {
      const url = await sources[source](id)
      if (url) {
        return { code: 200, message: 'success', data: { url, source } }
      }
      return { code: 500, message: `No available source found from ${source}`, data: null }
    } catch (error) {
      return { code: 500, message: `Error from ${source}: ${error.message}`, data: null }
    }
  }

  for (const name of SOURCE_NAMES) {
    try {
      const url = await sources[name](id)
      if (url) {
        return { code: 200, message: 'success', data: { url, source: name } }
      }
    } catch {
      // 继续尝试下一个模块，与原包行为一致
      continue
    }
  }

  return { code: 500, message: 'No available source found', data: null }
}

export default { matchID }
