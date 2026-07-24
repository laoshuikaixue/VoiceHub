import 'dotenv/config'
import { createClient } from 'redis'

const APPLY = process.argv.includes('--apply')
const CONFIRMED = process.env.REDIS_LEGACY_CLEANUP_CONFIRM === 'VOICEHUB'
const DELETE_BATCH_SIZE = 200

const LEGACY_PATTERNS = [
  'songs:list:*',
  'songs:count:*',
  'voicehub:songs:*',
  'voicehub:song_count:*',
  'voicehub:user_votes:*',
  'voicehub:schedules:*',
  'voicehub:schedule_date:*',
  'voicehub:system:*',
  'voicehub:playtimes:*',
  'public_schedules:*',
  'open:*',
  'sys:*',
  'user:*',
  'schedule:*',
  'song:*',
  'stats:*',
  'auth:*',
  'vote:*',
  'system:*',
  'playtimes:*',
  'admin_stats:*',
  'realtime_stats',
  'active_users:*'
]

if (!process.env.REDIS_URL) {
  console.error('未配置 REDIS_URL，无法扫描 Redis')
  process.exit(1)
}

if (APPLY && !CONFIRMED) {
  console.error('执行清理前必须设置 REDIS_LEGACY_CLEANUP_CONFIRM=VOICEHUB')
  process.exit(2)
}

const client = createClient({ url: process.env.REDIS_URL })
client.on('error', (error) => console.error('[Redis] 客户端错误:', error.message))

try {
  await client.connect()
  const seen = new Set()

  for (const pattern of LEGACY_PATTERNS) {
    const keys = []
    for await (const batch of client.scanIterator({ MATCH: pattern, COUNT: 200 })) {
      for (const key of batch) {
        if (seen.has(key)) continue
        seen.add(key)
        keys.push(key)
      }
    }

    if (keys.length === 0) {
      console.log(`[Redis Legacy] ${pattern}: 0`)
      continue
    }

    const samples = []
    for (const key of keys.slice(0, 5)) {
      samples.push({ key, ttl: await client.ttl(key) })
    }
    console.log(`[Redis Legacy] ${pattern}: ${keys.length}`, samples)

    if (APPLY) {
      for (let index = 0; index < keys.length; index += DELETE_BATCH_SIZE) {
        await client.del(keys.slice(index, index + DELETE_BATCH_SIZE))
      }
      console.log(`[Redis Legacy] 已删除 ${keys.length} 个键`)
    }
  }

  console.log(APPLY ? '旧 Redis 键清理完成' : 'dry-run 完成，未删除任何键')
} finally {
  await client.quit().catch(() => {})
}
