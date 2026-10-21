import { computed, readonly, ref } from 'vue'
import { isBilibiliSong } from '~/utils/bilibiliSource'
import { useMusicSources } from '~/composables/useMusicSources'
import { useLyricSettings } from '~/composables/useLyricSettings'
import { useLocale } from '~/utils/locale'
import type { MusicTrackMeta } from '~/utils/musicUrl'
import {
  createSchedulePlaybackState, findScheduleItem, reconcileSchedulePlayback,
  samePlaybackSource, sameScheduleSource, scheduleNeighborIndex, selectScheduleItem,
  type SchedulePlaybackState, type SchedulePlaylistItem, type SchedulePlaylistSource
} from '~/utils/schedulePlaylist'

export interface PlayableSong {
  id: number | string
  title: string
  artist: string
  album?: string | null
  duration?: number | null
  musicUrl?: string | null
  cover?: string | null
  musicPlatform?: string
  musicId?: string
  playUrl?: string | null
  sourceInfo?: Record<string, any>
  schedulePlaybackKey?: number
}

interface PlaylistItem {
  id?: number | string
  song: PlayableSong
  playDate?: string
  playTimeId?: number | null
  replayRequestId?: number | null
}

// 创建一个单例实例
const currentSong = ref<PlayableSong | null>(null)
const isPlaying = ref(false)
const currentPlaylist = ref<PlaylistItem[]>([])
const currentPlaylistIndex = ref(-1)
const currentPosition = ref(0) // 当前播放位置（秒）
const duration = ref(0) // 歌曲总时长（秒）
const schedulePlayback = ref<SchedulePlaybackState | null>(null)
let playbackRequest = 0
let schedulePlaybackKey = 0
let pendingScheduleNavigation: {
  request: number
  state: SchedulePlaybackState
  item: SchedulePlaylistItem
  direction: 1 | -1
  explicit: boolean
  promise: Promise<boolean>
} | null = null

// 预载中的封面图引用，防止加载完成前被回收
let pendingCoverImage: HTMLImageElement | null = null

export function useAudioPlayer() {
  const { audioPlayer: audioPlayerLocale } = useLocale()

  // 播放歌曲
  const playSong = (song: PlayableSong, playlist?: PlayableSong[], playlistIndex?: number) => {
    // 允许没有 musicUrl 但有 musicPlatform+musicId 的歌曲通过（由 loadSong 动态解析）
    if (!song.musicUrl && !isBilibiliSong(song) && !(song.musicPlatform && song.musicId)) {
      console.error('歌曲没有可播放的URL')
      return false
    }

    playbackRequest++
    schedulePlayback.value = null

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
        const index = playlist.findIndex((item) => String(item.id) === String(song.id))
        currentPlaylistIndex.value = index >= 0 ? index : -1
      }
    } else if (currentSong.value && String(currentSong.value.id) !== String(song.id)) {
      // 如果没有提供播放列表且是新歌曲，清空播放列表
      currentPlaylist.value = []
      currentPlaylistIndex.value = -1
    }

    // 如果是同一首歌，则开始播放（不切换状态，由调用方决定）
    if (currentSong.value && String(currentSong.value.id) === String(song.id)) {
      // 保持当前歌曲的引用更新，以便获取可能更新的 URL 等信息
      currentSong.value = song
      isPlaying.value = true
      return true
    }

    // 播放新歌曲
    currentSong.value = song
    isPlaying.value = true
    currentPosition.value = 0
    duration.value = 0 // 重置时长，等待新歌曲加载后更新
    return true
  }

  // 暂停播放
  const pauseSong = (userInitiated = true) => {
    if (userInitiated) {
      playbackRequest++
      if (schedulePlayback.value) {
        schedulePlayback.value.autoContinue = false
        schedulePlayback.value.waiting = false
      }
    }
    isPlaying.value = false
  }

  const setPlaybackStatus = (playing: boolean) => {
    isPlaying.value = playing
    if (playing && schedulePlayback.value) schedulePlayback.value.autoContinue = true
  }

  const neighborIndex = (direction: 1 | -1) => {
    const state = schedulePlayback.value
    if (state) return scheduleNeighborIndex(state, currentPlaylist.value, direction)
    const index = currentPlaylistIndex.value + direction
    return currentPlaylistIndex.value >= 0 && index >= 0 && index < currentPlaylist.value.length ? index : -1
  }

  const playScheduleAt = (index: number, direction: 1 | -1 = 1, explicit = false): Promise<boolean> => {
    const state = schedulePlayback.value
    const item = currentPlaylist.value[index]
    if (!state || !item) return Promise.resolve(false)
    const pending = pendingScheduleNavigation
    if (pending && pending.request === playbackRequest && pending.state === state &&
      pending.direction === direction && pending.explicit === explicit &&
      findScheduleItem(pending.item, currentPlaylist.value) === index && samePlaybackSource(pending.item.song, item.song)) {
      return pending.promise
    }
    const request = ++playbackRequest
    const promise = resolveScheduleAt(index, direction, explicit, request).finally(() => {
      if (pendingScheduleNavigation?.request === request) pendingScheduleNavigation = null
    })
    pendingScheduleNavigation = { request, state, item, direction, explicit, promise }
    return promise
  }

  const resolveScheduleAt = async (index: number, direction: 1 | -1, explicit: boolean, request: number): Promise<boolean> => {
    const state = schedulePlayback.value
    if (!state || index < 0) return false
    const initialItem = currentPlaylist.value[index]
    const failedItems: SchedulePlaylistItem[] = []
    const latestTarget = () => {
      const explicitIndex = explicit ? findScheduleItem(initialItem, currentPlaylist.value) : -1
      let target = explicitIndex >= 0 ? explicitIndex : neighborIndex(direction)
      while (target >= 0 && target < currentPlaylist.value.length) {
        const item = currentPlaylist.value[target]
        const failed = failedItems.some((previous) =>
          findScheduleItem(previous, currentPlaylist.value) === target && samePlaybackSource(previous.song, item.song))
        if (!failed) return target
        target += direction
      }
      return -1
    }

    while (failedItems.length < 3) {
      const target = latestTarget()
      if (target < 0) {
        if (state.finished) {
          state.waiting = state.autoContinue && currentPlaylist.value.length === 0
          if (!state.waiting) state.autoContinue = false
        }
        if (!failedItems.length || !currentPlaylist.value.length) return false
        break
      }
      const item = currentPlaylist.value[target]
      const song = item.song
      let url = song.musicUrl || song.playUrl || null
      let resolutionError: unknown
      try {
        if (!url && !isBilibiliSong(song) && song.musicPlatform && song.musicId) {
          const { getMusicUrl } = await import('~/utils/musicUrl')
          url = await getMusicUrl(song.musicPlatform, song.musicId, song.playUrl, {
            musicInfo: { name: song.title, artist: song.artist, album: song.album || undefined, rawItem: song }
          })
        }
      } catch (error) {
        resolutionError = error
      }
      // 每个候选都验证最新顺序；失败跳过不重试相同音源，也不重启导航请求。
      if (request !== playbackRequest || schedulePlayback.value !== state) return false
      const retainedIndex = currentPlaylist.value.indexOf(item)
      const latestIndex = retainedIndex >= 0 ? retainedIndex : findScheduleItem(item, currentPlaylist.value)
      if (latestIndex < 0 || !samePlaybackSource(song, currentPlaylist.value[latestIndex].song) || latestIndex !== latestTarget()) continue
      if (resolutionError) console.warn('[AudioPlayer] 排期歌曲解析失败:', resolutionError)
      if (!url && !isBilibiliSong(song)) {
        failedItems.push(item)
        continue
      }
      const nextSong = { ...currentPlaylist.value[latestIndex].song, musicUrl: url, schedulePlaybackKey: ++schedulePlaybackKey }
      currentPlaylist.value[latestIndex].song = nextSong
      selectScheduleItem(state, currentPlaylist.value, latestIndex)
      currentPlaylistIndex.value = latestIndex
      currentSong.value = nextSong
      currentPosition.value = 0
      duration.value = 0
      isPlaying.value = true
      return true
    }
    if (request === playbackRequest) {
      pauseSong()
      if (window.$showNotification) window.$showNotification(audioPlayerLocale.value.consecutiveFailures, 'error')
    }
    return false
  }

  const resumeSong = () => {
    const state = schedulePlayback.value
    if (state) {
      state.autoContinue = true
      if (state.finished) {
        let index = neighborIndex(1)
        state.waiting = currentPlaylist.value.length === 0
        let explicit = false
        if (index < 0 && currentPlaylist.value.length) {
          // 手动恢复已结束的队列：仍在列表中则重播当前项，否则从新列表头开始。
          index = currentPlaylistIndex.value >= 0 ? currentPlaylistIndex.value : 0
          explicit = true
        }
        if (index >= 0) void playScheduleAt(index, 1, explicit)
        return true
      }
    }
    if (!currentSong.value) return false
    isPlaying.value = true
    return true
  }

  const playScheduleSong = (
    song: PlayableSong, items: SchedulePlaylistItem[], source: SchedulePlaylistSource, index: number
  ) => {
    song = { ...song, schedulePlaybackKey: ++schedulePlaybackKey }
    if (!items[index] || !playSong(song, items.map((item) => item.song), index)) return false
    currentPosition.value = 0
    duration.value = 0
    currentPlaylist.value = items.map((item, cursor) => ({ ...item, song: cursor === index ? song : item.song }))
    schedulePlayback.value = createSchedulePlaybackState(source, currentPlaylist.value, index)
    return true
  }

  const isCurrentScheduleItem = (item: SchedulePlaylistItem, source: SchedulePlaylistSource) => {
    const state = schedulePlayback.value
    return Boolean(state && sameScheduleSource(state.source, source) && !state.refill &&
      (state.current.id != null && item.id != null
        ? String(state.current.id) === String(item.id)
        : findScheduleItem(state.current, [item]) === 0))
  }

  const syncSchedulePlaylist = (items: SchedulePlaylistItem[]) => {
    const state = schedulePlayback.value
    if (!state || state.source.pending) return
    const nextItems = items.map((item) => {
      const match = findScheduleItem(item, currentPlaylist.value)
      const previous = currentPlaylist.value[match]
      return previous && samePlaybackSource(previous.song, item.song)
        ? { ...item, song: { ...item.song, musicUrl: previous.song.musicUrl, sourceInfo: previous.song.sourceInfo } }
        : { ...item, song: { ...item.song } }
    })
    const index = reconcileSchedulePlayback(state, nextItems)
    if (index >= 0 && currentSong.value) nextItems[index].song = currentSong.value
    const unchanged = nextItems.length === currentPlaylist.value.length && nextItems.every((item, cursor) => {
      const old = currentPlaylist.value[cursor]
      return String(item.id) === String(old.id) && item.playTimeId === old.playTimeId &&
        item.replayRequestId === old.replayRequestId && samePlaybackSource(item.song, old.song)
    })
    if (!unchanged) currentPlaylist.value = nextItems
    currentPlaylistIndex.value = index
    if (state.waiting && state.autoContinue && nextItems.length) {
      state.waiting = false
      void playScheduleAt(neighborIndex(1))
    }
  }

  const activateScheduleBinding = () => {
    if (schedulePlayback.value?.source.pending) {
      schedulePlayback.value.source = { ...schedulePlayback.value.source, pending: false }
    }
  }

  const clearScheduleBinding = () => {
    playbackRequest++
    schedulePlayback.value = null
    currentPlaylist.value = []
    currentPlaylistIndex.value = -1
  }

  const handleScheduleEnded = (mode: 'order' | 'off' | 'loopOne') => {
    const state = schedulePlayback.value
    if (!state) return false
    if (mode === 'loopOne' && !state.refill && currentPlaylistIndex.value >= 0) return false
    state.finished = true
    isPlaying.value = false
    const index = neighborIndex(1)
    if (mode !== 'off' && state.autoContinue && index >= 0) void playScheduleAt(index)
    else {
      state.waiting = mode !== 'off' && state.autoContinue && currentPlaylist.value.length === 0
      if (!state.waiting) state.autoContinue = false
    }
    return true
  }

  // 停止播放
  const stopSong = () => {
    clearScheduleBinding()
    isPlaying.value = false
    currentSong.value = null
    currentPosition.value = 0
    duration.value = 0
  }

  // 播放下一首歌曲
  const playNext = async () => {
    if (schedulePlayback.value) return playScheduleAt(neighborIndex(1))
    const request = ++playbackRequest
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
        duration.value = 0 // 重置时长
        isPlaying.value = true
        return true
      }

      // 如果没有播放URL，尝试动态获取
      if (nextSong.musicPlatform && nextSong.musicId) {
        // 网络断开时停留当前歌曲，不再继续消耗歌单
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          if (window.$showNotification) {
            window.$showNotification(audioPlayerLocale.value.networkOffline, 'error')
          }
          return false
        }

        try {
          const { getMusicUrl } = await import('~/utils/musicUrl')

          // 检查是否为播客内容
          const isPodcast =
            nextSong.musicPlatform === 'netease-podcast' ||
            nextSong.sourceInfo?.type === 'voice' ||
            (nextSong.sourceInfo?.source === 'netease-backup' &&
              nextSong.sourceInfo?.type === 'voice')
          const options: { unblock?: boolean; musicInfo?: MusicTrackMeta } = isPodcast
            ? { unblock: false }
            : {}
          options.musicInfo = {
            name: nextSong.title,
            artist: nextSong.artist,
            album: nextSong.album || undefined,
            rawItem: nextSong
          }

          const url = await getMusicUrl(
            nextSong.musicPlatform,
            nextSong.musicId,
            nextSong.playUrl,
            options
          )
          if (request !== playbackRequest) return false
          if (url) {
            nextSong.musicUrl = url
            currentPlaylistIndex.value = nextIndex
            currentSong.value = nextSong
            currentPosition.value = 0
            duration.value = 0 // 重置时长
            isPlaying.value = true
            return true
          } else {
            const msg = `无法获取《${nextSong.title}》的播放链接，已自动跳过`
            console.warn(msg)
            if (window.$showNotification) {
              window.$showNotification(msg, 'warning')
            }
          }
        } catch (error) {
          const msg = `《${nextSong.title}》获取播放链接失败，已自动跳过`
          console.warn(msg, error)
          if (window.$showNotification) {
            window.$showNotification(msg, 'error')
          }
        }
      } else {
        const msg = `《${nextSong.title}》缺少播放信息，已自动跳过`
        console.warn(msg)
        if (window.$showNotification) {
          window.$showNotification(msg, 'warning')
        }
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
    if (schedulePlayback.value) return playScheduleAt(neighborIndex(-1), -1)
    const request = ++playbackRequest
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
        duration.value = 0 // 重置时长
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
          const options: { unblock?: boolean; musicInfo?: MusicTrackMeta } = isPodcast
            ? { unblock: false }
            : {}
          options.musicInfo = {
            name: prevSong.title,
            artist: prevSong.artist,
            album: prevSong.album || undefined,
            rawItem: prevSong
          }

          const url = await getMusicUrl(
            prevSong.musicPlatform,
            prevSong.musicId,
            prevSong.playUrl,
            options
          )
          if (request !== playbackRequest) return false
          if (url) {
            prevSong.musicUrl = url
            currentPlaylistIndex.value = prevIndex
            currentSong.value = prevSong
            currentPosition.value = 0
            duration.value = 0 // 重置时长
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
  const isCurrentPlaying = (songId: number | string) => {
    return isPlaying.value && currentSong.value && String(currentSong.value.id) === String(songId)
  }

  // 检查指定ID的歌曲是否为当前歌曲（不管是否在播放）
  const isCurrentSong = (songId: number | string) => {
    return currentSong.value && String(currentSong.value.id) === String(songId)
  }

  // 检查是否有下一首歌曲
  const hasNext = computed(() => {
    return neighborIndex(1) >= 0
  })

  // 检查是否有上一首歌曲
  const hasPrevious = computed(() => {
    return neighborIndex(-1) >= 0
  })

  // 预载下一首歌曲的封面与歌词（切歌时直接命中缓存，减少等待）
  const preloadNextSongAssets = (song: PlayableSong) => {
    if (typeof window === 'undefined') return

    // 封面预载
    if (song.cover) {
      const img = new Image()
      const clear = () => {
        if (pendingCoverImage === img) pendingCoverImage = null
      }
      img.onload = clear
      img.onerror = clear
      img.src = song.cover
      pendingCoverImage = img
    }

    // 歌词预载：静默请求，参数与正式取词路径一致以命中 getLyrics 的请求缓存
    if (song.musicPlatform && song.musicId) {
      try {
        const { getLyrics } = useMusicSources()
        getLyrics(song.musicPlatform as 'netease' | 'tencent', song.musicId, {
          title: song.title,
          artist: song.artist,
          album: song.album || undefined,
          duration: song.duration || undefined,
          priority: useLyricSettings().lyricPriority.value
        }).catch(() => {})
      } catch (error) {
        console.warn('[AudioPlayer] 歌词预载失败:', error)
      }
    }
  }

  // 提前预加载下一首歌曲的URL
  let isPrefetching = false
  const prefetchNextSong = async () => {
    if (isPrefetching || !hasNext.value) return false
    
    const nextIndex = neighborIndex(1)
    const nextSong = currentPlaylist.value[nextIndex]?.song
    const request = playbackRequest

    if (!nextSong) return false

    // 封面与歌词预载不依赖播放 URL，先行触发
    preloadNextSongAssets(nextSong)

    if (nextSong.musicUrl || !nextSong.musicPlatform || !nextSong.musicId) {
      return false
    }

    isPrefetching = true
    try {
      const { getMusicUrl } = await import('~/utils/musicUrl')

      const isPodcast =
        nextSong.musicPlatform === 'netease-podcast' ||
        nextSong.sourceInfo?.type === 'voice' ||
        (nextSong.sourceInfo?.source === 'netease-backup' &&
          nextSong.sourceInfo?.type === 'voice')
      const options: { unblock?: boolean; musicInfo?: MusicTrackMeta } = isPodcast
        ? { unblock: false }
        : {}
      options.musicInfo = {
        name: nextSong.title,
        artist: nextSong.artist,
        album: nextSong.album || undefined,
        rawItem: nextSong
      }

      const url = await getMusicUrl(
        nextSong.musicPlatform,
        nextSong.musicId,
        nextSong.playUrl,
        options
      )
      
      if (url && request === playbackRequest && currentPlaylist.value[neighborIndex(1)]?.song === nextSong) {
        nextSong.musicUrl = url
        console.log(`成功预加载下一首歌曲: ${nextSong.title}`)
      }
    } catch (error) {
      console.warn(`预加载下一首歌曲《${nextSong.title}》失败:`, error)
      // 注意：这里不显示错误通知，失败会在真正尝试播放时处理并提示
    } finally {
      isPrefetching = false
    }
    return true
  }

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
    if (currentSong.value && String(currentSong.value.id) === String(updatedSong.id)) {
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
    beginPlaybackRequest: () => ++playbackRequest,
    getPlaybackRequest: () => playbackRequest,
    isPlaybackRequestCurrent: (request: number) => request === playbackRequest,
    playScheduleSong,
    isCurrentScheduleItem,
    resumeSong,
    setPlaybackStatus,
    syncSchedulePlaylist,
    activateScheduleBinding,
    clearScheduleBinding,
    handleScheduleEnded,
    scheduleSource: computed(() => schedulePlayback.value?.source || null),
    scheduleFinished: computed(() => schedulePlayback.value?.finished === true),
    scheduleWaiting: computed(() => schedulePlayback.value?.waiting === true),
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
    prefetchNextSong,
    getCurrentPlaylist,
    getCurrentPlaylistIndex
  }
}
