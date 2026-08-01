import { defineEventHandler } from 'h3'
import { getServerTimestamp } from '~~/server/utils/serverTime'

// 返回服务器本机时间
export default defineEventHandler(() => {
  return {
    timestamp: getServerTimestamp()
  }
})
