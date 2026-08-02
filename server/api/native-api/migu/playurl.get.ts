function upgradeUrl(url: string, quality: string){
  switch (quality) {
    case 'HQ':
      return url.replace('MP3_128_16_Stero', 'MP3_320_16_Stero')
    case 'SQ':
      url = url.replace('%E6%A0%87%E6%B8%85%E9%AB%98%E6%B8%85/MP3_128_16_Stero', '%E6%AD%8C%E6%9B%B2%E4%B8%8B%E8%BD%BD/flac');
      return url.replace('mp3', 'flac');
    case 'ZQ':
    case 'ZQ24':
      url = url.replace('%E6%A0%87%E6%B8%85%E9%AB%98%E6%B8%85/MP3_128_16_Stero', '%E6%AD%8C%E6%9B%B2%E4%B8%8B%E8%BD%BD/flac_24bit');
      return url.replace('mp3', 'flac');
    case 'PQ':
    default:
      return url
  }
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
  const toneFlag = encodeURIComponent((query.toneFlag as string) || 'PQ');

  if (!contentId) throw createError({ statusCode: 400, message: 'Missing contentId' });

  try {
    const headers = {
      'birth': 'h5page',
      'channel': '014X031',
      'Referer': 'https://y.migu.cn/',
      'location-data': '30.6698676660,104.1229614820',
      'location-info': '',
    }, baseUrl = 'http://c.musicapp.migu.cn', strategyU = '/listen-url/h5',
    params = `contentId=${contentId}&copyrightId=&resourceType=2&netType=01&toneFlag=PQ&scene=&lowerQualityContentId=${contentId}`;
    const res = await fetch(
      `${baseUrl}/strategy${strategyU}/v2.4?${params}`
      ,{headers}
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const ab = await res.arrayBuffer(), data = await mr(ab);
    // 保留完整 URL（含 Tim/Key/playSessionId 签名参数），并统一为 https 避免混合内容拦截
    let url = (data?.data?.url || '').replace(/^http:\/\//, 'https://')
    url = url.split('?')[0];
    url = upgradeUrl(url, toneFlag)

    if (!url) {
      return {
        success: false,
        url: '',
        source: 'migu'
      }
    }

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