// pac-proxy-agent 占位模块：网易云增强 API 用它支持 PAC 代理，边缘运行时（Cloudflare Workers 等）
// 无法使用 HTTP 代理 agent，stub 为空实现（未配置代理时该依赖本来就是死代码）
class PacProxyAgent {
  constructor() {
    throw new Error('边缘运行时不支持 PAC 代理')
  }
}

module.exports = { PacProxyAgent }
module.exports.default = { PacProxyAgent }
