import type { H3Event } from 'h3'

// 全局安全响应头，覆盖 SSR 页面与 API 请求
export default defineEventHandler((event: H3Event) => {
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')
  setHeader(event, 'Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()')

  // HSTS 仅在 HTTPS（经代理或直连）下下发，避免本地 http 开发环境被浏览器强制跳 https
  const forwardedProto = getHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim()
  const secure = forwardedProto === 'https' || Boolean((event.node.req.socket as { encrypted?: boolean })?.encrypted)
  if (secure) {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})
