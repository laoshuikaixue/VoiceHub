import { computed, ref } from 'vue'
import { useAuth } from './useAuth'
import { getGlobalDedup } from './useRequestDedup'
import type { PlayTime, Schedule, Song } from '~/types'

export const useSongs = () => {
  const { isAuthenticated, user, getAuthConfig, isAdmin } = useAuth()
  const dedup = getGlobalDedup()

  const songs = ref<Song[]>([])
  const publicSchedules = ref<Schedule[]>([])
  const publicSongs = ref<Song[]>([])
  const loading = ref(false)
  const error = ref('')
  const notification = ref({ show: false, message: '', type: '' })
  const similarSongFound = ref<Song | null>(null)
  const playTimes = ref<PlayTime[]>([])
  const playTimeEnabled = ref(false)
  const songCount = ref(0)

  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // 使用全局通知
    if (window.$showNotification) {
      window.$showNotification(message, type)
    } else {
      // 备用方案
      notification.value = {
        show: true,
        message,
        type
      }

      // 3秒后自动关闭
      setTimeout(() => {
        notification.value.show = false
      }, 3000)
    }
  }

  // 获取播放时段列表
  const fetchPlayTimes = async () => {
    loading.value = true
    error.value = ''

    try {
      const response = await $fetch('/api/play-times')
      playTimeEnabled.value = response.enabled

      // 确保类型兼容性
      if (response.playTimes && Array.isArray(response.playTimes)) {
        playTimes.value = response.playTimes.map((pt) => ({
          id: pt.id,
          name: pt.name,
          startTime: pt.startTime || undefined,
          endTime: pt.endTime || undefined,
          enabled: pt.enabled,
          description: pt.description || undefined
        }))
      } else {
        playTimes.value = []
      }

      return response
    } catch (err: any) {
      error.value = err.message || '获取播放时段失败'
      return { enabled: false, playTimes: [] }
    } finally {
      loading.value = false
    }
  }

  // 获取歌曲列表
  const fetchSongs = async (
    silent = false,
    semester?: string,
    forceRefresh = false,
    bypassCache = false
  ) => {
    if (!silent) {
      loading.value = true
    }
    error.value = ''

    try {
      const requestParams = semester ? { semester } : undefined

      const response = await dedup.dedupedRequest(
        'songs',
        async () => {
          // 构建URL参数
          const params = new URLSearchParams()
          if (semester) {
            params.append('semester', semester)
          }
          // 只有当 bypassCache 为 true 时才添加 bypass_cache 参数
          if (bypassCache) {
            params.append('bypass_cache', 'true')
          }
          const url = `/api/songs${params.toString() ? '?' + params.toString() : ''}`

          // API请求
          return await $fetch(url)
        },
        requestParams
      )

      // 正确解析API返回的数据结构
      if (response && response.success && response.data && Array.isArray(response.data.songs)) {
        songs.value = response.data.songs as Song[]
      } else {
        songs.value = []
        console.warn('API返回的数据格式不正确:', response)
      }
    } catch (err: any) {
      error.value = err.message || '获取歌曲列表失败'
    } finally {
      if (!silent) {
        loading.value = false
      }
    }
  }

  // 静默刷新歌曲列表 - 不显示加载状态
  const refreshSongsSilent = async () => {
    return fetchSongs(true)
  }

  // 从排期数据中提取歌曲信息
  const extractSongsFromSchedules = (schedules: Schedule[]): Song[] => {
    const songsMap = new Map<string, Song>()

    schedules.forEach((schedule) => {
      if (schedule.song) {
        const songId = String(schedule.song.id)
        if (!songsMap.has(songId)) {
          // 将排期中的歌曲信息转换为完整的Song对象
          const completeSong: Song = {
            id: schedule.song.id,
            title: schedule.song.title,
            artist: schedule.song.artist,
            requester: schedule.song.requester,
            requesterId: 0, // 默认值，公共API不提供这个信息
            voteCount: schedule.song.voteCount,
            played: schedule.song.played || false,
            playedAt: schedule.song.playedAt || null,
            semester: schedule.song.semester || null,
            requestedAt: schedule.song.requestedAt || new Date().toISOString(),
            cover: schedule.song.cover || null,
            musicPlatform: schedule.song.musicPlatform || null,
            musicId: schedule.song.musicId || null
          }
          songsMap.set(songId, completeSong)
        }
      }
    })

    return Array.from(songsMap.values())
  }

  // 获取公共排期（无需登录）
  const fetchPublicSchedules = async (
    silent = false,
    semester?: string,
    forceRefresh = false,
    bypassCache = false
  ) => {
    if (!silent) {
      loading.value = true
    }
    error.value = ''

    try {
      const requestParams = semester ? { semester } : undefined

      const data = await dedup.dedupedRequest(
        'public-schedules',
        async () => {
          // 构建URL参数
          const params = new URLSearchParams()
          if (semester) {
            params.append('semester', semester)
          }
          // 只有当 bypassCache 为 true 时才添加 bypass_cache 参数
          if (bypassCache) {
            params.append('bypass_cache', 'true')
          }
          const url = `/api/songs/public${params.toString() ? '?' + params.toString() : ''}`

          const response = await $fetch(url)
          return response
        },
        requestParams
      )

      // 确保每个排期的歌曲都有played属性，并处理null/undefined转换
      const processedData = data.map((schedule: any) => {
        // 处理歌曲属性
        if (schedule.song && schedule.song.played === undefined) {
          schedule.song.played = false
        }

        // 处理播放时间属性
        let processedPlayTime = null
        if (schedule.playTime) {
          processedPlayTime = {
            ...schedule.playTime,
            startTime: schedule.playTime.startTime || undefined,
            endTime: schedule.playTime.endTime || undefined
          }
        }

        // 返回符合Schedule类型的对象
        return {
          ...schedule,
          playTime: processedPlayTime
        } as Schedule
      })

      publicSchedules.value = processedData

      // 直接从排期数据中提取歌曲信息，避免重复请求
      publicSongs.value = extractSongsFromSchedules(processedData)
    } catch (err: any) {
      error.value = err.message || '获取排期失败'
    } finally {
      if (!silent) {
        loading.value = false
      }
    }
  }

  // 静默刷新公共排期 - 不显示加载状态
  const refreshSchedulesSilent = async () => {
    return fetchPublicSchedules(true)
  }

  // 字符串相似度计算（编辑距离）
  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length
    const len2 = str2.length

    if (len1 === 0) return len2
    if (len2 === 0) return len1

    const matrix = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(null))

    for (let i = 0; i <= len1; i++) matrix[i][0] = i
    for (let j = 0; j <= len2; j++) matrix[0][j] = j

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // 删除
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j - 1] + cost // 替换
        )
      }
    }

    const maxLen = Math.max(len1, len2)
    return (maxLen - matrix[len1][len2]) / maxLen
  }

  // 标准化字符串（去除标点符号、空格，转换为小写）
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉""''""''、，。！？：；～·]/g, '')
      .replace(/[&＆]/g, 'and')
      .replace(/[feat\.?|ft\.?]/gi, '')
      .trim()
  }

  // 获取当前学期名称（从数据库）
  const getCurrentSemesterName = async () => {
    try {
      const response = await fetch('/api/semesters/current')
      if (!response.ok) {
        throw new Error('获取当前学期失败')
      }
      const data = await response.json()
      return data?.name || null
    } catch (error) {
      console.error('获取当前学期失败:', error)
      return null
    }
  }

  // 检查相似歌曲
  const checkSimilarSongs = async (title: string, artist: string): Promise<Song[]> => {
    similarSongFound.value = null

    const normalizedTitle = normalizeString(title)
    const normalizedArtist = normalizeString(artist)

    // 获取当前学期名称
    const currentSemesterName = await getCurrentSemesterName()

    // 1. 检查完全相同的歌曲（标准化后）
    const exactSongs = songs.value.filter((song) => {
      const songTitle = normalizeString(song.title)
      const songArtist = normalizeString(song.artist)
      const titleMatch = songTitle === normalizedTitle && songArtist === normalizedArtist

      // 如果有当前学期信息，只检查当前学期的歌曲
      if (currentSemesterName) {
        return titleMatch && song.semester === currentSemesterName
      }

      // 如果没有学期信息，检查所有歌曲（向后兼容）
      return titleMatch
    })

    if (exactSongs.length > 0) {
      return exactSongs
    }

    // 2. 检查高度相似的歌曲
    const similarSongs: Array<{ song: Song; similarity: number }> = []

    songs.value.forEach((song) => {
      // 如果有当前学期信息，只检查当前学期的歌曲
      if (currentSemesterName && song.semester !== currentSemesterName) {
        return
      }

      const songTitle = normalizeString(song.title)
      const songArtist = normalizeString(song.artist)

      // 计算标题相似度
      const titleSimilarity = calculateSimilarity(normalizedTitle, songTitle)

      // 计算艺术家相似度
      const artistSimilarity = calculateSimilarity(normalizedArtist, songArtist)

      // 检查是否为高度相似
      const isHighlySimilar =
        // 标题完全相同，艺术家高度相似
        (titleSimilarity >= 0.95 && artistSimilarity >= 0.8) ||
        // 标题高度相似，艺术家完全相同
        (titleSimilarity >= 0.8 && artistSimilarity >= 0.95) ||
        // 标题和艺术家都高度相似
        (titleSimilarity >= 0.85 && artistSimilarity >= 0.85) ||
        // 标题包含关系且艺术家相似
        ((songTitle.includes(normalizedTitle) || normalizedTitle.includes(songTitle)) &&
          artistSimilarity >= 0.8 &&
          Math.abs(songTitle.length - normalizedTitle.length) <= 3)

      if (isHighlySimilar) {
        const overallSimilarity = titleSimilarity * 0.7 + artistSimilarity * 0.3
        similarSongs.push({ song, similarity: overallSimilarity })
      }
    })

    // 3. 按相似度排序并返回
    if (similarSongs.length > 0) {
      const sortedSimilar = similarSongs
        .sort((a, b) => b.similarity - a.similarity)
        .map((item) => item.song)

      similarSongFound.value = sortedSimilar[0] // 保持兼容性
      return sortedSimilar
    }

    // 4. 如果没有高度相似的，检查可能的相似歌曲（降低阈值）
    const possibleSimilar: Array<{ song: Song; similarity: number }> = []

    songs.value.forEach((song) => {
      // 如果有当前学期信息，只检查当前学期的歌曲
      if (currentSemesterName && song.semester !== currentSemesterName) {
        return
      }

      const songTitle = normalizeString(song.title)
      const songArtist = normalizeString(song.artist)

      const titleSimilarity = calculateSimilarity(normalizedTitle, songTitle)
      const artistSimilarity = calculateSimilarity(normalizedArtist, songArtist)

      // 检查可能相似的条件（更宽松）
      const isPossiblySimilar =
        // 标题相似度较高
        (titleSimilarity >= 0.7 && artistSimilarity >= 0.6) ||
        // 标题包含关系
        ((songTitle.includes(normalizedTitle) || normalizedTitle.includes(songTitle)) &&
          artistSimilarity >= 0.5 &&
          normalizedTitle.length >= 3)

      if (isPossiblySimilar) {
        const overallSimilarity = titleSimilarity * 0.7 + artistSimilarity * 0.3
        possibleSimilar.push({ song, similarity: overallSimilarity })
      }
    })

    if (possibleSimilar.length > 0) {
      const sortedPossible = possibleSimilar
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3) // 最多返回3个可能相似的歌曲
        .map((item) => item.song)

      similarSongFound.value = sortedPossible[0] // 保持兼容性
      return sortedPossible
    }

    return []
  }

  // 请求歌曲
  const requestSong = async (songData: {
    title: string
    artist: string
    preferredPlayTimeId?: number | null
    cover?: string | null
    musicPlatform?: string | null
    musicId?: string | null
  }) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能点歌', 'error')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/songs/request', {
        method: 'POST',
        body: songData,
        ...authConfig
      })

      // 更新歌曲列表
      await fetchSongs()

      return data
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || '点歌失败'
      // 如果是重复投稿错误，只显示通知而不设置全局错误
      if (errorMsg.includes('已经在列表中') || errorMsg.includes('不能重复投稿')) {
        showNotification(errorMsg, 'info')
      } else {
        error.value = errorMsg
        showNotification(errorMsg, 'error')
      }
      return null
    } finally {
      loading.value = false
    }
  }

  // 投票
  const voteSong = async (songId: number | { id: number; unvote?: boolean }) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能投票', 'error')
      return null
    }

    loading.value = true
    error.value = ''

    // 处理传入的可能是对象的情况
    const actualSongId = typeof songId === 'object' ? songId.id : songId
    const isUnvote = typeof songId === 'object' && songId.unvote === true

    try {
      // 检查是否已经投过票（只在正常投票时检查）
      const targetSong = songs.value.find((s) => s.id === actualSongId)

      if (!isUnvote && targetSong && targetSong.voted) {
        showNotification('您已经为这首歌投过票了', 'info')
        loading.value = false
        return null
      }

      // 使用认证配置
      const authConfig = getAuthConfig()

      try {
        const data = await $fetch('/api/songs/vote', {
          method: 'POST',
          body: {
            songId: actualSongId,
            unvote: isUnvote // 添加取消投票参数
          },
          ...authConfig
        })

        // 立即更新本地歌曲的投票状态
        if (targetSong) {
          if (isUnvote) {
            // 取消投票
            targetSong.voted = false
            targetSong.voteCount = Math.max(0, (targetSong.voteCount || 1) - 1)
            showNotification(`已取消对歌曲《${targetSong.title}》的投票`, 'success')
          } else {
            // 正常投票
            targetSong.voted = true
            targetSong.voteCount = (targetSong.voteCount || 0) + 1
            showNotification(`为歌曲《${targetSong.title}》投票成功！`, 'success')
          }
        }

        return data
      } catch (fetchErr: any) {
        // 处理API返回的错误
        const errorMsg = fetchErr.data?.message || fetchErr.message || '投票失败'

        // 如果是已投票错误，只显示通知，不抛出异常
        if (errorMsg.includes('已经为这首歌投过票')) {
          showNotification('您已经为这首歌投过票了', 'info')

          // 如果API返回已投票错误，也更新本地状态
          if (targetSong && !targetSong.voted) {
            targetSong.voted = true
          }

          return null
        }

        // 其他错误则抛出
        throw fetchErr
      }
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || '投票失败'
      error.value = errorMsg
      showNotification(errorMsg, 'error')
      return null
    } finally {
      loading.value = false
    }
  }

  // 撤回歌曲（只能撤回自己的投稿）
  const withdrawSong = async (songId: number) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能撤回歌曲', 'error')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 查找歌曲信息用于通知
      const targetSong = songs.value.find((s) => s.id === songId)
      const songTitle = targetSong ? targetSong.title : '歌曲'

      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/songs/withdraw', {
        method: 'POST',
        body: { songId },
        ...authConfig
      })

      // 更新歌曲列表
      await fetchSongs()

      // 显示成功通知
      let message = ''
      if (data.action === 'leave') {
        message = `已成功退出歌曲《${songTitle}》的联合投稿`
      } else if (data.message) {
        // 如果后端返回了特定消息，优先使用（除了撤回投稿的情况，我们要保留带标题的格式）
        message = data.message
      } else {
        message = data.quotaReturned
          ? `已成功撤回《${songTitle}》的投稿，投稿配额已返还`
          : `已成功撤回《${songTitle}》的投稿`
      }

      if (data.action !== 'leave') {
        message = data.quotaReturned
          ? `已成功撤回《${songTitle}》的投稿，投稿配额已返还`
          : `已成功撤回《${songTitle}》的投稿`
      }

      showNotification(message, 'success')
      return data
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || '撤回歌曲失败'
      error.value = errorMsg
      showNotification(errorMsg, 'error')
      return null
    } finally {
      loading.value = false
    }
  }

  // 删除歌曲（管理员专用）
  const deleteSong = async (songId: number) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能删除歌曲', 'error')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/songs/delete', {
        method: 'POST',
        body: { songId },
        ...authConfig
      })

      // 更新歌曲列表
      await fetchSongs()

      showNotification('歌曲已成功删除！', 'success')
      return data
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || '删除歌曲失败'
      error.value = errorMsg
      showNotification(errorMsg, 'error')
      return null
    } finally {
      loading.value = false
    }
  }

  // 标记歌曲为已播放（管理员专用）
  const markPlayed = async (songId: number) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能标记歌曲', 'error')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/mark-played', {
        method: 'POST',
        body: { songId },
        ...authConfig
      })

      // 更新歌曲列表
      await fetchSongs()

      showNotification('歌曲已成功标记为已播放！', 'success')
      return data
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || '标记歌曲失败'
      error.value = errorMsg
      showNotification(errorMsg, 'error')
      return null
    } finally {
      loading.value = false
    }
  }

  // 撤回歌曲已播放状态（管理员专用）
  const unmarkPlayed = async (songId: number) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能撤回歌曲已播放状态', 'error')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      // 使用认证配置
      const authConfig = getAuthConfig()

      const data = await $fetch('/api/admin/mark-played', {
        method: 'POST',
        body: { songId, unmark: true },
        ...authConfig
      })

      // 更新歌曲列表
      await fetchSongs()

      showNotification('歌曲已成功撤回已播放状态！', 'success')
      return data
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || '撤回歌曲已播放状态失败'
      error.value = errorMsg
      showNotification(errorMsg, 'error')
      return null
    } finally {
      loading.value = false
    }
  }

  // 申请重播
  const requestReplay = async (songId: number) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能申请重播', 'error')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()
      const data = await $fetch('/api/songs/replay', {
        method: 'POST',
        body: { songId },
        ...authConfig
      })

      // 更新本地数据状态
      const songIndex = songs.value.findIndex((s) => s.id === songId)
      if (songIndex !== -1) {
        songs.value[songIndex].replayRequested = true
      }

      showNotification('申请重播成功', 'success')
      return data
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || '申请重播失败'
      if (errorMsg.includes('已经申请')) {
        showNotification('您已经申请过重播这首歌了', 'info')
      } else {
        showNotification(errorMsg, 'error')
      }
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 撤回重播申请
   * @param songId 歌曲ID
   */
  const withdrawReplay = async (songId: number) => {
    const { user } = useAuth()
    if (!user.value) {
      showNotification('需要登录才能取消重播申请', 'error')
      return null
    }

    loading.value = true
    error.value = ''

    try {
      const authConfig = getAuthConfig()
      const data = await $fetch('/api/songs/replay', {
        method: 'DELETE',
        body: { songId },
        ...authConfig
      })

      // 更新本地数据状态
      const songIndex = songs.value.findIndex((s) => s.id === songId)
      if (songIndex !== -1) {
        songs.value[songIndex].replayRequested = false
      }

      showNotification('已取消重播申请', 'success')
      return data
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || '取消重播申请失败'
      showNotification(errorMsg, 'error')
      return null
    } finally {
      loading.value = false
    }
  }

  // 按热度排序的歌曲
  const songsByPopularity = computed(() => {
    return [...songs.value].sort((a, b) => b.voteCount - a.voteCount)
  })

  // 按创建时间排序的歌曲
  const songsByDate = computed(() => {
    return [...songs.value].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  })

  // 已播放的歌曲
  const playedSongs = computed(() => {
    return songs.value.filter((song) => song.played)
  })

  // 未播放的歌曲
  const unplayedSongs = computed(() => {
    return songs.value.filter((song) => !song.played)
  })

  // 我的投稿歌曲
  const mySongs = computed(() => {
    if (!user.value) return []
    return songs.value.filter((song) => song.requesterId === user.value?.id)
  })

  // 我的重播申请歌曲
  const myReplaySongs = computed(() => {
    if (!user.value) return []
    return songs.value.filter((song) => song.replayRequested)
  })

  // 所有可见的歌曲（登录用户看到的 + 公共歌曲）
  const visibleSongs = computed(() => {
    if (songs.value && songs.value.length > 0) {
      return songs.value
    } else {
      return publicSongs.value
    }
  })

  // 根据播放时间段过滤歌曲排期
  const filterSchedulesByPlayTime = (schedules: Schedule[], playTimeId: number | null) => {
    if (playTimeId === null) {
      return schedules.filter((s) => s.playTimeId === null)
    }
    return schedules.filter((s) => s.playTimeId === playTimeId)
  }

  // 获取播放时间名称
  const getPlayTimeName = (playTimeId: number | null) => {
    if (playTimeId === null) {
      return '未指定时段'
    }

    const foundTime = playTimes.value.find((pt) => pt.id === playTimeId)
    return foundTime ? foundTime.name : '未知时段'
  }

  // 格式化播放时间显示
  const formatPlayTimeDisplay = (playTime: PlayTime | null) => {
    if (!playTime) {
      return '全天'
    }

    let displayText = playTime.name

    // 如果有开始和结束时间，添加时间信息
    if (playTime.startTime && playTime.endTime) {
      displayText += ` (${playTime.startTime}-${playTime.endTime})`
    }
    // 如果只有开始时间
    else if (playTime.startTime) {
      displayText += ` (${playTime.startTime}起)`
    }
    // 如果只有结束时间
    else if (playTime.endTime) {
      displayText += ` (至${playTime.endTime})`
    }

    return displayText
  }

  // 获取歌曲总数（缓存版本）
  const fetchSongCount = async (forceRefresh = false) => {
    try {
      const response = await dedup.dedupedRequest('song-count', async () => {
        const response = await $fetch('/api/songs/count')
        return response
      })

      // 正确解析API返回的数据结构
      if (response && typeof response.count === 'number') {
        songCount.value = response.count
        return response.count
      } else {
        console.warn('歌曲总数API返回的数据格式不正确:', response)
        songCount.value = 0
        return 0
      }
    } catch (err: any) {
      console.error('获取歌曲总数失败:', err)
      return 0
    }
  }

  // 初始化加载
  const initialize = async () => {
    await fetchPlayTimes()
    if (isAuthenticated.value) {
      await fetchSongs()
    } else {
      await fetchPublicSchedules()
    }
  }

  return {
    songs,
    publicSongs,
    publicSchedules,
    visibleSongs,
    songCount,
    loading,
    error,
    notification,
    similarSongFound,
    playTimes,
    playTimeEnabled,
    showNotification,
    fetchSongs,
    fetchPublicSchedules,
    fetchPlayTimes,
    fetchSongCount,
    refreshSongsSilent,
    refreshSchedulesSilent,
    checkSimilarSongs,
    requestSong,
    voteSong,
    withdrawSong,
    deleteSong,
    markPlayed,
    unmarkPlayed,
    requestReplay,
    withdrawReplay,
    filterSchedulesByPlayTime,
    getPlayTimeName,
    formatPlayTimeDisplay,
    extractSongsFromSchedules,
    initialize,
    songsByPopularity,
    songsByDate,
    playedSongs,
    unplayedSongs,
    mySongs,
    myReplaySongs
  }
}
