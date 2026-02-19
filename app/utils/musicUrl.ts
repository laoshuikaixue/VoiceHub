import { useAudioQuality } from '~/composables/useAudioQuality'
import { useMusicSources } from '~/composables/useMusicSources'
import { parseBilibiliId } from '~/utils/bilibiliSource'

/**
 * 动态获取音乐播放URL
 * @param platform 音乐平台 ('netease' | 'tencent')
 * @param musicId 音乐ID
 * @param playUrl 用户提供的播放链接（可选）
 * @param options 额外选项，例如 { unblock: boolean }
 * @returns Promise<string | null> 返回播放URL或null
 */
export async function getMusicUrl(
  platform: string,
  musicId: string | number,
  playUrl?: string,
  options?: { unblock?: boolean }
): Promise<string | null> {
  // 如果用户提供了播放链接，优先使用
  if (playUrl && playUrl.trim()) {
    return playUrl.trim()
  }

  // 如果没有playUrl，但platform或musicId为空或无效，则无法获取播放链接
  if (
    !platform ||
    !musicId ||
    platform === 'unknown' ||
    platform === '' ||
    musicId === null ||
    musicId === ''
  ) {
    throw new Error('缺少音乐平台或音乐ID信息')
  }

  const { getQuality } = useAudioQuality()
  const { getSongUrl } = useMusicSources()

  const quality = getQuality(platform)

  let finalMusicId = musicId
  let bilibiliCid: string | undefined

  if (platform === 'bilibili') {
    const parsed = parseBilibiliId(musicId)
    finalMusicId = parsed.bvid
    bilibiliCid = parsed.cid
  }

  const extendedOptions = {
    ...options,
    bilibiliCid
  }

  // 先使用统一组件的音源选择逻辑
  const backupResult = await getSongUrl(
    finalMusicId,
    quality,
    platform,
    undefined,
    extendedOptions
  )
  if (backupResult.success && backupResult.url) {
    return backupResult.url
  }

  // 如果是 Bilibili 平台，且 getSongUrl 失败，则直接抛出错误
  if (platform === 'bilibili') {
    throw new Error(backupResult.error || '获取哔哩哔哩播放链接失败')
  }

  // 回退到 vkeys
  let apiUrl: string
  if (platform === 'netease' || platform === 'netease-podcast') {
    apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
  } else if (platform === 'tencent') {
    apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
  } else {
    throw new Error('不支持的音乐平台')
  }

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`vkeys API请求失败: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  if (data.code === 200 && data.data && data.data.url) {
    // 将HTTP URL改为HTTPS
    let url = data.data.url
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://')
    }
    return url
  }

  // vkeys API返回了响应但没有有效的播放链接
  throw new Error('vkeys API返回的播放链接无效')
}
