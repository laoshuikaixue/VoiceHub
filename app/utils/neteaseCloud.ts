export interface NeteaseCloudFile {
  key: string
  downloadId: string
  aliases: string[]
  fileName: string
  format: string
  fileSize: number
  bitrate: number
  md5: string
}

const id = (value: unknown) => /^\d+$/.test(String(value ?? '')) ? String(value) : ''

export const cloudFileLabel = (file: NeteaseCloudFile) => [
  file.fileName || file.downloadId,
  file.format,
  file.fileSize > 0 ? `${(file.fileSize / 1024 / 1024).toFixed(1)} MB` : '',
  file.bitrate > 0 ? `${Math.round(file.bitrate > 10000 ? file.bitrate / 1000 : file.bitrate)} kbps` : ''
].filter(Boolean).join(' · ')

/** 云盘记录的 songId 用于下载；曲库关联 ID 仅用于匹配。 */
export function normalizeCloudFile(record: any): NeteaseCloudFile | null {
  const pc = record?.simpleSong?.pc || record?.privateCloud || record?.pc || {}
  const downloadId = id(record?.songId)
  if (!downloadId) return null
  const md5 = String(record.md5 || pc.md5 || '').toLowerCase()
  const fileName = String(record.fileName || pc.fileName || '')
  return {
    key: `${downloadId}:${md5}`,
    downloadId,
    aliases: [...new Set([downloadId, record.simpleSong?.id, pc.songId, pc.id, pc.originalAudioSongId].map(id).filter(Boolean))],
    fileName,
    format: (fileName.match(/\.([a-z0-9]+)$/i)?.[1] || '').toUpperCase(),
    fileSize: Number(record.fileSize || pc.fileSize) || 0,
    bitrate: Number(record.bitrate || pc.bitrate) || 0,
    md5
  }
}

export function matchCloudFiles(files: NeteaseCloudFile[], musicId: string | number, rawItem?: any) {
  // 显式云盘身份先于关联曲库 ID，不能把用户选定的文件替换为同歌的其他上传版本。
  const pc = rawItem?.pc || rawItem?.simpleSong?.pc
  const privateId = id(pc?.originalAudioSongId || pc?.id)
  const exact = privateId && files.filter(file => file.aliases.includes(privateId))
  return exact && exact.length ? exact : files.filter(file => file.aliases.includes(String(musicId)))
}

export function validateCloudDownload(response: any, file: NeteaseCloudFile) {
  // 下载接口返回顶层 url/size；兼容网关包装的 data 结构。
  const data = response?.data || response
  const format = String(data?.type || String(data?.name || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toUpperCase()
  const validation = {
    code: response?.code,
    hasUrl: !!data?.url,
    responseFields: Object.keys(response || {}),
    dataFields: data && typeof data === 'object' ? Object.keys(data) : [],
    md5Matches: !file.md5 || !data?.md5 || file.md5 === String(data.md5).toLowerCase(),
    sizeMatches: !file.fileSize || !(Number(data?.size) > 0) || file.fileSize === Number(data.size),
    formatMatches: !file.format || !format || file.format === format
  }
  if (response?.code !== 200 || !data?.url || !/^https?:\/\//i.test(data.url)) {
    throw Object.assign(new Error('云盘未返回原文件链接'), { cloudValidation: validation })
  }
  if ((file.md5 && data.md5 && file.md5 !== String(data.md5).toLowerCase()) ||
      (file.fileSize && Number(data.size) > 0 && file.fileSize !== Number(data.size)) ||
      (file.format && format && file.format !== format)) {
    throw Object.assign(new Error('云盘下载文件身份不匹配'), { cloudValidation: validation })
  }
  return String(data.url).replace(/^http:\/\//, 'https://')
}

/** 账号切换后旧请求只能返回给旧调用方，不能覆盖新账号的缓存。 */
export function createCloudLibrary(fetchPage: (offset: number, session: string) => Promise<any>, now: () => number) {
  let session = ''
  let epoch = 0
  let files: NeteaseCloudFile[] | null = null
  let expires = 0
  let inflight: Promise<NeteaseCloudFile[]> | null = null
  const reset = (nextSession = '') => {
    session = nextSession
    epoch++
    files = null
    expires = 0
    inflight = null
  }
  const load = (nextSession: string) => {
    if (nextSession !== session) reset(nextSession)
    if (files && expires > now()) return Promise.resolve(files)
    if (inflight) return inflight
    const generation = epoch
    const task = (async () => {
      const records = new Map<string, NeteaseCloudFile>()
      let offset = 0
      for (;;) {
        const page = await fetchPage(offset, nextSession)
        if (page?.code !== 200 || !Array.isArray(page.data)) throw new Error('无法读取云盘')
        for (const record of page.data) {
          const file = normalizeCloudFile(record)
          if (file) records.set(file.key, file)
        }
        const more = page.hasMore === true || (Number(page.count) > offset + page.data.length)
        if (!more) break
        if (!page.data.length || offset > 1000000) throw new Error('云盘分页无效')
        offset += page.data.length
      }
      const result = [...records.values()]
      if (generation === epoch) { files = result; expires = now() + 5 * 60 * 1000 }
      return result
    })()
    inflight = task
    void task.finally(() => { if (generation === epoch) inflight = null }).catch(() => {})
    return task
  }
  return { load, reset }
}
