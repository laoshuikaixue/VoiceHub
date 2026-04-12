import crypto from 'crypto'

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
]

function getMixinKey(orig: string) {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n])
    .join('')
    .slice(0, 32)
}

/**
 * 获取 Bilibili WBI 签名所需的密钥
 */
export async function getBilibiliWbiKeys() {
  const resp: any = await $fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })
  
  if (!resp.data?.wbi_img) {
    throw new Error(`Failed to fetch wbi_img from bilibili: ${resp.message || resp.code}`)
  }

  const img_url = resp.data.wbi_img.img_url
  const sub_url = resp.data.wbi_img.sub_url
  const img_key = img_url.substring(img_url.lastIndexOf('/') + 1, img_url.lastIndexOf('.'))
  const sub_key = sub_url.substring(sub_url.lastIndexOf('/') + 1, sub_url.lastIndexOf('.'))
  
  return getMixinKey(img_key + sub_key)
}

/**
 * 使用 WBI 密钥对请求参数进行签名
 */
export function signBilibiliWbiRequest(params: Record<string, string | number>, wbiKey: string) {
  params['wts'] = Math.round(Date.now() / 1000)
  const query = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
  const w_rid = crypto.createHash('md5').update(query + wbiKey).digest('hex')
  return `${query}&w_rid=${w_rid}`
}