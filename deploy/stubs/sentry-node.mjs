// @sentry/node 占位模块：@sentry/node（含 OpenTelemetry 全家桶）的 http/express/pg instrumentation
// 在模块 init 阶段就 patch Node 内置模块，在边缘运行时（Cloudflare Workers 等）会崩溃。
// 仅当 NITRO_PRESET 为 cloudflare 系时通过 nuxt.config alias 到本文件；
// 空实现保持与 @sentry/node 相同的 API 面，插件里的 enabled 检查会让遥测链路自然关闭。
const noop = () => {}

const noopScope = () => ({
  setTag: noop,
  setContext: noop,
  setUser: noop,
  setLevel: noop
})

const SentryStub = {
  init: noop,
  close: async () => true,
  captureException: noop,
  captureMessage: noop,
  captureEvent: noop,
  consoleLoggingIntegration: () => ({ name: 'ConsoleLogging', setup: noop }),
  setContext: noop,
  setTag: noop,
  setTags: noop,
  setUser: noop,
  startSpan: (_opts, callback) => (typeof callback === 'function' ? callback() : undefined),
  startSpanManual: (_opts, callback) => {
    if (typeof callback === 'function') callback({ end: noop })
    return undefined
  },
  startInactiveSpan: () => ({ end: noop }),
  withScope: (_scopeOrFn, maybeFn) => {
    const fn = typeof _scopeOrFn === 'function' ? _scopeOrFn : maybeFn
    if (typeof fn === 'function') fn(noopScope())
  },
  getCurrentScope: noopScope,
  getGlobalScope: noopScope,
  getIsolationScope: noopScope,
  addBreadcrumb: noop,
  flush: async () => true,
  getClient: () => undefined,
  logger: { log: noop, warn: noop, error: noop }
}

export default SentryStub
export const {
  init,
  close,
  captureException,
  captureMessage,
  captureEvent,
  consoleLoggingIntegration,
  setContext,
  setTag,
  setTags,
  setUser,
  startSpan,
  startSpanManual,
  startInactiveSpan,
  withScope,
  getCurrentScope,
  getGlobalScope,
  getIsolationScope,
  addBreadcrumb,
  flush,
  getClient,
  logger
} = SentryStub
