/**
 * 将HTTP URL转换为HTTPS
 * @param url - 要转换的URL
 * @returns 转换后的HTTPS URL
 */
export const convertToHttps = (url: string | null | undefined): string => {
  if (!url) return url || ''
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://')
  }
  return url
}