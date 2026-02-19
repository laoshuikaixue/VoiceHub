import { H3Event, getRequestHeader, getRequestHost, getRequestProtocol } from 'h3'

/**
 * 动态获取 WebAuthn 配置 (RP ID 和 Origin)
 * 适配 Vercel 预览环境、生产环境和本地开发环境
 */
export function getWebAuthnConfig(event: H3Event) {
  const host = getRequestHost(event)
  const protocol = getRequestProtocol(event, { xForwardedProto: true })
  
  // 1. 确定 RP ID
  // 优先使用环境变量 (生产环境建议配置 WEBAUTHN_RP_ID)
  // 如果未配置，则回退到当前请求的 hostname (适配 Vercel 预览环境和本地开发)
  let rpID = process.env.WEBAUTHN_RP_ID
  
  if (!rpID) {
    // 从 host 中提取 hostname (去除端口)
    // 例如: "localhost:3000" -> "localhost"
    // "voicehub.vercel.app" -> "voicehub.vercel.app"
    rpID = host.split(':')[0]
  }

  // 2. 确定 Origin
  // 优先使用环境变量 (如果配置了固定 Origin)
  // 其次尝试从请求头获取 Origin (浏览器通常会发送)
  // 最后根据 Host 动态构建
  let origin = process.env.WEBAUTHN_ORIGIN
  
  if (!origin) {
    const requestOrigin = getRequestHeader(event, 'origin')
    if (requestOrigin) {
      origin = requestOrigin
    } else {
      // 动态构建: protocol://host
      // 本地开发通常是 http，Vercel 是 https
      origin = `${protocol}://${host}`
    }
  }

  return { rpID, origin }
}
