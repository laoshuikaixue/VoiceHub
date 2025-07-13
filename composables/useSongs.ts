import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import type { Song, Schedule } from '~/types'

export const useSongs = () => {
  const { getAuthHeader, isAuthenticated, user } = useAuth()
  
  const songs = ref<Song[]>([])
  const publicSchedules = ref<Schedule[]>([])
  const publicSongs = ref<Song[]>([])
  const loading = ref(false)
  const error = ref('')
  const notification = ref({ show: false, message: '', type: '' })
  const similarSongFound = ref<Song | null>(null)
  
  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
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
  
  // 获取歌曲列表（需要登录）
  const fetchSongs = async () => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能获取歌曲列表'
      return
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      console.log('获取歌曲列表，认证头:', authHeaders.headers ? '已设置' : '未设置')
      
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
      console.error('获取歌曲列表错误:', err)
    } finally {
      loading.value = false
    }
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
                createdAt: new Date().toISOString() // 使用当前时间作为默认值
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
  const fetchPublicSchedules = async () => {
    loading.value = true
    error.value = ''
    
    try {
      const data = await $fetch('/api/songs/public')
      
      // 确保每个排期的歌曲都有played属性
      const processedData = data.map((schedule: Schedule) => {
        if (schedule.song && schedule.song.played === undefined) {
          schedule.song.played = false
        }
        return schedule
      })
      
      publicSchedules.value = processedData as Schedule[]
      
      // 同时从排期中提取歌曲信息
      await fetchPublicSongs()
    } catch (err: any) {
      error.value = err.message || '获取排期失败'
    } finally {
      loading.value = false
    }
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
  
  // 点歌
  const requestSong = async (title: string, artist: string) => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能点歌'
      showNotification('需要登录才能点歌', 'error')
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 检查是否已有相同歌曲
      const similarSong = checkSimilarSongs(title, artist)
      
      if (similarSong && similarSong.title.toLowerCase() === title.toLowerCase() && 
          similarSong.artist.toLowerCase() === artist.toLowerCase()) {
        showNotification(`《${title}》已经在列表中，不能重复投稿`, 'error')
        loading.value = false
        return null
      }
      
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      // 使用fetch代替$fetch，以确保认证头被正确发送
      const response = await fetch('/api/songs/request', {
        method: 'POST',
        headers: {
          ...authHeaders.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, artist })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `点歌失败: ${response.status}`)
      }
      
      const data = await response.json()
      
      // 更新歌曲列表
      await fetchSongs()
      
      showNotification('点歌成功！', 'success')
      return data
    } catch (err: any) {
      const errorMsg = err.message || '点歌失败'
      error.value = errorMsg
      showNotification(errorMsg, 'error')
      return null
    } finally {
      loading.value = false
    }
  }
  
  // 投票
  const voteSong = async (songId: number) => {
    if (!isAuthenticated.value) {
      showNotification('需要登录才能投票', 'error')
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 检查是否已经投过票
      const targetSong = songs.value.find(s => s.id === songId)
      if (targetSong && targetSong.voted) {
        showNotification('您已经为这首歌投过票了', 'info')
        loading.value = false
        return null
      }
      
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      try {
        const data = await $fetch('/api/songs/request', {
          method: 'POST',
          body: { 
            songId: songId,
            isVoteOnly: true
          },
          headers: authHeaders.headers
        })
        
        // 不再显示通知，由调用方处理
        return data
      } catch (fetchErr: any) {
        // 处理API返回的错误
        const errorMsg = fetchErr.data?.message || fetchErr.message || '投票失败'
        
        // 如果是已投票错误，只显示通知，不抛出异常
        if (errorMsg.includes('已经为这首歌投过票')) {
          showNotification('您已经为这首歌投过票了', 'info')
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
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/songs/withdraw', {
        method: 'POST',
        body: { songId },
        headers: authHeaders.headers
      })
      
      // 更新歌曲列表
      await fetchSongs()
      
      showNotification('歌曲已成功撤回！', 'success')
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
  
  return {
    songs,
    publicSongs,
    publicSchedules,
    visibleSongs,
    loading,
    error,
    notification,
    similarSongFound,
    fetchSongs,
    fetchPublicSongs,
    fetchPublicSchedules,
    requestSong,
    voteSong,
    withdrawSong,
    deleteSong,
    markPlayed,
    unmarkPlayed,
    checkSimilarSongs,
    showNotification,
    songsByPopularity,
    songsByDate,
    playedSongs,
    unplayedSongs,
    mySongs
  }
} 