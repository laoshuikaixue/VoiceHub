import { useAudioQuality } from '~/composables/useAudioQuality'

/**
 * 动态获取音乐播放URL
 * @param platform 音乐平台 ('netease' | 'tencent')
 * @param musicId 音乐ID
 * @returns Promise<string | null> 返回播放URL或null
 */
export async function getMusicUrl(platform: string, musicId: string | number): Promise<string | null> {
  const { getQuality } = useAudioQuality()

  try {
    let apiUrl: string
    const quality = getQuality(platform)

    if (platform === 'netease') {
      apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
    } else if (platform === 'tencent') {
      apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
    } else {
      throw new Error('不支持的音乐平台')
    }

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error('获取音乐URL失败')
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

    return null
  } catch (error) {
    console.error('获取音乐URL错误:', error)
    throw error
  }
}