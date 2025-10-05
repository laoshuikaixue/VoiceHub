import {computed, ref} from 'vue'
import {useAudioQuality} from './useAudioQuality'

export const useAudioPlayerEnhanced = () => {
    const {getQuality, getQualityOptions, saveQuality} = useAudioQuality()

    // 使用全局通知函数
    const addNotification = (options) => {
        if (typeof window !== 'undefined' && window.$showNotification) {
            if (typeof options === 'string') {
                window.$showNotification(options, 'info')
            } else {
                window.$showNotification(options.message, options.type || 'info', true, options.duration || 3000)
            }
        } else {
            console.log('通知:', options.message || options)
        }
    }

    const retryCount = ref(0)
    const maxRetries = ref(3)
    const isRetrying = ref(false)
    const qualitySwitchAttempted = ref(false)

    // 重置重试状态
    const resetRetryState = () => {
        retryCount.value = 0
        isRetrying.value = false
        qualitySwitchAttempted.value = false
    }

    // 获取音乐链接
    const getMusicUrl = async (platform, musicId, quality) => {
        try {
            let apiUrl
            if (platform === 'netease') {
                apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
            } else if (platform === 'tencent') {
                apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
            } else {
                return {success: false, error: '不支持的音乐平台'}
            }

            const response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            })

            if (!response.ok) {
                return {success: false, error: `获取音乐URL失败: ${response.status}`}
            }

            const data = await response.json()
            if (data.code === 200 && data.data && data.data.url) {
                // 将HTTP URL改为HTTPS
                let url = data.data.url
                if (url.startsWith('http://')) {
                    url = url.replace('http://', 'https://')
                }
                return {success: true, url}
            } else {
                return {success: false, error: data.message || `API错误: ${data.code}`}
            }
        } catch (error) {
            console.error('获取音乐链接失败:', error)
            return {success: false, error: error.message || '网络错误'}
        }
    }

    // 尝试切换音质
    const tryQualitySwitch = async (song) => {
        if (!song?.musicPlatform || !song?.musicId || qualitySwitchAttempted.value) {
            return {success: false, error: '无法切换音质'}
        }

        const platform = song.musicPlatform
        const currentQuality = getQuality(platform)
        const qualityOptions = getQualityOptions(platform)

        // 找到当前音质的索引
        const currentIndex = qualityOptions.findIndex(option => option.value === currentQuality)

        // 尝试下一个音质
        for (let i = currentIndex + 1; i < qualityOptions.length; i++) {
            const newQuality = qualityOptions[i].value
            console.log(`尝试切换到音质: ${qualityOptions[i].label}`)

            const result = await getMusicUrl(platform, song.musicId, song.playUrl)
            if (result.success) {
                // 保存新音质设置
                saveQuality(platform, newQuality)
                qualitySwitchAttempted.value = true

                addNotification({
                    type: 'info',
                    message: `已切换到${qualityOptions[i].label}`,
                    duration: 3000
                })

                return {
                    success: true,
                    url: result.url,
                    quality: newQuality,
                    qualityLabel: qualityOptions[i].label
                }
            }
        }

        // 如果所有更低音质都失败，尝试更高音质
        for (let i = currentIndex - 1; i >= 0; i--) {
            const newQuality = qualityOptions[i].value
            console.log(`尝试切换到音质: ${qualityOptions[i].label}`)

            const result = await getMusicUrl(platform, song.musicId, song.playUrl)
            if (result.success) {
                // 保存新音质设置
                saveQuality(platform, newQuality)
                qualitySwitchAttempted.value = true

                addNotification({
                    type: 'info',
                    message: `已切换到${qualityOptions[i].label}`,
                    duration: 3000
                })

                return {
                    success: true,
                    url: result.url,
                    quality: newQuality,
                    qualityLabel: qualityOptions[i].label
                }
            }
        }

        qualitySwitchAttempted.value = true
        return {success: false, error: '所有音质都无法播放'}
    }

    // 处理播放错误，包含重试和音质切换逻辑
    const handlePlaybackError = async (error, song, onSongChange, onNext, onClose, isPlaylistMode = true) => {
        console.log('播放错误:', error, '重试次数:', retryCount.value)

        // 如果已经在重试中，避免重复处理
        if (isRetrying.value) {
            return {handled: true}
        }

        isRetrying.value = true

        try {
            // 首先尝试音质切换（只尝试一次）
            if (!qualitySwitchAttempted.value && song?.musicPlatform && song?.musicId) {
                console.log('尝试切换音质解决播放问题...')
                const qualityResult = await tryQualitySwitch(song)

                if (qualityResult.success) {
                    // 更新歌曲的音乐链接
                    const updatedSong = {
                        ...song,
                        musicUrl: qualityResult.url
                    }

                    // 通知父组件更新歌曲
                    if (onSongChange) {
                        onSongChange(updatedSong)
                    }

                    isRetrying.value = false
                    return {handled: true, success: true, newSong: updatedSong}
                }
            }

            // 如果音质切换失败或不可用，尝试重试当前歌曲
            if (retryCount.value < maxRetries.value) {
                retryCount.value++
                console.log(`重试播放当前歌曲 (${retryCount.value}/${maxRetries.value})`)

                // 延迟重试
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.value))

                isRetrying.value = false
                return {handled: true, shouldRetry: true}
            }

            // 重试次数用完，根据播放模式决定是否自动跳过
            if (isPlaylistMode) {
                console.log('当前歌曲重试次数用完，尝试下一首')

                if (onNext) {
                    const nextResult = await onNext()
                    if (nextResult?.success && nextResult?.newSong) {
                        // 重置重试状态，为新歌曲准备
                        resetRetryState()
                        isRetrying.value = false
                        return {handled: true, success: true, newSong: nextResult.newSong}
                    }
                }

                // 如果没有下一首或下一首也失败，关闭播放器
                console.log('没有可播放的歌曲，关闭播放器')

                addNotification({
                    type: 'error',
                    message: '播放失败，已关闭播放器',
                    duration: 3000
                })

                if (onClose) {
                    onClose()
                }

                isRetrying.value = false
                return {handled: true, shouldClose: true}
            } else {
                // 非播放列表模式（如投稿页面），只显示错误提示，不自动跳过
                console.log('播放失败，显示错误提示（非播放列表模式）')

                addNotification({
                    type: 'error',
                    message: '歌曲播放失败，请检查链接或稍后重试',
                    duration: 5000
                })

                isRetrying.value = false
                return {handled: true, showError: true}
            }

        } catch (err) {
            console.error('处理播放错误时发生异常:', err)
            isRetrying.value = false
            return {handled: false, error: err}
        }
    }

    // 增强的音质切换功能
    const enhancedQualitySwitch = async (song, newQuality) => {
        if (!song?.musicPlatform || !song?.musicId) {
            addNotification({
                type: 'error',
                message: '无法切换音质：歌曲信息不完整',
                duration: 3000
            })
            return {success: false, error: '歌曲信息不完整'}
        }

        try {
            console.log(`尝试切换到音质: ${newQuality}`)

            // 先尝试获取新音质的链接
            const result = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl)

            if (result.success) {
                // 保存音质设置
                saveQuality(song.musicPlatform, newQuality)

                const qualityOptions = getQualityOptions(song.musicPlatform)
                const qualityLabel = qualityOptions.find(option => option.value === newQuality)?.label || newQuality

                addNotification({
                    type: 'success',
                    message: `已切换到${qualityLabel}`,
                    duration: 3000
                })

                return {
                    success: true,
                    url: result.url,
                    quality: newQuality,
                    qualityLabel
                }
            } else {
                addNotification({
                    type: 'error',
                    message: `切换音质失败: ${result.error}`,
                    duration: 3000
                })

                return {success: false, error: result.error}
            }
        } catch (error) {
            console.error('切换音质时发生错误:', error)

            addNotification({
                type: 'error',
                message: '切换音质失败，请稍后重试',
                duration: 3000
            })

            return {success: false, error: error.message}
        }
    }

    // 处理热重载时的清理
    const handleHotReload = () => {
        // 停止所有正在播放的音频
        const audioElements = document.querySelectorAll('audio')
        audioElements.forEach(audio => {
            if (!audio.paused) {
                audio.pause()
                audio.currentTime = 0
            }
        })

        // 清理全局播放器状态
        if (typeof window !== 'undefined') {
            if (window.voiceHubPlayerInstance) {
                window.voiceHubPlayerInstance = null
            }

            // 清理鸿蒙侧状态
            if (window.voiceHubPlayer && window.voiceHubPlayer.onPlayStateChanged) {
                window.voiceHubPlayer.onPlayStateChanged(false, {
                    position: 0,
                    duration: 0
                })
            }
        }

        console.log('热重载清理完成')
    }

    return {
        retryCount: computed(() => retryCount.value),
        maxRetries: computed(() => maxRetries.value),
        isRetrying: computed(() => isRetrying.value),
        qualitySwitchAttempted: computed(() => qualitySwitchAttempted.value),

        resetRetryState,
        getMusicUrl,
        tryQualitySwitch,
        handlePlaybackError,
        enhancedQualitySwitch,
        handleHotReload
    }
}