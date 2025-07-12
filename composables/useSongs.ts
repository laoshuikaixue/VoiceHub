import { ref, computed } from 'vue'
import { useAuth } from './useAuth'
import type { Song, Schedule } from '~/types'

export const useSongs = () => {
  const { getAuthHeader, isAuthenticated } = useAuth()
  
  const songs = ref<Song[]>([])
  const publicSchedules = ref<Schedule[]>([])
  const publicSongs = ref<Song[]>([])
  const loading = ref(false)
  const error = ref('')
  
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
      
      const data = await $fetch('/api/songs', {
        headers: authHeaders.headers
      })
      
      songs.value = data as Song[]
    } catch (err: any) {
      error.value = err.message || '获取歌曲列表失败'
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
      
      publicSchedules.value = data as Schedule[]
      
      // 同时从排期中提取歌曲信息
      await fetchPublicSongs()
    } catch (err: any) {
      error.value = err.message || '获取排期失败'
    } finally {
      loading.value = false
    }
  }
  
  // 点歌或投票
  const requestSong = async (title: string, artist: string) => {
    if (!isAuthenticated.value) {
      error.value = '需要登录才能点歌'
      return null
    }
    
    loading.value = true
    error.value = ''
    
    try {
      // 显式传递认证头
      const authHeaders = getAuthHeader()
      
      const data = await $fetch('/api/songs/request', {
        method: 'POST',
        body: { title, artist },
        headers: authHeaders.headers
      })
      
      // 更新歌曲列表
      await fetchSongs()
      
      return data
    } catch (err: any) {
      error.value = err.message || '点歌失败'
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
    fetchSongs,
    fetchPublicSongs,
    fetchPublicSchedules,
    requestSong,
    songsByPopularity,
    songsByDate,
    playedSongs,
    unplayedSongs
  }
} 