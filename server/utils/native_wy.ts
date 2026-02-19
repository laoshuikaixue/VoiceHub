import {
  createCipheriv,
  createDecipheriv,
  publicEncrypt,
  randomBytes,
  createHash,
  constants
} from 'node:crypto'

// --- 加密逻辑 ---
const eapiKey = 'e82ckenh8dichen8'

const aesEncrypt = (buffer: Buffer, mode: string, key: string | Buffer, iv: string | Buffer) => {
  const cipher = createCipheriv(mode, key, iv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

export const eapi = (url: string, object: any) => {
  const text = typeof object === 'object' ? JSON.stringify(object) : object
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = createHash('md5').update(message).digest('hex')
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`

  return {
    params: aesEncrypt(Buffer.from(data), 'aes-128-ecb', eapiKey, '').toString('hex').toUpperCase()
  }
}

// --- 请求逻辑 ---

export const wyEapiRequest = async (url: string, data: any) => {
  const form = eapi(url, data)

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
    origin: 'https://music.163.com',
    // 使用 LX Music 的默认 Cookie 或者空，视情况而定。LX Music 代码中有注释掉的 cookie，
    // 但 eapi 接口通常需要 cookie 才能正常工作，或者特定的 header。
    // 这里先尝试不带 cookie 或带基本 cookie。
    // 注意：lx-music 的 request.js 中有默认 header。
    'Content-Type': 'application/x-www-form-urlencoded'
  }

  // const body = new URLSearchParams(form).toString() // eapi 返回的是 { params: '...' }

  try {
    const response = await $fetch('http://interface.music.163.com/eapi/batch', {
      method: 'POST',
      headers,
      body: new URLSearchParams(form as any).toString(), // $fetch 自动处理 body，但这里明确一下
      responseType: 'json'
    })
    return response
  } catch (error) {
    console.error('WY Eapi Request Error:', error)
    throw error
  }
}
