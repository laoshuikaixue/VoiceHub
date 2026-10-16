import { $fetch, useAsyncData, useRequestHeaders } from '#imports'
import type { Schedule, User } from '~/types'

interface HomeBootstrapData {
  config: Record<string, any> | null
  user: User | null
  schedules: Schedule[]
  count: number
}

// 与 useSongs 的 fetchPublicSchedules 保持一致的后处理
const processSchedules = (data: any): Schedule[] => {
  if (!Array.isArray(data)) return []
  return data.map((schedule: any) => {
    if (schedule.song && schedule.song.played === undefined) {
      schedule.song.played = false
    }

    let processedPlayTime = null
    if (schedule.playTime) {
      processedPlayTime = {
        ...schedule.playTime,
        startTime: schedule.playTime.startTime || undefined,
        endTime: schedule.playTime.endTime || undefined
      }
    }

    return { ...schedule, playTime: processedPlayTime } as Schedule
  })
}

// 首页首屏数据 SSR 预取：并行拉取站点配置、登录态、公共排期、歌曲总数
export const useHomeBootstrap = () => {
  return useAsyncData<HomeBootstrapData>('home-bootstrap', async () => {
    // SSR 阶段透传请求 cookie，保证内部接口按当前用户身份鉴权与 masking
    const headers: Record<string, string> = {}
    if (import.meta.server) {
      const reqHeaders = useRequestHeaders(['cookie'])
      if (reqHeaders.cookie) headers.cookie = reqHeaders.cookie
    }

    const [configRes, verifyRes, schedulesRes, countRes] = await Promise.all([
      $fetch('/api/site-config', { headers }).catch(() => null),
      $fetch<{ user?: User }>('/api/auth/verify', { headers }).catch(() => null),
      $fetch('/api/songs/public', { headers }).catch(() => []),
      $fetch('/api/songs/count', { headers }).catch(() => null)
    ])

    return {
      config: configRes || null,
      // verify 失败或 401 一律按访客处理，SSR 阶段不做跳转
      user: verifyRes?.user || null,
      schedules: processSchedules(schedulesRes),
      count: typeof countRes?.count === 'number' ? countRes.count : 0
    }
  })
}
