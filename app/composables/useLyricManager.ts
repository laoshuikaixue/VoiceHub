import { ref, watch } from 'vue'
import { useAudioPlayer } from './useAudioPlayer'
import { useMusicSources } from './useMusicSources'
import { useLyricSettings } from './useLyricSettings'
import { 
  parseSmartLrc, 
  alignLyrics,
  cleanTTMLTranslations,
  parseQRCLyric,
  type LrcFormat 
} from '~/utils/lyric/lyricParser'
import { formatLyric } from '~/utils/lyric/lyricFormat'
import type { LyricLine } from '@applemusic-like-lyrics/lyric'
import { parseTTML, parseYrc } from '@applemusic-like-lyrics/lyric'

export const useLyricManager = () => {
  const audioPlayer = useAudioPlayer()
  const { getLyrics } = useMusicSources()
  const settings = useLyricSettings()

  // 状态
  const lyrics = ref<LyricLine[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentTrackId = ref<string | null>(null)
  const hasTranslation = ref(false)
  const hasRoma = ref(false)
  const lyricFormat = ref<LrcFormat | 'ttml' | 'qrc'>('line')

  /**
   * 清空歌词
   */
  const clearLyrics = () => {
    lyrics.value = []
    error.value = null
    hasTranslation.value = false
    hasRoma.value = false
    currentTrackId.value = null
  }

  /**
   * 获取并解析歌词
   */
  const fetchLyric = async (track: any) => {
    if (!track || !track.id) return

    // 如果已经在加载同一首歌，跳过
    if (loading.value && currentTrackId.value === track.id?.toString()) return
    
    // 如果是同一首歌且已有歌词，不重新加载
    if (currentTrackId.value === track.id?.toString() && lyrics.value.length > 0) return

    currentTrackId.value = track.id?.toString()
    loading.value = true
    
    try {
      // 确定平台
      const platform = track.musicPlatform || 'netease'
      const musicId = track.musicId || track.id
      
      console.log(`[LyricManager] 开始获取歌词: ${track.title} (${platform})`)

      // 1. 获取歌词数据
      const result = await getLyrics(platform, musicId)
      
      if (!result.success || !result.data) {
        throw new Error(result.error || '未找到歌词')
      }

      const { lrc, trans, yrc, ttml } = result.data
      console.log(`[LyricManager] 获取结果: LRC=${!!lrc}, TRANS=${!!trans}, YRC=${!!yrc}, TTML=${!!ttml}`)

      // 2. 解析歌词
      let parsedLyrics: LyricLine[] = []
      let format: LrcFormat | 'ttml' | 'qrc' = 'line'
      
      // 优先处理 TTML (如果启用且存在)
      if (settings.enableOnlineTTMLLyric.value && ttml) {
        try {
           const cleaned = cleanTTMLTranslations(ttml)
           const parsed = parseTTML(cleaned)
           const lines = (parsed as any)?.lines || []
           if (lines.length > 0) {
             parsedLyrics = lines
             format = 'ttml'
             console.log('[LyricManager] 使用 TTML 格式')
           }
        } catch (e) {
           console.warn('[LyricManager] TTML解析失败，回退到其他格式', e)
        }
      }

      // 如果没有 TTML 或解析失败，尝试 YRC
      if (parsedLyrics.length === 0 && yrc) {
         // 检测 QRC (QQ音乐 XML格式)
         if (yrc.trim().startsWith('<') || yrc.includes('LyricContent="')) {
             try {
                const qrcLines = parseQRCLyric(yrc, trans, undefined); // QQ 音乐 QRC 可能带有翻译
                if (qrcLines.length > 0) {
                    parsedLyrics = qrcLines
                    format = 'qrc'
                    console.log(`[LyricManager] 使用 QRC 格式`)
                }
             } catch (e) {
                 console.warn('[LyricManager] QRC解析失败', e)
             }
         }
         
         if (parsedLyrics.length === 0) {
            try {
                // 尝试使用库的 parseYrc (Netease JSON)
                const lines = parseYrc(yrc)
                if (lines && lines.length > 0) {
                    // 检查解析质量：如果所有行的 words 都为空，说明解析失败
                    const validLines = lines.filter(l => l.words && l.words.length > 0);
                    if (validLines.length > 0) {
                        parsedLyrics = lines
                        format = 'word-by-word'
                        console.log(`[LyricManager] 使用 YRC 格式 (Library)`)
                    } else {
                         // 解析结果无效，回退
                         console.warn('[LyricManager] YRC (Library) 解析结果无效(无words)，尝试回退');
                         parsedLyrics = []; // 触发后续逻辑
                    }
                } else {
                     const { lines, format: detectedFormat } = parseSmartLrc(yrc)
                     if (lines.length > 0) {
                       parsedLyrics = lines
                       format = detectedFormat
                       console.log(`[LyricManager] 使用 YRC 格式 (Smart: ${detectedFormat})`)
                     }
                }
            } catch (e) {
                // 回退到 parseSmartLrc
                const { lines, format: detectedFormat } = parseSmartLrc(yrc)
                if (lines.length > 0) {
                  parsedLyrics = lines
                  format = detectedFormat
                  console.log(`[LyricManager] 使用 YRC 格式 (Fallback: ${detectedFormat})`)
                }
            }
         }
      }

      // 如果还是没有，使用 LRC
      if (parsedLyrics.length === 0 && lrc) {
        const { lines, format: detectedFormat } = parseSmartLrc(lrc)
        parsedLyrics = lines
        format = detectedFormat
        console.log(`[LyricManager] 使用 LRC 格式 (${detectedFormat})`)
      }

      // 3. 对齐翻译和罗马音
      if (parsedLyrics.length > 0) {
        // 如果有翻译
        if (trans) {
          const { lines: transLines } = parseSmartLrc(trans)
          if (transLines.length > 0) {
            parsedLyrics = alignLyrics(parsedLyrics, transLines, 'translatedLyric')
            hasTranslation.value = true
            console.log('[LyricManager] 已对齐翻译')
          }
        }
      } else {
          // 没有任何歌词
          error.value = '暂无歌词'
      }

      // 4. 格式化 (应用配置，如括号替换)
      if (parsedLyrics.length > 0) {
          // 检查当前播放的歌曲 ID 是否仍然是请求的歌曲 ID
          if (currentTrackId.value !== track.id?.toString()) {
             console.log('[LyricManager] 歌曲已切换，丢弃过期的歌词响应')
             return
          }

          // 提取元数据用于清洗
          const metadata = {
            title: track.title,
            artists: track.artist ? [track.artist] : undefined
          }

          lyrics.value = formatLyric(parsedLyrics, settings, metadata)
          lyricFormat.value = format
          error.value = null
          
          // 调试
          console.log('[LyricManager] 解析完成，首行:', lyrics.value[0])
          console.log('[LyricManager] 解析完成，总行数:', lyrics.value.length)
      }

    } catch (e: any) {
      console.error('[LyricManager] 获取歌词失败:', e)
      error.value = e.message || '获取歌词失败'
      lyrics.value = []
    } finally {
      loading.value = false
    }
  }

  // 监听当前播放歌曲变化
  watch(() => audioPlayer.getCurrentSong().value, (newTrack) => {
    if (newTrack) {
      fetchLyric(newTrack)
    } else {
      clearLyrics()
    }
  }, { immediate: true })

  return {
    lyrics,
    loading,
    error,
    currentTrackId,
    hasTranslation,
    hasRoma,
    lyricFormat,
    fetchLyric,
    clearLyrics
  }
}
