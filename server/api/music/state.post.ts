import { defineEventHandler, readBody } from 'h3'
import { broadcastMusicState, broadcastSongChange } from './websocket'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // 验证请求数据
    if (!body || typeof body !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: '无效的请求数据'
      })
    }

    const { type, data } = body

    switch (type) {
      case 'state_update':
        // 音乐状态更新
        if (data && typeof data === 'object') {
          const musicState = {
            songId: data.songId,
            isPlaying: Boolean(data.isPlaying),
            position: Number(data.position) || 0,
            duration: Number(data.duration) || 0,
            volume: Number(data.volume) || 1,
            playlistIndex: data.playlistIndex,
            timestamp: Date.now()
          }

          // 广播状态更新
          broadcastMusicState(musicState)

          return {
            success: true,
            message: '音乐状态已更新'
          }
        }
        break

      case 'song_change':
        // 歌曲切换
        if (data && typeof data === 'object') {
          const songInfo = {
            songId: data.songId,
            title: data.title || '',
            artist: data.artist || '',
            cover: data.cover || '',
            duration: Number(data.duration) || 0,
            playlistIndex: data.playlistIndex,
            timestamp: Date.now()
          }

          // 广播歌曲切换
          broadcastSongChange(songInfo)

          return {
            success: true,
            message: '歌曲切换已广播'
          }
        }
        break

      case 'position_update':
        // 播放位置更新
        if (data && typeof data === 'object') {
          const positionState = {
            songId: data.songId,
            isPlaying: Boolean(data.isPlaying),
            position: Number(data.position) || 0,
            duration: Number(data.duration) || 0,
            volume: Number(data.volume) || 1,
            timestamp: Date.now()
          }

          // 广播位置更新
          broadcastMusicState(positionState)

          return {
            success: true,
            message: '播放位置已更新'
          }
        }
        break

      default:
        throw createError({
          statusCode: 400,
          statusMessage: '不支持的操作类型'
        })
    }

    throw createError({
      statusCode: 400,
      statusMessage: '无效的请求数据'
    })
  } catch (error: any) {
    console.error('Music state update error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: '服务器内部错误'
    })
  }
})
