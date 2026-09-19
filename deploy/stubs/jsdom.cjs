// jsdom 占位模块：jsdom 依赖大量 DOM 标准类，在 workerd 等 V8 isolate 边缘运行时初始化即崩。
// 唯一使用方是网易云增强 API 的 register_checktoken_v2（易盾反作弊 token，需模拟浏览器环境），
// 边缘环境无法支持，stub 为空导出让打包通过；调用该接口时会得到明确报错并降级。
class JSDOM {
  constructor() {
    throw new Error('边缘运行时不支持 jsdom（易盾反作弊功能不可用）')
  }
}

class VirtualConsole {
  constructor() {
    this._events = {}
  }
  on() {}
  emit() {}
  forwardTo() {}
}

module.exports = { JSDOM, VirtualConsole }
module.exports.default = { JSDOM, VirtualConsole }
