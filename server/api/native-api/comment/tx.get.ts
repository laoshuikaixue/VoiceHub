import {
  getTxSongPlayableInfo,
  TX_MUSICU_URL,
  txRequest,
  txSignedRequest
} from '~~/server/utils/native_tx'
import { normalizeQqCommentList } from '~~/server/utils/qqComment'

const isSuccessfulResponse = (response: any) =>
  response && Number(response.code) === 0 && Number(response.request?.code) === 0

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const musicId = String(query.musicId || '').trim()
  const originalSongId = String(query.songId || '').trim()
  const page = Math.max(0, Number(query.page) || 0)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const type = query.type === 'latest' ? 'latest' : 'hot'
  if (!musicId) throw createError({ statusCode: 400, message: '缺少 musicId 参数' })

  let topid = /^\d+$/.test(originalSongId) ? originalSongId : ''
  if (!topid && /^\d+$/.test(musicId)) topid = musicId
  if (!topid) {
    const info = await getTxSongPlayableInfo(musicId)
    topid = String(info.songId || '').trim()
  }
  if (!topid) throw createError({ statusCode: 502, message: 'QQ 音乐歌曲 ID 无效' })

  const requestBody = {
    comm: {
      ct: 11,
      cv: '1003006',
      v: '1003006',
      os_ver: '15',
      phonetype: '24122RKC7C',
      tmeAppID: 'qqmusiclight',
      nettype: 'NETWORK_WIFI',
      udid: '0',
      OpenUDID: '0',
      QIMEI36: '0',
      uin: '0'
    },
    request: {
      module: 'music.globalComment.CommentRead',
      method: type === 'hot' ? 'GetHotCommentList' : 'GetNewCommentList',
      param: {
        BizType: 1,
        BizId: topid,
        LastCommentSeqNo: '',
        PageSize: pageSize,
        PageNum: page,
        PicEnable: 1,
        ...(type === 'hot'
          ? { HotType: 1, WithAirborne: 0 }
          : { HashTagID: '', SelfSeeEnable: 1, AudioEnable: 1 })
      }
    }
  }

  let response: any
  try {
    response = await txRequest(TX_MUSICU_URL, requestBody, {
      signal: AbortSignal.timeout(8000)
    })
  } catch (error) {
    console.warn('[QQ评论] 直连接口请求失败，尝试签名接口:', error)
  }

  if (!isSuccessfulResponse(response)) {
    response = await txSignedRequest(requestBody, {
      signal: AbortSignal.timeout(8000)
    })
  }

  if (!isSuccessfulResponse(response)) {
    throw createError({ statusCode: 502, message: 'QQ 音乐评论接口异常' })
  }
  const data = response.request?.data?.CommentList || {}
  const rawComments = Array.isArray(data.Comments) ? data.Comments : []
  const commentItems = normalizeQqCommentList(rawComments)

  return {
    code: 200,
    data: {
      comments: commentItems,
      total: Number(data.Total) || commentItems.length,
      more: Number(data.HasMore) === 1,
      nextCursor:
        Number(data.HasMore) === 1 ? String(rawComments.at(-1)?.SeqNo || data.NextOffset || '') : ''
    }
  }
})
