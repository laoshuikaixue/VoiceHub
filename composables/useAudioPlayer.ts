import { ref, readonly } from 'vue'

interface PlayableSong {
  id: number
  title: string
  artist: string
  musicUrl?: string | null
  cover?: string | null
}

// 创建一个单例实例
const currentSong = ref<PlayableSong | null>(null)
const isPlaying = ref(false)

export function useAudioPlayer() {
  // 播放歌曲
  const playSong = (song: PlayableSong) => {
    if (!song.musicUrl) {
      console.error('歌曲没有可播放的URL')
      return false
    }

    // 如果是同一首歌，则开始播放（不切换状态，由调用方决定）
    if (currentSong.value && currentSong.value.id === song.id) {
      isPlaying.value = true
      return true
    }

    // 播放新歌曲
    currentSong.value = song
    isPlaying.value = true
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
  }

  // 检查指定ID的歌曲是否正在播放
  const isCurrentPlaying = (songId: number) => {
    return isPlaying.value && currentSong.value && currentSong.value.id === songId
  }

  // 检查指定ID的歌曲是否为当前歌曲（不管是否在播放）
  const isCurrentSong = (songId: number) => {
    return currentSong.value && currentSong.value.id === songId
  }
  
  // 获取当前播放的歌曲信息
  const getCurrentSong = () => {
    return readonly(currentSong)
  }
  
  // 获取当前播放状态
  const getPlayingStatus = () => {
    return readonly(isPlaying)
  }

  return {
    playSong,
    pauseSong,
    stopSong,
    isCurrentPlaying,
    isCurrentSong,
    getCurrentSong,
    getPlayingStatus
  }
} 