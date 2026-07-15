import { base64URLStringToBuffer, bufferToBase64URLString } from '@simplewebauthn/browser'

const toCredentialDescriptor = ({ id, type }) => ({
  id: base64URLStringToBuffer(id),
  type
})

const normalizeRegistrationError = (error) => {
  let message

  switch (error?.name) {
    case 'NotAllowedError':
      message = '系统未能创建 Passkey，请确认已启用锁屏密码、生物识别和系统凭据服务后重试'
      break
    case 'InvalidStateError':
      message = '该 Passkey 已在当前账号中注册'
      break
    case 'NotSupportedError':
      message = '当前设备不支持服务器提供的 Passkey 加密算法'
      break
    case 'SecurityError':
      message = 'Passkey 的域名或安全上下文配置无效'
      break
    default:
      return error
  }

  const normalizedError = new Error(message)
  normalizedError.name = error.name
  normalizedError.cause = error
  return normalizedError
}

const normalizeAuthenticationError = (error, hasExplicitCredentials) => {
  if (error?.name !== 'NotAllowedError') return error

  const message = hasExplicitCredentials
    ? '未找到该账号可用的 Passkey，或系统未能完成验证'
    : '未找到可用的 Passkey。鸿蒙设备请先输入账号名后重试'
  const normalizedError = new Error(message)
  normalizedError.name = error.name
  normalizedError.cause = error
  return normalizedError
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

export const startWebAuthnAuthentication = async (optionsJSON) => {
  if (!navigator.credentials?.get) {
    throw new Error('当前浏览器不支持 Passkey 登录')
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
    throw normalizeAuthenticationError(error, Boolean(allowCredentials?.length))
  }
  if (!credential?.response) {
    throw new Error('Passkey 认证未完成')
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
    throw new Error('当前浏览器不支持创建 Passkey')
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
    throw new Error('Passkey 创建未完成')
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
