import { ref } from 'vue'
import { getMusicUrlResult } from '~/utils/musicUrl'
import { isPreviewClipDuration, probeAudioDuration } from '~/utils/preview-duration'
import { PLATFORM_AUTHORIZED_PLATFORMS } from '~/utils/platforms'
import { useAudioQuality } from '~/composables/useAudioQuality'

type BroadcastSong = {
  id: number; title: string; artist: string; musicPlatform?: string | null; musicId?: string | null;
  playUrl?: string | null; durationSeconds?: number | null; musicSourceData?: unknown
}

export function useBroadcastMedia() {
  const element = ref<HTMLAudioElement | null>(null)
  const currentTime = ref(0)
  const duration = ref<number | null>(null)
  const playing = ref(false)
  const loading = ref(false)
  const actualQuality = ref<string | null>(null)
  const quality = useAudioQuality()
  let generation = 0
  let cancelMetadata: (() => void) | undefined

  function reset() {
    generation++
    cancelMetadata?.()
    const audio = element.value
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    playing.value = false
    loading.value = false
    duration.value = null
    currentTime.value = 0
    actualQuality.value = null
  }

  function sync() {
    const audio = element.value
    if (!audio) return
    playing.value = !audio.paused && !audio.ended
    currentTime.value = audio.currentTime
    duration.value = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null
  }

  function setSource(audio: HTMLAudioElement, url: string, position: number) {
    return new Promise<void>((resolve, reject) => {
      function cleanup() {
        clearTimeout(timer)
        audio.removeEventListener('loadedmetadata', ready)
        audio.removeEventListener('error', failed)
        cancelMetadata = undefined
      }
      function ready() {
        cleanup()
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          reject(new Error('音频时长无效'))
          return
        }
        audio.currentTime = Math.min(position, Math.max(0, audio.duration - 0.1))
        sync()
        resolve()
      }
      function failed() { cleanup(); reject(new Error('无法加载音频')) }
      const timer = setTimeout(failed, 10_000)
      cancelMetadata = failed
      audio.addEventListener('loadedmetadata', ready)
      audio.addEventListener('error', failed)
      audio.src = url
      audio.load()
    })
  }

  async function load(song: BroadcastSong, requested?: number) {
    const audio = element.value
    if (!audio || loading.value) return 'cancelled'
    const revision = ++generation
    const platform = song.musicPlatform || ''
    const previous = audio.getAttribute('src')
    const remember = requested !== undefined && previous !== null
    let replaced = false
    let position = 0
    let resume = false
    loading.value = true
    try {
      const options = {
        quality: requested ?? quality.getQuality(platform), strictComplete: true, songId: song.id,
        ignoreProvidedUrl: !!song.musicId && PLATFORM_AUTHORIZED_PLATFORMS.includes(platform),
        musicInfo: { name: song.title, artist: song.artist, rawItem: { ...song, ...(
          song.musicSourceData && typeof song.musicSourceData === 'object' ? song.musicSourceData : {}
        ) } }
      }
      const result = await getMusicUrlResult(platform, song.musicId || '', song.playUrl ?? undefined, options)
      if (revision !== generation) return 'cancelled'
      if (!result.url) throw new Error('未获取播放链接')
      if (remember) {
        // 验证候选音质后再替换当前声音，失败时保留原音源。
        const length = await probeAudioDuration(result.url)
        if (revision !== generation) return 'cancelled'
        if (length <= 0 || isPreviewClipDuration(length, song.durationSeconds)) throw new Error('候选音质不可播放')
        position = audio.currentTime
        resume = !audio.paused
      }
      replaced = true
      await setSource(audio, result.url, position)
      if (revision !== generation) return 'cancelled'
      if (isPreviewClipDuration(audio.duration, song.durationSeconds)) throw new Error('仅提供试听片段')
      if (!remember || resume) await audio.play()
      if (revision !== generation) return 'cancelled'
      if (requested !== undefined) quality.saveQuality(platform, requested)
      actualQuality.value = platform === 'netease' ? quality.getNeteaseQualityLabel(result.actualQuality) : null
      sync()
      return 'ready'
    } catch (error) {
      if (revision !== generation) return 'cancelled'
      if (remember && previous && replaced) {
        try {
          await setSource(audio, previous, position)
          if (revision === generation && resume) await audio.play()
          return revision === generation ? 'quality-failed' : 'cancelled'
        } catch {
          return revision === generation ? 'failed' : 'cancelled'
        }
      }
      if (remember) return 'quality-failed'
      return error instanceof Error && error.name === 'NotAllowedError' ? 'blocked' : 'failed'
    } finally {
      if (revision === generation) loading.value = false
    }
  }

  return { element, currentTime, duration, playing, loading, actualQuality, reset, sync, load, ...quality }
}
