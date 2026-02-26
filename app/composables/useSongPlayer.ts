import { getMusicUrl } from '~/utils/musicUrl'
import { useAudioPlayer, type PlayableSong } from './useAudioPlayer'
import { useToast } from './useToast'
import type { Song } from '~/types'

export const useSongPlayer = () => {
  const audioPlayer = useAudioPlayer()
  const { showToast } = useToast()

  const playSong = async (song: Song | PlayableSong) => {
    // 如果是当前选中的歌曲
    if (audioPlayer.isCurrentSong(song.id)) {
      // 如果正在播放，则暂停
      if (audioPlayer.getPlayingStatus().value) {
        audioPlayer.pauseSong()
        return
      }
      
      // 如果是当前歌曲但暂停了，则恢复播放
      const currentGlobalSong = audioPlayer.getCurrentSong().value
      if (currentGlobalSong && (currentGlobalSong.musicUrl || currentGlobalSong.musicPlatform === 'bilibili')) {
        audioPlayer.playSong(currentGlobalSong)
        return
      }
    }

    try {
      let url = null
      // 哔哩哔哩不需要获取 URL，播放器会处理
      const isBilibili =
        song.musicPlatform === 'bilibili' ||
        String(song.musicId).startsWith('BV') ||
        String(song.musicId).startsWith('av')

      if (!isBilibili) {
        url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl)
      }

      const playableSong: PlayableSong = {
        ...song,
        musicUrl: url
      }

      audioPlayer.playSong(playableSong, [playableSong])
    } catch (error: any) {
      console.error('播放失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast('播放失败: ' + errorMessage, 'error')
    }
  }

  return {
    playSong
  }
}
