import { getMusicUrl } from '~/utils/musicUrl'
import { useAudioPlayer } from './useAudioPlayer'
import { useToast } from './useToast'

export const useSongPlayer = () => {
  const audioPlayer = useAudioPlayer()
  const { showToast } = useToast()

  const playSong = async (song: any) => {
    // 如果是当前正在播放的歌曲，则暂停
    if (audioPlayer.isCurrentSong(song.id) && audioPlayer.getPlayingStatus().value) {
      audioPlayer.pauseSong()
      return
    }

    // 如果是当前歌曲但暂停了，则恢复播放
    if (audioPlayer.isCurrentSong(song.id) && !audioPlayer.getPlayingStatus().value) {
      const currentGlobalSong = audioPlayer.getCurrentSong().value
      if (currentGlobalSong && (currentGlobalSong.musicUrl || currentGlobalSong.musicPlatform === 'bilibili')) {
        audioPlayer.playSong(currentGlobalSong)
        return
      }
    }

    try {
      let url = null
      // 哔哩哔哩不需要获取 URL，播放器会处理
      if (song.musicPlatform !== 'bilibili') {
        url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl)
      }

      const playableSong = {
        ...song,
        musicUrl: url
      }

      audioPlayer.playSong(playableSong, [playableSong])
    } catch (error: any) {
      console.error('播放失败:', error)
      showToast('播放失败: ' + (error.message || error), 'error')
    }
  }

  return {
    playSong
  }
}
