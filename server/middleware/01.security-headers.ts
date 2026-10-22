/**
 * 安全响应头中间件。
 *
 * 背景：应用此前未统一下发浏览器安全响应头，缺少点击劫持、MIME 嗅探、
 * 引用来源泄露等基础防护。此处对所有响应补充一组保守的安全头。
 *
 * 说明：
 * - 不设置 Content-Security-Policy：本项目大量使用内联样式与第三方 CDN 资源
 *   （xlsx、字体等），贸然启用 CSP 会导致功能异常，需单独评估后再逐步收紧。
 * - HSTS 仅在 HTTPS 场景下发，避免在明文 HTTP 部署下把浏览器锁定到 HTTPS。
 * - X-Frame-Options 使用 SAMEORIGIN 而非 DENY，兼容后台管理页面的同源嵌套。
 */
export default defineEventHandler((event) => {
  // 禁止浏览器 MIME 类型嗅探（避免把文本当作脚本执行）
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  // 禁止被嵌入 iframe，防止点击劫持
  setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  // 跨站跳转时不泄露完整 URL（含路径与查询参数）
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  // 收敛浏览器可用能力（本项目不需要摄像头/麦克风/地理定位等）
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  // 避免把当前页面路径暴露给第三方脚本
  setHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')

  const forwardedProto = getHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  const requestProto = getRequestURL(event).protocol.replace(':', '').toLowerCase()
  const isHttps = forwardedProto === 'https' || requestProto === 'https'
  if (isHttps) {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})
