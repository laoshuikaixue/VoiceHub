// express 占位模块：@neteasecloudmusicapienhanced/api 的 main.js 顶层会加载其 Express 服务器
// （server.js），VoiceHub 只使用其函数式接口（module/*.js），不需要服务器。
// stub 掉 express 以斩断 server.js 的整条 Node 依赖链（body-parser/express-fileupload 等），
// 边缘运行时（Cloudflare Workers 等）打包和启动均可通过
const app = {}
const chain = () => new Proxy(function () {}, {
  get: (t, p) => (p === '__esModule' ? false : chain()),
  apply: () => chain()
})

module.exports = function express() {
  return app
}
module.exports.default = module.exports
module.exports.json = () => (req, res, next) => next && next()
module.exports.urlencoded = () => (req, res, next) => next && next()
module.exports.text = () => (req, res, next) => next && next()
module.exports.raw = () => (req, res, next) => next && next()
module.exports.static = () => (req, res, next) => next && next()
module.exports.Router = () => ({
  get() {}, post() {}, use() {}, all() {}
})
