import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

export const getWebAuthnErrorMessage = (error, fallback = 'Passkey 操作失败') => {
  switch (error?.name) {
    case 'NotAllowedError':
      return 'Passkey 操作未完成，可能已取消、没有可用凭据或系统未允许本次操作'
    case 'InvalidStateError':
      return '该 Passkey 已经注册'
    case 'NotSupportedError':
      return '当前设备不支持服务器提供的 Passkey 加密算法'
    case 'SecurityError':
      return 'Passkey 的域名或安全上下文配置无效'
    default:
      return error?.data?.message || error?.message || error?.statusMessage || fallback
  }
}

export const signalUnknownWebAuthnCredential = async ({ credentialId, rpId }) => {
  if (typeof window === 'undefined') return false

  const signalUnknownCredential = window.PublicKeyCredential?.signalUnknownCredential
  if (!credentialId || !rpId || typeof signalUnknownCredential !== 'function') {
    return false
  }

  try {
    await signalUnknownCredential.call(window.PublicKeyCredential, {
      credentialId,
      rpId
    })
    return true
  } catch (error) {
    // 设备可能只实现基础 WebAuthn，清理失败不能影响服务端解绑结果。
    console.warn('通知系统清理失效 Passkey 失败:', error)
    return false
  }
}

export const startWebAuthnAuthentication = (optionsJSON, useBrowserAutofill = false) =>
  startAuthentication({ optionsJSON, useBrowserAutofill })

export const startWebAuthnRegistration = (optionsJSON) => startRegistration({ optionsJSON })
