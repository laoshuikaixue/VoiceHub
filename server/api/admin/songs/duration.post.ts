import { readBody } from 'h3'
import { db } from '~/drizzle/db'
import { songs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  createTxSongDetailBody,
  normalizeTxMusicId,
  txHeaders
} from '~~/server/utils/native_tx'
import { fetchSongDuration } from '~~/server/utils/songDurationFetcher'

export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  const body = await readBody(event)

  // 新增歌曲场景：未传 songId 时按平台+音乐ID获取时长，仅返回不写入
  if (body?.songId == null) {
    const platform = body?.platform
    const musicId = body?.musicId
    if (!platform || !musicId) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.SONG_DURATION_PLATFORM_REQUIRED,
        '缺少平台或音乐 ID 信息，无法获取时长'
      )
    }
    const durationSeconds = await fetchSongDuration(String(platform), String(musicId))
    if (durationSeconds == null) {
      return { success: false, songId: null, durationSeconds: null, message: '未获取到有效时长' }
    }
    return { success: true, songId: null, durationSeconds, message: '时长获取成功' }
  }

  const songId = body.songId == null ? null : Number(body.songId)

  if (!Number.isFinite(songId) || songId < 1) {
    throw createApiError(400, SERVER_ERROR_CODES.SONG_INVALID_ID, '歌曲 ID 无效')
  }

  const song = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
  if (song.length === 0) {
    throw createApiError(404, SERVER_ERROR_CODES.SONG_NOT_FOUND, '歌曲不存在')
  }

  const s = song[0]

  // 浏览器读取或管理员手动输入时，只由服务端负责校验并保存结果。
  if (Object.prototype.hasOwnProperty.call(body || {}, 'durationSeconds')) {
    if (body.durationSeconds === null) {
      await db.update(songs).set({ durationSeconds: null }).where(eq(songs.id, songId))
      return { success: true, songId, durationSeconds: null, message: '时长已清空' }
    }

    const durationSeconds = Number(body.durationSeconds)
    if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 7200) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
        '时长需在 0 秒至 2 小时之间'
      )
    }

    if (s.durationSeconds !== durationSeconds) {
      await db.update(songs).set({ durationSeconds }).where(eq(songs.id, songId))
    }
    return {
      success: true,
      songId,
      durationSeconds,
      message: s.durationSeconds === durationSeconds ? '时长未变化' : '时长更新成功'
    }
  }

  const platform = s.musicPlatform
  const musicId = s.musicId

  if (!platform || !musicId) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.SONG_DURATION_PLATFORM_REQUIRED,
      '歌曲缺少平台或音乐 ID 信息，无法获取时长'
    )
  }

  let durationSeconds: number | null = null

  try {
    if (platform === 'netease' || platform === 'netease-podcast') {
      const response: any = await $fetch('/api/api-enhanced/netease/song/url/v1', {
        params: { id: musicId, level: 'standard' },
        timeout: 10000
      })

      if (response?.code === 200 && Array.isArray(response.data) && response.data.length > 0) {
        const timeMs = response.data[0]?.time
        if (typeof timeMs === 'number' && timeMs > 0) {
          durationSeconds = Math.floor(timeMs / 1000)
        }
      }

      if (!durationSeconds) {
        return {
          success: false,
          songId,
          durationSeconds: null,
          message: '网易云 API 未返回有效时长'
        }
      }
    } else if (platform === 'tencent') {
      const normalized = normalizeTxMusicId(musicId)
      const result: any = await $fetch(
        'https://u.y.qq.com/cgi-bin/musicu.fcg',
        {
          method: 'POST',
          headers: txHeaders,
          body: createTxSongDetailBody(normalized),
          responseType: 'json',
          timeout: 10000
        }
      )

      if (result?.code === 0 && result?.req?.code === 0) {
        const interval = result.req?.data?.track_info?.interval
        if (typeof interval === 'number' && interval > 0) {
          durationSeconds = Math.floor(interval)
        }
      }

      if (!durationSeconds) {
        return {
          success: false,
          songId,
          durationSeconds: null,
          message: 'QQ 音乐详情接口未返回有效时长'
        }
      }
    } else if (platform === 'migu') {
      const songInfo: any = await $fetch(
        `https://app.c.nf.migu.cn/resource/song/by-contentids/v2.0?contentId=${encodeURIComponent(musicId)}`,
        { timeout: 10000 }
      )

      if (songInfo?.code?.toString() === '000000' && songInfo?.data?.length) {
        const duration = songInfo.data[0]?.duration
        if (typeof duration === 'number' && duration > 0) {
          durationSeconds = Math.floor(duration)
        }
      }

      if (!durationSeconds) {
        return {
          success: false,
          songId,
          durationSeconds: null,
          message: '咪咕歌曲信息接口未返回有效时长'
        }
      }
    } else if (platform === 'bilibili') {
      // musicId 格式为 bvid:cid 或 bvid:cid:page
      const parts = musicId.split(':')
      const bvid = parts[0]
      const page = parts.length > 2 ? Number(parts[2]) : 1
      if (parts.length > 2 && (!Number.isInteger(page) || page < 1)) {
        return {
          success: false,
          songId,
          durationSeconds: null,
          message: `哔哩哔哩视频 ID 格式无效：${musicId}`
        }
      }
      const viewResp: any = await $fetch(
        'https://api.bilibili.com/x/web-interface/view',
        {
          params: { bvid },
          headers: {
            Cookie: 'buvid3=0',
            Referer: 'https://www.bilibili.com/'
          },
          timeout: 10000
        }
      )

      if (viewResp?.code === 0 && viewResp?.data?.pages?.length) {
        const pageIdx = page > 1 ? Math.max(0, page - 1) : 0
        const duration = viewResp.data.pages[pageIdx]?.duration
        if (typeof duration === 'number' && duration > 0) {
          durationSeconds = Math.floor(duration)
        }
      }

      if (!durationSeconds) {
        return {
          success: false,
          songId,
          durationSeconds: null,
          message: '哔哩哔哩视频详情接口未返回有效时长'
        }
      }
    } else {
      return {
        success: false,
        songId,
        durationSeconds: null,
        message: `暂不支持的平台：${platform}`
      }
    }

    // 网易云固定返回 30 秒时通常是试听片段，不作为歌曲完整时长。
    if ((platform === 'netease' || platform === 'netease-podcast') && durationSeconds === 30) {
      return {
        success: false,
        songId,
        durationSeconds: null,
        message: '网易云返回试听片段时长，未写入'
      }
    }

    // 校验时长范围（合理的歌曲时长：30秒~1小时）
    if (durationSeconds < 30 || durationSeconds > 3600) {
      console.warn(`[时长刷新] 歌曲 #${songId} 时长异常：${durationSeconds}s，跳过写入`)
      return {
        success: false,
        songId,
        durationSeconds: null,
        message: `获取到的时长 ${durationSeconds}s 超出合理范围（30秒~1小时），未写入`
      }
    }

    // 避免无变化写入
    if (s.durationSeconds === durationSeconds) {
      return {
        success: true,
        songId,
        durationSeconds,
        message: '时长未变化'
      }
    }

    // 写入数据库
    await db.update(songs).set({ durationSeconds }).where(eq(songs.id, songId))

    return {
      success: true,
      songId,
      durationSeconds,
      message: '时长获取成功'
    }
  } catch (err: any) {
    const errorMsg = err?.message || '未知错误'
    const platformName = platform === 'netease' || platform === 'netease-podcast' ? '网易云' : platform === 'tencent' ? 'QQ音乐' : platform === 'migu' ? '咪咕' : platform === 'bilibili' ? 'Bilibili' : platform
    const statusCode = err.statusCode || err.status || (err.response?.status as number | undefined)
    // AbortError：请求超时或批量刷新中止
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return {
        success: false,
        songId,
        durationSeconds: null,
        message: `${platformName} 响应超时`
      }
    }
    // 404：平台限流或歌曲不存在
    if (statusCode === 404) {
      return {
        success: false,
        songId,
        durationSeconds: null,
        message: `${platformName} 未找到该歌曲`
      }
    }
    if (statusCode === 403 || statusCode === 429) {
      return {
        success: false,
        songId,
        durationSeconds: null,
        message: `${platformName} 接口被限制，请稍后重试`
      }
    }
    console.error(`[时长刷新] 歌曲 #${songId} 获取时长失败 (${platformName}):`, errorMsg)

    return {
      success: false,
      songId,
      durationSeconds: null,
      message: `${platformName} 接口异常，请稍后重试`
    }
  }
})
