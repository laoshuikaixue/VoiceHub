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
  const toneFlag = query.toneFlag as string || 'PQ';

  if (!contentId) throw createError({ statusCode: 400, message: 'Missing contentId' });

  try {
    const headers = {
      'birth': 'h5page',
      'channel': '014X031',
      'Referer': 'https://y.migu.cn/',
      'location-data': '30.6698676660,104.1229614820',
      'location-info': '',
    }, baseUrl = 'http://c.musicapp.migu.cn', strategyU = '/listen-url/h5',
    params = `contentId=${contentId}&copyrightId=&resourceType=2&netType=01&toneFlag=${toneFlag}&scene=&lowerQualityContentId=${contentId}`;
    const res = await fetch(
      `${baseUrl}/strategy${strategyU}/v2.4?${params}`
      ,{headers}
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const ab = await res.arrayBuffer(), data = await mr(ab);
    const url = (data?.data?.url || '')?.split('?')[0] || ''

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