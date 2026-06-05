import { defineEventHandler } from 'h3'
import {
  isTimeSynced,
  getServerTimestamp,
  syncNow
} from '~~/server/utils/serverTime'

export default defineEventHandler(async () => {
  if (!isTimeSynced()) {
    await Promise.race([
      syncNow(),
      new Promise(resolve => setTimeout(resolve, 2000))
    ])
  }

  return {
    timestamp: getServerTimestamp()
  }
})
