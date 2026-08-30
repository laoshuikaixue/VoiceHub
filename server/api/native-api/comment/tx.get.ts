import {
  getTxSongPlayableInfo,
  TX_MUSICU_URL,
  txRequest,
  txSignedRequest
} from '~~/server/utils/native_tx'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from '~~/server/utils/apiError'
import {
  buildQqCommentRequestParam,
  normalizeQqCommentPage
} from '~~/server/utils/qqComment'

interface QqCommentListData {
  Comments?: unknown
  comments?: unknown
  commentlist?: unknown
  list?: unknown
  Total?: unknown
  total?: unknown
  HasMore?: unknown
  hasMore?: unknown
  hasmore?: unknown
}

interface QqCommentModuleData extends QqCommentListData {
  CommentList?: QqCommentListData
  comment?: QqCommentListData
}

interface QqCommentResponse {
  code?: unknown
  request?: {
    code?: unknown
    data?: QqCommentModuleData
  }
  comment?: {
    code?: unknown
    data?: QqCommentModuleData
  }
}

const getCommentListData = (response: QqCommentResponse) => {
  const data = response.request?.data || response.comment?.data || {}
  const list = data.CommentList || data.comment || data
  return {
    list,
    comments: list.Comments || list.comments || list.commentlist || list.list || []
  }
}

const isSuccessfulResponse = (response: QqCommentResponse | undefined) => {
  if (!response || Number(response.code) !== 0) return false
  const moduleCode = response.request?.code ?? response.comment?.code
  return Number(moduleCode) === 0
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const musicId = String(query.musicId || '').trim()
  const originalSongId = String(query.songId || '').trim()
  const cursor = String(query.cursor || '').trim()
  const rawPage = Number(query.page)
  const rawPageSize = Number(query.pageSize)
  const page = Number.isFinite(rawPage) ? Math.max(0, Math.floor(rawPage)) : 0
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(50, Math.max(1, Math.floor(rawPageSize)))
    : 20
  const type = query.type === 'latest' ? 'latest' : 'hot'
  if (!musicId) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      '缺少 musicId 参数'
    )
  }

  let topid = /^\d+$/.test(originalSongId) ? originalSongId : ''
  if (!topid && /^\d+$/.test(musicId)) topid = musicId
  if (!topid) {
    try {
      const info = await getTxSongPlayableInfo(musicId)
      topid = String(info.songId || '').trim()
    } catch (error) {
      console.error('[QQ评论] 解析歌曲 ID 失败:', error instanceof Error ? error.message : error)
      throw createApiError(
        502,
        SERVER_ERROR_CODES.QQ_COMMENT_FETCH_FAILED,
        'QQ 音乐评论获取失败'
      )
    }
  }
  if (!topid) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      'QQ 音乐歌曲 ID 无效'
    )
  }

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
      param: buildQqCommentRequestParam({ topid, cursor, page, pageSize, type })
    }
  }

  let response: QqCommentResponse | undefined
  try {
    response = (await txRequest(TX_MUSICU_URL, requestBody, {
      signal: AbortSignal.timeout(8000)
    })) as QqCommentResponse
  } catch (error) {
    console.warn('[QQ评论] 直连接口请求失败，尝试签名接口:', error)
  }

  if (!isSuccessfulResponse(response)) {
    try {
      response = (await txSignedRequest(requestBody, {
        signal: AbortSignal.timeout(8000)
      })) as QqCommentResponse
    } catch (error) {
      console.error('[QQ评论] 签名接口请求失败:', error instanceof Error ? error.message : error)
      throw createApiError(
        502,
        SERVER_ERROR_CODES.QQ_COMMENT_FETCH_FAILED,
        'QQ 音乐评论获取失败'
      )
    }
  }

  if (!isSuccessfulResponse(response)) {
    throw createApiError(
      502,
      SERVER_ERROR_CODES.QQ_COMMENT_FETCH_FAILED,
      'QQ 音乐评论获取失败'
    )
  }
  const { list, comments: responseComments } = getCommentListData(response)
  const rawComments = Array.isArray(responseComments) ? responseComments : []
  const normalizedPage = normalizeQqCommentPage(rawComments)
  const commentItems = normalizedPage.comments

  return {
    code: 200,
    data: {
      comments: commentItems,
      orphanReplies: normalizedPage.orphanReplies,
      total: Number(list.Total ?? list.total) || commentItems.length,
      more: Number(list.HasMore ?? list.hasMore ?? list.hasmore) === 1,
      nextCursor:
        Number(list.HasMore ?? list.hasMore ?? list.hasmore) === 1
          ? String(rawComments.at(-1)?.SeqNo || rawComments.at(-1)?.seqNo || '')
          : ''
    }
  }
})
