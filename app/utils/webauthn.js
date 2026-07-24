import {
  base64URLStringToBuffer,
  bufferToBase64URLString,
  startAuthentication
} from '@simplewebauthn/browser'

const toCredentialDescriptor = ({ id, type }) => ({
  id: base64URLStringToBuffer(id),
  type
})

const createWebAuthnError = (code, cause) => {
  const error = new Error(code)
  error.code = code
  error.cause = cause
  return error
}

const normalizeAuthenticationError = (error) => {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'AbortError':
      return createWebAuthnError('passkeyOperationUnavailable', error)
    case 'NotSupportedError':
      return createWebAuthnError('passkeyLoginUnsupported', error)
    case 'SecurityError':
      return createWebAuthnError('passkeySecurityInvalid', error)
    default:
      return createWebAuthnError('passkeyFailed', error)
  }
}

const normalizeRegistrationError = (error) => {
  let code

  switch (error?.name) {
    case 'NotAllowedError':
    case 'AbortError':
      code = 'passkeyOperationUnavailable'
      break
    case 'InvalidStateError':
      code = 'passkeyAlreadyRegistered'
      break
    case 'NotSupportedError':
      code = 'passkeyAlgorithmUnsupported'
      break
    case 'SecurityError':
      code = 'passkeySecurityInvalid'
      break
    default:
      code = 'addDeviceFailed'
  }

  const normalizedError = createWebAuthnError(code, error)
  normalizedError.name = error.name
  return normalizedError
}

export const getWebAuthnErrorMessage = (error, messages, fallback) => {
  const localizedMessage = error?.code ? messages?.[error.code] : ''
  return localizedMessage || error?.data?.message || error?.statusMessage || fallback
}

const readClientExtensionResults = (credential) => {
  try {
    return credential.getClientExtensionResults?.() || {}
  } catch (error) {
    // 鸿蒙早期实现可能缺少完整扩展接口，扩展结果不参与服务端签名验证。
    console.warn('读取 WebAuthn 扩展结果失败:', error)
    return {}
  }
}

const readOptionalResponseValue = (response, methodName) => {
  try {
    return response[methodName]?.()
  } catch (error) {
    // 部分系统凭据桥仅实现必需字段，可选元数据失败不应中断认证。
    console.warn(`读取 WebAuthn ${methodName} 失败:`, error)
    return undefined
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

export const startWebAuthnAuthentication = async (optionsJSON, useBrowserAutofill = false) => {
  if (useBrowserAutofill) {
    return startAuthentication({ optionsJSON, useBrowserAutofill: true })
  }

  if (!navigator.credentials?.get) {
    throw createWebAuthnError('passkeyLoginUnsupported')
  }

  const { challenge, allowCredentials, ...remainingOptions } = optionsJSON
  const publicKey = {
    ...remainingOptions,
    challenge: base64URLStringToBuffer(challenge)
  }

  if (allowCredentials?.length) {
    publicKey.allowCredentials = allowCredentials.map(toCredentialDescriptor)
  }

  // 部分鸿蒙版本的 WebAuthn 桥接会拒绝 AbortSignal，登录按钮本身已阻止重复提交。
  let credential
  try {
    credential = await navigator.credentials.get({ publicKey })
  } catch (error) {
    throw normalizeAuthenticationError(error)
  }
  if (!credential?.response) {
    throw createWebAuthnError('passkeyAuthenticationIncomplete')
  }

  const response = credential.response

  return {
    id: credential.id,
    rawId: bufferToBase64URLString(credential.rawId),
    response: {
      authenticatorData: bufferToBase64URLString(response.authenticatorData),
      clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
      signature: bufferToBase64URLString(response.signature),
      userHandle: response.userHandle ? bufferToBase64URLString(response.userHandle) : undefined
    },
    type: credential.type,
    clientExtensionResults: readClientExtensionResults(credential),
    authenticatorAttachment: credential.authenticatorAttachment || undefined
  }
}

export const startWebAuthnRegistration = async (optionsJSON) => {
  if (!navigator.credentials?.create) {
    throw createWebAuthnError('passkeyRegistrationUnsupported')
  }

  const {
    challenge,
    user,
    excludeCredentials,
    hints,
    extensions,
    authenticatorSelection,
    ...remainingOptions
  } = optionsJSON
  const compatibleExtensions = { ...extensions }
  const compatibleAuthenticatorSelection = { ...authenticatorSelection }

  // 这些提示不参与服务端验证，部分鸿蒙凭据桥会因不认识它们而拒绝整个请求。
  delete compatibleExtensions.credProps
  delete compatibleAuthenticatorSelection.residentKey

  const publicKey = {
    ...remainingOptions,
    challenge: base64URLStringToBuffer(challenge),
    user: {
      ...user,
      id: base64URLStringToBuffer(user.id)
    }
  }

  if (Object.keys(compatibleExtensions).length) {
    publicKey.extensions = compatibleExtensions
  }
  if (Object.keys(compatibleAuthenticatorSelection).length) {
    publicKey.authenticatorSelection = compatibleAuthenticatorSelection
  }

  if (excludeCredentials?.length) {
    publicKey.excludeCredentials = excludeCredentials.map(toCredentialDescriptor)
  }
  if (hints?.length) {
    publicKey.hints = hints
  }

  // 部分鸿蒙版本的 WebAuthn 桥接会拒绝 AbortSignal，绑定按钮本身已阻止重复提交。
  let credential
  try {
    credential = await navigator.credentials.create({ publicKey })
  } catch (error) {
    throw normalizeRegistrationError(error)
  }
  if (!credential?.response) {
    throw createWebAuthnError('passkeyCreationIncomplete')
  }

  const response = credential.response
  const publicKeyAlgorithm = readOptionalResponseValue(response, 'getPublicKeyAlgorithm')
  const credentialPublicKey = readOptionalResponseValue(response, 'getPublicKey')
  const authenticatorData = readOptionalResponseValue(response, 'getAuthenticatorData')

  return {
    id: credential.id,
    rawId: bufferToBase64URLString(credential.rawId),
    response: {
      attestationObject: bufferToBase64URLString(response.attestationObject),
      clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
      transports: readOptionalResponseValue(response, 'getTransports'),
      publicKeyAlgorithm,
      publicKey: credentialPublicKey ? bufferToBase64URLString(credentialPublicKey) : undefined,
      authenticatorData: authenticatorData ? bufferToBase64URLString(authenticatorData) : undefined
    },
    type: credential.type,
    clientExtensionResults: readClientExtensionResults(credential),
    authenticatorAttachment: credential.authenticatorAttachment || undefined
  }
}
