import { createHash, createHmac } from 'crypto'

/** S3 请求超时（毫秒） */
const S3_TIMEOUT = 120_000

/** AWS Signature V4 签名工具 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

export function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

export function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${key}`, dateStamp)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

/** 上传文件到 S3 兼容存储 */
export async function uploadToS3(
  endpoint: string,
  bucket: string,
  region: string,
  accessKey: string,
  secretKey: string,
  key: string,
  body: string | Buffer,
  contentType: string = 'application/json'
): Promise<void> {
  const url = new URL(endpoint)
  const host = url.host
  const service = 's3'
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const payloadHash = sha256(typeof body === 'string' ? body : body.toString())
  const contentLength = Buffer.byteLength(typeof body === 'string' ? body : body).toString()

  // 构建规范请求
  const canonicalUri = `/${bucket}/${key}`
  const canonicalQuerystring = ''
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

  // 构建待签名字符串
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`

  // 计算签名
  const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
  const signature = hmacSha256(signingKey, stringToSign).toString('hex')

  // 构建 Authorization 头
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  // 发送请求
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${bucket}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': contentLength,
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization
    },
    body: typeof body === 'string' ? body : new Uint8Array(body),
    signal: AbortSignal.timeout(S3_TIMEOUT)
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`S3 上传失败: ${response.status} ${response.statusText} - ${errorBody}`)
  }
}

/** 从 S3 兼容存储删除文件 */
export async function deleteFromS3(
  endpoint: string,
  bucket: string,
  region: string,
  accessKey: string,
  secretKey: string,
  key: string
): Promise<void> {
  const url = new URL(endpoint)
  const host = url.host
  const service = 's3'
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const payloadHash = sha256('')
  const canonicalUri = `/${bucket}/${key}`
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = `DELETE\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`
  const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
  const signature = hmacSha256(signingKey, stringToSign).toString('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${bucket}/${key}`, {
    method: 'DELETE',
    headers: {
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization
    },
    signal: AbortSignal.timeout(S3_TIMEOUT)
  })

  if (!response.ok && response.status !== 404) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`S3 删除失败: ${response.status} ${response.statusText} - ${errorBody}`)
  }
}