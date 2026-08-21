// 微信 / QQ 内置浏览器 UA 检测（仅客户端可用，SSR 环境返回全 false）
// 原理：微信内置 WebView（含 PC 版）UA 携带 MicroMessenger；
// QQ 内置 WebView 携带独立的 " QQ/版本号" 段或老安卓的 V1_AND_SQ_，
// 独立 QQ 浏览器只有 MQQBrowser 而无独立的 " QQ/" 段，因此会被天然排除。
export const detectEmbeddedBrowser = (userAgent?: string): {
  isWeChat: boolean
  isQQApp: boolean
} => {
  const ua = userAgent || (typeof window !== 'undefined' ? window.navigator.userAgent : '')
  const isWeChat = /MicroMessenger/i.test(ua)
  // 仅匹配独立的 " QQ/" 段：QQ 浏览器的 MQQBrowser/QQ/8.x 形式不会触发误判
  const isQQApp = /\sQQ\/[\d.]/i.test(ua) || /V1_AND_SQ/i.test(ua)
  return { isWeChat, isQQApp }
}