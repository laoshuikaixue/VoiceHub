import { base64URLStringToBuffer, bufferToBase64URLString } from '@simplewebauthn/browser'

const toCredentialDescriptor = (descriptor) => ({
  ...descriptor,
  id: base64URLStringToBuffer(descriptor.id)
})

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
  const credential = await navigator.credentials.get({ publicKey })
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

  const { challenge, user, excludeCredentials, hints, ...remainingOptions } = optionsJSON
  const publicKey = {
    ...remainingOptions,
    challenge: base64URLStringToBuffer(challenge),
    user: {
      ...user,
      id: base64URLStringToBuffer(user.id)
    }
  }

  if (excludeCredentials?.length) {
    publicKey.excludeCredentials = excludeCredentials.map(toCredentialDescriptor)
  }
  if (hints?.length) {
    publicKey.hints = hints
  }

  // 部分鸿蒙版本的 WebAuthn 桥接会拒绝 AbortSignal，绑定按钮本身已阻止重复提交。
  const credential = await navigator.credentials.create({ publicKey })
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
