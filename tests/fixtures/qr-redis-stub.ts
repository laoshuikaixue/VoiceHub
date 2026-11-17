/**
 * `server/utils/redis` 的路由单测替身。
 * 默认不配置共享存储，让扫码补发只走进程内缓存，避免测试依赖 Redis。
 */
export const isRedisConfigured = () => false

export const buildRedisKey = (...parts: Array<string | number>) =>
  `test:${parts.map((part) => String(part)).join(':')}`

export const getRedisClient = async (): Promise<null> => null
