// @applemusic-like-lyrics/lyric 的服务端边缘占位模块。
// 原包的 WASM glue 由 vite-plugin-wasm 生成，SSR chunk 中会产生严格模块不允许的
// `URL = globalThis.URL` 赋值，且歌词解析只在浏览器播放器交互时使用。
// Workers SSR 只需让模块安全加载；客户端构建仍使用原始 WASM 包。
const emptyLines = () => []

export const parseTTML = emptyLines
export const parseYrc = emptyLines
export const parseLrc = emptyLines
export const parseQrc = emptyLines
export const parseLys = emptyLines
export const parseEslrc = emptyLines
export const stringifyTTML = () => ''
export const stringifyYrc = () => ''
export const stringifyLrc = () => ''
export const stringifyQrc = () => ''
export const stringifyLys = () => ''
export const stringifyEslrc = () => ''
export const stringifyAss = () => ''
export const decryptQrcHex = () => ''

export default {
  parseTTML,
  parseYrc,
  parseLrc,
  parseQrc,
  parseLys,
  parseEslrc,
  stringifyTTML,
  stringifyYrc,
  stringifyLrc,
  stringifyQrc,
  stringifyLys,
  stringifyEslrc,
  stringifyAss,
  decryptQrcHex
}
