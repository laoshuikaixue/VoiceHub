import { H3Event, getRequestHeader, getRequestHost, getRequestProtocol } from 'h3'

function parseAllowedOrigins(): string[] {
  const env = process.env.WEBAUTHN_ORIGIN
  if (!env) return []
  return env.split(',').map(o => o.trim()).filter(Boolean)
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return true
  return allowedOrigins.includes(origin)
}

export function getWebAuthnConfig(event: H3Event) {
  const host = getRequestHost(event)
  const protocol = getRequestProtocol(event, { xForwardedProto: true })
  const allowedOrigins = parseAllowedOrigins()
  
  let rpID = process.env.WEBAUTHN_RP_ID
  
  if (!rpID) {
    rpID = host.split(':')[0]
  }

  let origin: string
  const requestOrigin = getRequestHeader(event, 'origin') || `${protocol}://${host}`

  if (process.env.WEBAUTHN_ORIGIN) {
    if (isOriginAllowed(requestOrigin, allowedOrigins)) {
      origin = requestOrigin
    } else {
      console.warn(`WebAuthn origin 不在允许列表中: ${requestOrigin}，使用第一个允许的域名: ${allowedOrigins[0]}`)
      origin = allowedOrigins[0]
    }
  } else {
    origin = requestOrigin
  }

  return { rpID, origin, allowedOrigins }
}
