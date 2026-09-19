// debug 占位模块：unenv 的 debug polyfill 在 rollup CJS 互操作下会得到不可调用的命名空间对象，
// 导致 follow-redirects / require-in-the-middle 等顶层 `require('debug')('ns')` 在 workerd 启动时崩溃。
// 用一个纯 CJS 函数导出替换，保证所有调用方拿到可调用的 logger 工厂
function isEnabled(namespace) {
  const patterns = (process.env.DEBUG || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return patterns.some((pattern) => {
    const expression = pattern
      .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
      .replace(/\*/g, '.*')
    return new RegExp(`^${expression}$`).test(namespace)
  })
}

function debug(namespace) {
  const enabled = () => isEnabled(namespace)
  const logger = (...args) => {
    if (enabled()) console.log(`${namespace} ${args.map(String).join(' ')}`)
  }
  logger.enabled = enabled()
  logger.color = ''
  logger.namespace = namespace
  logger.destroy = () => true
  logger.extend = (sub) => debug(`${namespace}:${sub}`)
  return logger
}

debug.enable = () => {}
debug.disable = () => ''
debug.enabled = () => false
debug.log = (...args) => console.log(...args)
debug.formatArgs = () => {}
debug.selectColor = () => '#000000'
debug.humanize = (ms) => `${ms}ms`
debug.coerce = (v) => v
debug.names = []
debug.skips = []
debug.formatters = {}
debug.namespaces = ''

module.exports = debug
