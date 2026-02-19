import { computed, readonly, ref } from 'vue'

interface PlayableSong {
  id: number
  title: string
  artist: string
  musicUrl?: string | null
  cover?: string | null
  musicPlatform?: string
  musicId?: string
  playUrl?: string | null
}

interface PlaylistItem {
  id: number
  song: PlayableSong
  playDate?: string
  playTimeId?: number
}

// 创建一个单例实例
const currentSong = ref<PlayableSong | null>(null)
const isPlaying = ref(false)
const currentPlaylist = ref<PlaylistItem[]>([])
const currentPlaylistIndex = ref(-1)
const currentPosition = ref(0) // 当前播放位置（秒）
const duration = ref(0) // 歌曲总时长（秒）

export function useAudioPlayer() {
  // 播放歌曲
  const playSong = (song: PlayableSong, playlist?: PlayableSong[], playlistIndex?: number) => {
    // 对于哔哩哔哩视频，允许没有 musicUrl（会显示 iframe 预览）
    if (!song.musicUrl && song.musicPlatform !== 'bilibili') {
      console.error('歌曲没有可播放的URL')
      return false
    }

    // 如果提供了播放列表，更新播放列表
    if (playlist && playlist.length > 0) {
      // 将PlayableSong数组转换为PlaylistItem数组
      currentPlaylist.value = playlist.map((s) => ({ song: s }))
      // 使用提供的索引或查找当前歌曲在播放列表中的位置
      if (
        typeof playlistIndex === 'number' &&
        playlistIndex >= 0 &&
        playlistIndex < playlist.length
      ) {
        currentPlaylistIndex.value = playlistIndex
      } else {
        const index = playlist.findIndex((item) => item.id === song.id)
        currentPlaylistIndex.value = index >= 0 ? index : -1
      }
    } else if (currentSong.value && currentSong.value.id !== song.id) {
      // 如果没有提供播放列表且是新歌曲，清空播放列表
      currentPlaylist.value = []
      currentPlaylistIndex.value = -1
    }

    // 如果是同一首歌，则开始播放（不切换状态，由调用方决定）
    if (currentSong.value && currentSong.value.id === song.id) {
      isPlaying.value = true
      return true
    }

    // 播放新歌曲
    currentSong.value = song
    isPlaying.value = true
    currentPosition.value = 0
    return true
  }

  // 暂停播放
  const pauseSong = () => {
    isPlaying.value = false
  }

  // 停止播放
  const stopSong = () => {
    isPlaying.value = false
    currentSong.value = null
    currentPosition.value = 0
    duration.value = 0
  }

  // 播放下一首歌曲
  const playNext = async () => {
    if (currentPlaylist.value.length === 0 || currentPlaylistIndex.value === -1) {
      console.log('没有播放列表或当前歌曲不在播放列表中')
      return false
    }

    let nextIndex = currentPlaylistIndex.value + 1
    let attempts = 0
    const maxAttempts = currentPlaylist.value.length // 最多尝试整个播放列表的长度

    // 循环尝试找到可播放的下一首歌曲
    while (nextIndex < currentPlaylist.value.length && attempts < maxAttempts) {
      const nextSong = currentPlaylist.value[nextIndex].song

      // 如果已经有播放URL，直接使用
      if (nextSong.musicUrl) {
        currentPlaylistIndex.value = nextIndex
        currentSong.value = nextSong
        currentPosition.value = 0
        isPlaying.value = true
        return true
      }

      // 如果没有播放URL，尝试动态获取
      if (nextSong.musicPlatform && nextSong.musicId) {
        try {
          const { getMusicUrl } = await import('~/utils/musicUrl')

          // 检查是否为播客内容
          const isPodcast =
            nextSong.musicPlatform === 'netease-podcast' ||
            nextSong.sourceInfo?.type === 'voice' ||
            (nextSong.sourceInfo?.source === 'netease-backup' &&
              nextSong.sourceInfo?.type === 'voice')
          const options = isPodcast ? { unblock: false } : {}

          const url = await getMusicUrl(
            nextSong.musicPlatform,
            nextSong.musicId,
            nextSong.playUrl,
            options
          )
          if (url) {
            nextSong.musicUrl = url
            currentPlaylistIndex.value = nextIndex
            currentSong.value = nextSong
            currentPosition.value = 0
            isPlaying.value = true
            return true
          } else {
            console.warn(`跳过第${nextIndex + 1}首歌曲：无法获取播放链接，可能是付费内容`)
          }
        } catch (error) {
          console.warn(`跳过第${nextIndex + 1}首歌曲：获取播放URL失败`, error)
        }
      } else {
        console.warn(`跳过第${nextIndex + 1}首歌曲：缺少音乐平台或ID信息`)
      }

      // 尝试下一首
      nextIndex++
      attempts++
    }

    console.log('没有找到可播放的下一首歌曲')
    return false
  }

  // 播放上一首歌曲
  const playPrevious = async () => {
    if (currentPlaylist.value.length === 0 || currentPlaylistIndex.value === -1) {
      console.log('没有播放列表或当前歌曲不在播放列表中')
      return false
    }

    let prevIndex = currentPlaylistIndex.value - 1
    let attempts = 0
    const maxAttempts = currentPlaylist.value.length // 最多尝试整个播放列表的长度

    // 循环尝试找到可播放的上一首歌曲
    while (prevIndex >= 0 && attempts < maxAttempts) {
      const prevSong = currentPlaylist.value[prevIndex].song

      // 如果已经有播放URL，直接使用
      if (prevSong.musicUrl) {
        currentPlaylistIndex.value = prevIndex
        currentSong.value = prevSong
        currentPosition.value = 0
        isPlaying.value = true
        return true
      }

      // 如果没有播放URL，尝试动态获取
      if (prevSong.musicPlatform && prevSong.musicId) {
        try {
          const { getMusicUrl } = await import('~/utils/musicUrl')

          // 检查是否为播客内容
          const isPodcast =
            prevSong.musicPlatform === 'netease-podcast' ||
            prevSong.sourceInfo?.type === 'voice' ||
            (prevSong.sourceInfo?.source === 'netease-backup' &&
              prevSong.sourceInfo?.type === 'voice')
          const options = isPodcast ? { unblock: false } : {}

          const url = await getMusicUrl(
            prevSong.musicPlatform,
            prevSong.musicId,
            prevSong.playUrl,
            options
          )
          if (url) {
            prevSong.musicUrl = url
            currentPlaylistIndex.value = prevIndex
            currentSong.value = prevSong
            currentPosition.value = 0
            isPlaying.value = true
            return true
          } else {
            console.warn(`跳过第${prevIndex + 1}首歌曲：无法获取播放链接，可能是付费内容`)
          }
        } catch (error) {
          console.warn(`跳过第${prevIndex + 1}首歌曲：获取播放URL失败`, error)
        }
      } else {
        console.warn(`跳过第${prevIndex + 1}首歌曲：缺少音乐平台或ID信息`)
      }

      // 尝试上一首
      prevIndex--
      attempts++
    }

    console.log('没有找到可播放的上一首歌曲')
    return false
  }

  // 设置播放位置
  const setPosition = (position: number) => {
    currentPosition.value = Math.max(0, Math.min(position, duration.value))
  }

  // 设置歌曲总时长
  const setDuration = (newDuration: number) => {
    duration.value = Math.max(0, newDuration)
  }

  // 更新播放位置（由音频元素的timeupdate事件调用）
  const updatePosition = (position: number) => {
    currentPosition.value = position
  }

  // 检查指定ID的歌曲是否正在播放
  const isCurrentPlaying = (songId: number) => {
    return isPlaying.value && currentSong.value && currentSong.value.id === songId
  }

  // 检查指定ID的歌曲是否为当前歌曲（不管是否在播放）
  const isCurrentSong = (songId: number) => {
    return currentSong.value && currentSong.value.id === songId
  }

  // 检查是否有下一首歌曲
  const hasNext = computed(() => {
    return (
      currentPlaylist.value.length > 0 &&
      currentPlaylistIndex.value >= 0 &&
      currentPlaylistIndex.value < currentPlaylist.value.length - 1
    )
  })

  // 检查是否有上一首歌曲
  const hasPrevious = computed(() => {
    return currentPlaylist.value.length > 0 && currentPlaylistIndex.value > 0
  })

  // 获取当前播放列表
  const getCurrentPlaylist = () => {
    return readonly(currentPlaylist)
  }

  // 获取当前播放列表索引
  const getCurrentPlaylistIndex = () => {
    return readonly(currentPlaylistIndex)
  }

  // 获取当前播放的歌曲信息
  const getCurrentSong = () => {
    return readonly(currentSong)
  }

  // 获取当前播放状态
  const getPlayingStatus = () => {
    return readonly(isPlaying)
  }

  // 获取当前播放位置
  const getCurrentPosition = () => {
    return readonly(currentPosition)
  }

  // 获取歌曲总时长
  const getDuration = () => {
    return readonly(duration)
  }

  // 获取播放进度百分比
  const getProgress = computed(() => {
    if (duration.value === 0) return 0
    return (currentPosition.value / duration.value) * 100
  })

  // 更新当前歌曲信息（用于音质切换等场景）
  const updateCurrentSong = (updatedSong: PlayableSong) => {
    if (currentSong.value && currentSong.value.id === updatedSong.id) {
      currentSong.value = updatedSong
      // 同时更新播放列表中的对应项
      if (currentPlaylistIndex.value !== -1 && currentPlaylist.value[currentPlaylistIndex.value]) {
        currentPlaylist.value[currentPlaylistIndex.value].song = updatedSong
      }
      return true
    }
    return false
  }

  return {
    playSong,
    pauseSong,
    stopSong,
    playNext,
    playPrevious,
    updateCurrentSong,
    setPosition,
    setDuration,
    updatePosition,
    isCurrentPlaying,
    isCurrentSong,
    getCurrentSong,
    getPlayingStatus,
    getCurrentPosition,
    getDuration,
    getProgress,
    hasNext,
    hasPrevious,
    getCurrentPlaylist,
    getCurrentPlaylistIndex
  }
}
