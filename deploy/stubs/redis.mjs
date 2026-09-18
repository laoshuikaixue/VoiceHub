// redis 占位模块：node-redis v5 依赖 node:events 等 Node 内置类与 TCP socket，
// 其内置 metrics instrumentation 在 workerd（Cloudflare Workers 等）初始化即崩，且 TCP 直连
// Redis 在边缘也不可用。VoiceHub 中 Redis 是可选组件（REDIS_URL 未配置时功能自动关闭），
// stub 掉后 isRedisConfigured() 仍按环境变量判断，未配置时所有调用走无缓存降级路径。
class RedisStubError extends Error {
  constructor() {
    super('边缘运行时不支持 TCP Redis，请改用 Upstash 等 HTTP Redis 或不配置 REDIS_URL')
  }
}

const noopAsync = async () => null

const createClient = () => {
  const client = {
    connected: false,
    isReady: false,
    on() {
      return client
    },
    once() {
      return client
    },
    off() {
      return client
    },
    connect: async () => {
      throw new RedisStubError()
    },
    disconnect: async () => {},
    quit: async () => {},
    end() {},
    get: noopAsync,
    set: noopAsync,
    setEx: noopAsync,
    del: noopAsync,
    keys: async () => [],
    exists: async () => 0,
    expire: noopAsync,
    ttl: async () => -2,
    ttlSeconds: async () => -2,
    incr: noopAsync,
    incrBy: noopAsync,
    hGet: noopAsync,
    hSet: noopAsync,
    hGetAll: async () => ({}),
    hDel: noopAsync,
    subscribe() {},
    unsubscribe() {},
    pSubscribe() {},
    pUnsubscribe() {},
    scanIterator: async function* () {}
  }
  return client
}

export default { createClient }
export { createClient }
