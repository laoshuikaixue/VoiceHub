import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import type { Song, Schedule, PlayTime } from '~/types'

export const useSongs = () => {
  const { getAuthHeader, isAuthenticated, user } = useAuth()
  
  const songs = ref<Song[]>([])
  const publicSchedules = ref<Schedule[]>([])
  const publicSongs = ref<Song[]>([])
  const loading = ref(false)
  const error = ref('')
  const notification = ref({ show: false, message: '', type: '' })
  const similarSongFound = ref<Song | null>(null)
  const playTimes = ref<PlayTime[]>([])
  const playTimeEnabled = ref(false)
  
  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // 使用全局通知
    if (window.$showNotification) {
      window.$showNotification(message, type)
    } else {
      // 备用方案：使用本地通知
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
        playTimes.value = response.playTimes.map(pt => ({
          id: pt.id,
          name: pt.name,
          startTime: pt.startTime || undefined,  // 将null转换为undefined
          endTime: pt.endTime || undefined,      // 将null转换为undefined
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
  
  // 获取歌曲列表（需要登录）- 显示加载状态
  const fetchSongs = async (silent = false) => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能获取歌曲列表'
      return
    }
    
    if (!silent) {
    loading.value = true
    }
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      // 使用fetch代替$fetch，以确保认证头被正确发送
      const response = await fetch('/api/songs', {
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `获取歌曲列表失败: ${response.status}`)
      }
      
      const data = await response.json()
      songs.value = data as Song[]
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
  
  // 获取公共歌曲列表（无需登录）
  const fetchPublicSongs = async () => {
    loading.value = true
    error.value = ''
    
    try {
      const data = await $fetch('/api/songs/public')
      
      // 如果API返回的是排期列表，提取歌曲信息
      if (Array.isArray(data)) {
        const schedules = data as Schedule[];
        publicSchedules.value = schedules;
        
        // 从排期中提取不重复的歌曲
        const songsMap = new Map<string, Song>();
        schedules.forEach(schedule => {
          if (schedule.song) {
            const songId = String(schedule.song.id);
            if (!songsMap.has(songId)) {
              // 将排期中的歌曲信息转换为完整的Song对象
              const completeSong: Song = {
                id: schedule.song.id,
                title: schedule.song.title,
                artist: schedule.song.artist,
                requester: schedule.song.requester,
                requesterId: 0, // 默认值，公共API不提供这个信息
                voteCount: schedule.song.voteCount,
                played: false, // 默认未播放
                playedAt: null,
                semester: null,
                createdAt: new Date().toISOString(), // 使用当前时间作为默认值
                cover: schedule.song.cover || null,
                musicPlatform: schedule.song.musicPlatform || null,
                musicId: schedule.song.musicId || null
              };
              songsMap.set(songId, completeSong);
            }
          }
        });
        
        publicSongs.value = Array.from(songsMap.values());
      }
    } catch (err: any) {
      error.value = err.message || '获取公共歌曲列表失败'
    } finally {
      loading.value = false
    }
  }
  
  // 获取公共排期（无需登录）
  const fetchPublicSchedules = async (silent = false) => {
    if (!silent) {
    loading.value = true
    }
    error.value = ''
    
    try {
      const data = await $fetch('/api/songs/public')
      
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
      
      // 同时从排期中提取歌曲信息
      await fetchPublicSongs()
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
  
  // 检查相似歌曲
  const checkSimilarSongs = (title: string, artist: string): Song | null => {
    similarSongFound.value = null
    
    // 检查是否已有完全相同歌曲
    const exactSong = songs.value.find(song => 
      song.title.toLowerCase() === title.toLowerCase() && 
      song.artist.toLowerCase() === artist.toLowerCase()
    )
    
    if (exactSong) {
      return exactSong
    }
    
    // 检查相似歌曲
    const possibleSimilar = songs.value.find(song => 
      song.title.toLowerCase().includes(title.toLowerCase()) || 
      title.toLowerCase().includes(song.title.toLowerCase())
    )
    
    if (possibleSimilar) {
      similarSongFound.value = possibleSimilar
      return possibleSimilar
    }
    
    return null
  }
  
  // 请求歌曲
  const requestSong = async (songData: {
    title: string,
    artist: string,
    preferredPlayTimeId?: number | null,
    cover?: string | null,
    musicPlatform?: string | null,
    musicId?: string | null
  }) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能点歌', 'error')
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/songs/request', {
        method: 'POST',
        body: songData,
        headers: authHeaders.headers
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
  const voteSong = async (songId: number | {id: number, unvote?: boolean}) => {
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
      const targetSong = songs.value.find(s => s.id === actualSongId)
      
      if (!isUnvote && targetSong && targetSong.voted) {
        showNotification('您已经为这首歌投过票了', 'info')
        loading.value = false
        return null
      }
      
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      try {
        const data = await $fetch('/api/songs/vote', {
          method: 'POST',
          body: { 
            songId: actualSongId,
            unvote: isUnvote // 添加取消投票参数
          },
          headers: authHeaders.headers
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
      const targetSong = songs.value.find(s => s.id === songId)
      const songTitle = targetSong ? targetSong.title : '歌曲'
      
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/songs/withdraw', {
        method: 'POST',
        body: { songId },
        headers: authHeaders.headers
      })
      
      // 更新歌曲列表
      await fetchSongs()
      
      // 显示成功通知
      showNotification(`已成功撤回《${songTitle}》的投稿`, 'success')
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
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/admin/songs/delete', {
        method: 'POST',
        body: { songId },
        headers: authHeaders.headers
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
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/admin/mark-played', {
        method: 'POST',
        body: { songId },
        headers: authHeaders.headers
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
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/admin/mark-played', {
        method: 'POST',
        body: { songId, unmark: true },
        headers: authHeaders.headers
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
  
  // 按热度排序的歌曲
  const songsByPopularity = computed(() => {
    return [...songs.value].sort((a, b) => b.voteCount - a.voteCount)
  })
  
  // 按创建时间排序的歌曲
  const songsByDate = computed(() => {
    return [...songs.value].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  })
  
  // 已播放的歌曲
  const playedSongs = computed(() => {
    return songs.value.filter(song => song.played)
  })
  
  // 未播放的歌曲
  const unplayedSongs = computed(() => {
    return songs.value.filter(song => !song.played)
  })
  
  // 我的投稿歌曲
  const mySongs = computed(() => {
    if (!user.value) return []
    return songs.value.filter(song => song.requesterId === user.value?.id)
  })
  
  // 所有可见的歌曲（登录用户看到的 + 公共歌曲）
  const visibleSongs = computed(() => {
    if (songs.value && songs.value.length > 0) {
      return songs.value;
    } else {
      return publicSongs.value;
    }
  })
  
  // 根据播放时间段过滤歌曲排期
  const filterSchedulesByPlayTime = (schedules: Schedule[], playTimeId: number | null) => {
    if (playTimeId === null) {
      return schedules.filter(s => s.playTimeId === null)
    }
    return schedules.filter(s => s.playTimeId === playTimeId)
  }
  
  // 获取播放时间名称
  const getPlayTimeName = (playTimeId: number | null) => {
    if (playTimeId === null) {
      return '未指定时段'
    }
    
    const foundTime = playTimes.value.find(pt => pt.id === playTimeId)
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
    loading,
    error,
    notification,
    similarSongFound,
    playTimes,
    playTimeEnabled,
    showNotification,
    fetchSongs,
    fetchPublicSongs,
    fetchPublicSchedules,
    fetchPlayTimes,
    refreshSongsSilent,
    refreshSchedulesSilent,
    checkSimilarSongs,
    requestSong,
    voteSong,
    withdrawSong,
    deleteSong,
    markPlayed,
    unmarkPlayed,
    filterSchedulesByPlayTime,
    getPlayTimeName,
    formatPlayTimeDisplay,
    initialize,
    songsByPopularity,
    songsByDate,
    playedSongs,
    unplayedSongs,
    mySongs
  }
} 