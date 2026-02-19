export const sizeFormate = (limit: number) => {
  if (limit === null || limit === undefined) return ''
  let size = ''
  if (limit < 0.1 * 1024) {
    // 小于0.1KB，则转化成B
    size = limit.toFixed(2) + 'B'
  } else if (limit < 0.1 * 1024 * 1024) {
    // 小于0.1MB，则转化成KB
    size = (limit / 1024).toFixed(2) + 'KB'
  } else if (limit < 0.1 * 1024 * 1024 * 1024) {
    // 小于0.1GB，则转化成MB
    size = (limit / (1024 * 1024)).toFixed(2) + 'MB'
  } else {
    // 其他转化成GB
    size = (limit / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
  }

  const sizeStr = size + '' // 转成字符串
  const len = sizeStr.indexOf('.')
  const dec = sizeStr.substr(len + 1, 2)
  if (dec === '00') {
    // 当小数点后为00时 去掉小数部分
    return sizeStr.substring(0, len) + sizeStr.substr(len + 3, 2)
  }
  return sizeStr
}

export const formatPlayTime = (time: number) => {
  let m: any = parseInt(String(time / 60))
  let s: any = parseInt(String(time % 60))
  m = m === 0 ? '00' : m < 10 ? '0' + m : m
  s = s === 0 ? '00' : s < 10 ? '0' + s : s
  return m + ':' + s
}

export const decodeName = (str: string | null = '') => {
  if (!str) return ''
  // 简单的 HTML 实体解码
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#039;': "'"
  }
  return str.replace(/&amp;|&lt;|&gt;|&quot;|&apos;|&#039;/g, (match) => entities[match] || match)
}
