import {useAudioQuality} from '~/composables/useAudioQuality'
import {useMusicSources} from '~/composables/useMusicSources'

/**
 * 动态获取音乐播放URL
 * @param platform 音乐平台 ('netease' | 'tencent')
 * @param musicId 音乐ID
 * @param playUrl 用户提供的播放链接（可选）
 * @returns Promise<string | null> 返回播放URL或null
 */
export async function getMusicUrl(platform: string, musicId: string | number, playUrl?: string): Promise<string | null> {
    // 如果用户提供了播放链接，优先使用
    if (playUrl && playUrl.trim()) {
        console.log(`[getMusicUrl] 使用用户提供的播放链接: ${playUrl}`)
        return playUrl.trim()
    }

    // 如果没有playUrl，但platform或musicId为空或无效，则无法获取播放链接
    if (!platform || !musicId || platform === 'unknown' || platform === '' || musicId === null || musicId === '') {
        console.warn(`[getMusicUrl] 缺少必要参数: platform=${platform}, musicId=${musicId}`)
        throw new Error('缺少音乐平台或音乐ID信息')
    }

    const {getQuality} = useAudioQuality()
    const {getSongUrl} = useMusicSources()

    try {
        const quality = getQuality(platform)

        // 先使用统一组件的 NeteaseCloudMusicApi（仅网易云）
        if (platform === 'netease') {
            console.log(`[getMusicUrl] 先使用 NeteaseCloudMusicApi 获取播放链接: ${musicId}`)
            const backupResult = await getSongUrl(Number(musicId), quality)
            if (backupResult.success && backupResult.url) {
                console.log(`[getMusicUrl] NeteaseCloudMusicApi 成功获取播放链接`)
                return backupResult.url
            }
            console.warn(`[getMusicUrl] 备用源未返回有效链接，回退到 vkeys`)
        }

        // 回退到 vkeys
        let apiUrl: string
        if (platform === 'netease') {
            apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
        } else if (platform === 'tencent') {
            apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
        } else {
            throw new Error('不支持的音乐平台')
        }

        console.log(`[getMusicUrl] 使用 vkeys API 获取播放链接: ${platform}, ${musicId}`)

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
            console.log(`[getMusicUrl] vkeys API成功获取播放链接`)
            return url
        }

        // vkeys API返回了响应但没有有效的播放链接
        console.warn(`[getMusicUrl] vkeys API响应无效:`, data)
        throw new Error('vkeys API返回的播放链接无效')

    } catch (error) {
        console.error(`[getMusicUrl] 获取播放链接失败:`, error)
        throw error
    }
}