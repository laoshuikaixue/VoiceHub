import { getMusicUrl } from '~/utils/musicUrl'
import { isBilibiliSong } from '~/utils/bilibiliSource'
import { useAudioPlayer, type PlayableSong } from './useAudioPlayer'
import { useToast } from './useToast'
import { useLocale } from '~/utils/locale'
import type { Song } from '~/types'

export const useSongPlayer = () => {
  const audioPlayer = useAudioPlayer()
  const { showToast } = useToast()
  const { audioPlayer: audioPlayerLocale } = useLocale()

  // 判断歌曲是否可入队（有自定义链接、B站视频或平台ID）
  const isPlayableSong = (s: Song | PlayableSong) => {
    return Boolean(
      (s.playUrl && s.playUrl.trim()) ||
        isBilibiliSong(s) ||
        (s.musicPlatform && s.musicId)
    )
  }

  // 根据队列来源构建播放队列，返回队列与当前歌曲索引；来源为空时退化为单曲队列
  const buildQueue = (song: PlayableSong, queueSource?: (Song | PlayableSong)[]) => {
    const queue = (queueSource || []).filter(isPlayableSong) as PlayableSong[]
    const index = queue.findIndex((s) => String(s.id) === String(song.id))
    if (index === -1) {
      return { queue: [song, ...queue], index: 0 }
    }
    return { queue, index }
  }

  const playSong = async (song: Song | PlayableSong, queueSource?: (Song | PlayableSong)[]) => {
    // 如果是当前选中的歌曲
    if (audioPlayer.isCurrentSong(song.id)) {
      // 如果正在播放，则暂停
      if (audioPlayer.getPlayingStatus().value) {
        audioPlayer.pauseSong()
        return
      }

      // 如果是当前歌曲但暂停了，则恢复播放
      const currentGlobalSong = audioPlayer.getCurrentSong().value
      if (currentGlobalSong && (currentGlobalSong.musicUrl || isBilibiliSong(currentGlobalSong))) {
        // 恢复播放时同步刷新播放队列
        const { queue, index } = buildQueue(currentGlobalSong, queueSource)
        audioPlayer.playSong(currentGlobalSong, queue, index)
        return
      }
    }

    try {
      let url = null

      // 如果有手动填入的 playUrl，优先使用它（统一处理所有平台）
      if (song.playUrl && song.playUrl.trim()) {
        url = song.playUrl.trim()
      } else if (!isBilibiliSong(song)) {
        // 如果不是哔哩哔哩歌曲且没有手动 playUrl，通过 API 获取 URL
        url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl, {
          musicInfo: {
            name: song.title,
            artist: song.artist,
            album: song.album || undefined
          }
        })
      }
      // 如果是哔哩哔哩歌曲且没有手动 playUrl，url 保持为 null，播放器会处理

      const playableSong: PlayableSong = {
        ...song,
        musicUrl: url
      }

      const { queue, index } = buildQueue(playableSong, queueSource)
      audioPlayer.playSong(playableSong, queue, index)
    } catch (error: any) {
      console.error('播放失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast(audioPlayerLocale.value.playFailed(errorMessage), 'error')

      // 即使获取 URL 失败，也应该调用 playSong 以触发播放器的错误处理和弹窗逻辑
      const playableSong: PlayableSong = {
        ...song,
        musicUrl: null
      }
      const { queue, index } = buildQueue(playableSong, queueSource)
      audioPlayer.playSong(playableSong, queue, index)
    }
  }

  return {
    playSong
  }
}
