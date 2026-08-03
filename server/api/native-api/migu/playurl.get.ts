// 将 PQ 基础链接的路径替换为高音质资源路径
function upgradeUrl(url: string, quality: string) {
  let upgraded = url
  switch (quality) {
    case 'HQ':
      upgraded = url.replace('MP3_128_16_Stero', 'MP3_320_16_Stero')
      break
    case 'SQ':
      upgraded = url.replace('标清高清/MP3_128_16_Stero', '歌曲下载/flac').replace('.mp3', '.flac')
      break
    case 'ZQ':
    case 'ZQ24':
      upgraded = url.replace('标清高清/MP3_128_16_Stero', '歌曲下载/flac_24bit').replace('.mp3', '.flac')
      break
    case 'PQ':
    default:
      return url
  }
  // 路径片段未命中时替换不生效，实际仍为基础音质，记录日志便于排查
  if (upgraded === url) {
    console.warn(`[migu/playurl.get] 音质升级未命中（目标 ${quality}），回退为基础音质链接`)
  }
  return upgraded
}

function strToUtf8Bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

function utf8Bytes2str(bs: Uint8Array): string {
  const a: string[] = []
  for (const b of bs) {
    if (b < 16) {
      a.push(String.fromCharCode(b))
    } else { 
      a.push('%'); a.push(b.toString(16));
    }
  }; return decodeURIComponent(a.join(''))
}

function decode(e: Uint8Array, t: string) {
  if (0 == t.length) return null;
  var n = e.length;
  if (n < 4) return null;
  if (171 != e[0] || 205 != e[1]) return null;
  if (1 != e[2]) return null;
  for (var r = e[3], o = strToUtf8Bytes(t), a = o.length, i = new Uint8Array(n - 4), s = 0, c = 4; c < n; c++, s++) 
    // @ts-ignore
    i[s] = e[c] + r - o[s % a];
  return i
}

async function mr(ab: ArrayBuffer): Promise<any> {
  const u8 = new Uint8Array(ab), dd = decode(u8, 'Jk8qzuePiJ1qE3mDYhLQ3T73DtDoAhLP')
  if (!dd) throw new Error('解密失败')
  const j = utf8Bytes2str(dd)
  return JSON.parse(j)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const contentId = query.contentId as string;
  // 白名单校验，非法值回退为基础音质
  const VALID_TONE_FLAGS = ['PQ', 'HQ', 'SQ', 'ZQ', 'ZQ24']
  const toneFlag = VALID_TONE_FLAGS.includes(query.toneFlag as string) ? (query.toneFlag as string) : 'PQ';

  if (!contentId) throw createError({ statusCode: 400, message: 'Missing contentId' });

  try {
    const headers = {
      'birth': 'h5page',
      'channel': '014X031',
      'Referer': 'https://y.migu.cn/',
      'location-data': '30.6698676660,104.1229614820',
      'location-info': '',
    }, baseUrl = 'http://c.musicapp.migu.cn', strategyU = '/listen-url/h5',
    // 匿名请求上游仅提供基础音质，固定以 PQ 取链后再本地升级路径
    params = `contentId=${contentId}&copyrightId=&resourceType=2&netType=01&toneFlag=PQ&scene=&lowerQualityContentId=${contentId}`;
    const res = await fetch(
      `${baseUrl}/strategy${strategyU}/v2.4?${params}`
      ,{headers}
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const ab = await res.arrayBuffer(), data = await mr(ab);
    let url = decodeURIComponent(data?.data?.url ?? '');
    if (!url) {
      return {
        success: false,
        url: '',
        source: 'migu'
      }
    }
    // 移除查询参数后统一为 https 避免混合内容拦截，再按请求音质升级路径
    url = (url.split('?')[0] as string).replace(/^http:\/\//, 'https://');
    url = upgradeUrl(url, toneFlag)

    return {
      success: true,
      url,
      source: 'migu'
    }
  } catch (err: any) {
    console.error('[migu/playurl.get] 获取播放链接失败:', err)
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Internal Server Error'
    })
  }
})