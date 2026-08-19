import {
  createHash,
  createHmac,
  createSign,
  createVerify,
  randomBytes,
  timingSafeEqual
} from 'node:crypto'
import { getServerDate, getServerTimestamp } from '~~/server/utils/serverTime'

export interface PaymentCreateRequest {
  outTradeNo: string
  amountCents: number
  currency: string
  subject: string
  method: string
  notifyUrl: string
  returnUrl: string
  expiresAt: Date
  clientIp: string
  mobile: boolean
  alipayForceQrCode?: boolean
  alipayMobileDeepLink?: boolean
}

export interface PaymentCreateResult {
  tradeNo?: string
  payUrl?: string
  qrCode?: string
  clientSecret?: string
  extra?: Record<string, unknown>
}

export interface PaymentQueryResult {
  status: 'pending' | 'paid' | 'failed'
  tradeNo?: string
  amountCents?: number
}

export interface PaymentNotification {
  outTradeNo: string
  tradeNo?: string
  amountCents: number
  success: boolean
}

export interface PaymentRefundNotification {
  outTradeNo: string
  refundId: string
  success: boolean
}

export interface PaymentProvider {
  create(request: PaymentCreateRequest): Promise<PaymentCreateResult>
  query(outTradeNo: string, tradeNo?: string): Promise<PaymentQueryResult>
  verify(rawBody: string, headers: Record<string, string>, query?: Record<string, string>): Promise<PaymentNotification | null>
  refund(outTradeNo: string, tradeNo: string | undefined, amountCents: number, reason: string, totalAmountCents?: number): Promise<{ refundId?: string; pending?: boolean }>
  queryRefund?(outTradeNo: string, refundId?: string): Promise<{ status: 'pending' | 'paid' | 'failed'; refundId?: string }>
  cancel?(outTradeNo: string, tradeNo?: string): Promise<void>
}

const requestJson = async (url: string, init: RequestInit) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
  const text = await response.text()
  if (text.length > 1024 * 1024) throw new Error('支付服务响应过大')
  let data: any
  try { data = text ? JSON.parse(text) : {} } catch { data = { message: text } }
  if (!response.ok) throw new Error(`支付服务 HTTP ${response.status}: ${data?.message || text.slice(0, 300)}`)
  return data
}

const formEncode = (values: Record<string, string>) => new URLSearchParams(values).toString()
const money = (cents: number) => (cents / 100).toFixed(2)
const getTimeoutExpress = (expiresAt: Date) => `${Math.max(1, Math.ceil((expiresAt.getTime() - getServerTimestamp()) / 60000))}m`
const assertCny = (currency: string, label: string) => {
  if (String(currency || '').toUpperCase() !== 'CNY') throw new Error(`${label}仅支持人民币（CNY）套餐`)
}
const assertPositiveCents = (value: unknown, label: string) => {
  const cents = Number(value)
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error(`${label}金额无效`)
  return cents
}
const assertRecentWebhookTimestamp = (value: string, label: string) => {
  const raw = String(value || '')
  const numeric = Number(raw)
  const parsed = Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(raw)
  if (!Number.isFinite(parsed) || Math.abs(getServerTimestamp() - parsed) > 5 * 60 * 1000) throw new Error(`${label}回调时间戳无效或已过期`)
}
const deterministicRequestId = (...parts: string[]) => {
  const hex = createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20)}`
}
const normalizeBase = (value: string) => value.trim().replace(/\/(submit|mapi|api)\.php\/?$/i, '').replace(/\/$/, '')

const easyPaySign = (params: Record<string, string>, key: string) => {
  const source = Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '')
    .sort().map(k => `${k}=${params[k]}`).join('&') + key
  return createHash('md5').update(source).digest('hex')
}

class EasyPayProvider implements PaymentProvider {
  constructor(private config: Record<string, any>) {}
  async create(req: PaymentCreateRequest) {
    const base = normalizeBase(this.config.apiBase)
    const params: Record<string, string> = {
      pid: this.config.pid, type: req.method === 'wxpay' ? 'wxpay' : req.method === 'alipay' ? 'alipay' : req.method,
      out_trade_no: req.outTradeNo, notify_url: req.notifyUrl, return_url: req.returnUrl,
      name: req.subject, money: money(req.amountCents), clientip: req.clientIp
    }
    const customMethod = Array.isArray(this.config.customMethods) ? this.config.customMethods.find((item: any) => item?.type === req.method) : null
    const channel = customMethod?.cid || (req.method === 'wxpay' ? this.config.cidWxpay : req.method === 'alipay' ? this.config.cidAlipay : '')
    if (channel || this.config.cid) params.cid = channel || this.config.cid
    if (req.mobile) params.device = 'mobile'
    params.sign = easyPaySign(params, this.config.pkey)
    params.sign_type = 'MD5'
    if (this.config.paymentMode === 'popup') return { payUrl: `${base}/submit.php?${formEncode(params)}` }
    const data = await requestJson(`${base}/mapi.php`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: formEncode(params)
    })
    if (Number(data.code) !== 1) throw new Error(data.msg || '易支付创建订单失败')
    return { tradeNo: data.trade_no, payUrl: req.mobile && data.payurl2 ? data.payurl2 : data.payurl, qrCode: data.qrcode }
  }
  async query(outTradeNo: string) {
    const data = await requestJson(`${normalizeBase(this.config.apiBase)}/api.php`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formEncode({ act: 'order', pid: this.config.pid, key: this.config.pkey, out_trade_no: outTradeNo })
    })
    const row = data.data || data
    const paid = row.trade_status !== undefined && row.trade_status !== ''
      ? row.trade_status === 'TRADE_SUCCESS'
      : Number(row.status) === 1
    return { status: paid ? 'paid' as const : 'pending' as const, tradeNo: row.trade_no, amountCents: Math.round(Number(row.money || 0) * 100) }
  }
  async verify(rawBody: string) {
    const params = Object.fromEntries(new URLSearchParams(rawBody))
    if (!params.sign || easyPaySign(params, this.config.pkey) !== params.sign) throw new Error('易支付回调签名无效')
    if (!params.out_trade_no) throw new Error('易支付回调缺少订单号')
    if (!params.pid || String(params.pid) !== String(this.config.pid)) throw new Error('易支付回调商户 PID 不匹配')
    return { outTradeNo: params.out_trade_no, tradeNo: params.trade_no, amountCents: Math.round(Number(params.money) * 100), success: params.trade_status === 'TRADE_SUCCESS' }
  }
  async refund(outTradeNo: string, tradeNo: string | undefined, amountCents: number) {
    const identifiers = [
      { key: 'out_trade_no', value: outTradeNo, refundId: outTradeNo },
      ...(tradeNo ? [{ key: 'trade_no', value: tradeNo, refundId: tradeNo }] : [])
    ]
    let lastError: Error | undefined
    for (const identifier of identifiers) {
      const params: Record<string, string> = { pid: this.config.pid, key: this.config.pkey, money: money(amountCents), [identifier.key]: identifier.value }
      try {
        const data = await requestJson(`${normalizeBase(this.config.apiBase)}/api.php?act=refund`, {
          method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: formEncode(params)
        })
        if (Number(data.code) === 1) return { refundId: identifier.refundId }
        lastError = new Error(data.msg || '易支付退款失败')
        if (!/订单|order|not found|不存在/i.test(lastError.message)) throw lastError
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (!/订单|order|not found|不存在/i.test(lastError.message) || identifier === identifiers[identifiers.length - 1]) throw lastError
      }
    }
    throw lastError || new Error('易支付退款失败')
  }
}

const alipaySign = (params: Record<string, string>, privateKey: string) => {
  const source = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  return createSign('RSA-SHA256').update(source).sign(privateKey, 'base64')
}
const alipayVerify = (params: Record<string, string>, publicKey: string) => {
  if (!params.sign) return false
  const source = Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type').sort().map(k => `${k}=${params[k]}`).join('&')
  return createVerify('RSA-SHA256').update(source).verify(publicKey, params.sign, 'base64')
}

class AlipayProvider implements PaymentProvider {
  private gateway: string
  constructor(private config: Record<string, any>) {
    const gateway = String(config.gateway || 'https://openapi.alipay.com/gateway.do').trim()
    let parsed: URL
    try { parsed = new URL(gateway) } catch { throw new Error('支付宝网关地址无效') }
    if (parsed.protocol !== 'https:' || !['openapi.alipay.com', 'openapi-sandbox.dl.alipaydev.com'].includes(parsed.hostname) || parsed.pathname !== '/gateway.do') {
      throw new Error('支付宝网关仅允许使用官方正式或沙箱网关')
    }
    this.gateway = parsed.toString()
  }
  private async call(method: string, biz: Record<string, unknown>, notifyUrl?: string, returnUrl?: string) {
    const params: Record<string, string> = {
      app_id: this.config.appId, method, format: 'JSON', charset: 'utf-8', sign_type: 'RSA2',
      timestamp: getServerDate().toISOString().slice(0, 19).replace('T', ' '), version: '1.0', biz_content: JSON.stringify(biz)
    }
    if (notifyUrl) params.notify_url = notifyUrl
    if (returnUrl) params.return_url = returnUrl
    if (!this.config.privateKey) throw new Error('支付宝缺少应用私钥')
    params.sign = alipaySign(params, this.config.privateKey)
    const data = await requestJson(this.gateway, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: formEncode(params)
    })
    const key = `${method.replaceAll('.', '_')}_response`
    const result = data[key]
    if (!result || result.code !== '10000') throw new Error(result?.sub_msg || result?.msg || '支付宝接口请求失败')
    return result
  }
  async create(req: PaymentCreateRequest) {
    assertCny(req.currency, '支付宝官方支付')
    assertPositiveCents(req.amountCents, '支付宝官方支付')
    if (!req.mobile && this.config.paymentMode === 'redirect') return { payUrl: this.pagePayUrl(req) }
    if (req.mobile && !req.alipayForceQrCode && !req.alipayMobileDeepLink) {
      const params: Record<string, string> = {
        app_id: this.config.appId, method: 'alipay.trade.wap.pay', format: 'JSON', charset: 'utf-8', sign_type: 'RSA2',
        timestamp: getServerDate().toISOString().slice(0, 19).replace('T', ' '), version: '1.0',
        notify_url: req.notifyUrl, return_url: req.returnUrl,
        biz_content: JSON.stringify({ out_trade_no: req.outTradeNo, total_amount: money(req.amountCents), subject: req.subject, product_code: 'QUICK_WAP_WAY', timeout_express: getTimeoutExpress(req.expiresAt) })
      }
      params.sign = alipaySign(params, this.config.privateKey)
      return { payUrl: `${this.gateway}?${formEncode(params)}` }
    }
    let result
    try {
      result = await this.call('alipay.trade.precreate', {
      out_trade_no: req.outTradeNo, total_amount: money(req.amountCents), subject: req.subject,
      timeout_express: getTimeoutExpress(req.expiresAt)
      }, req.notifyUrl)
    } catch (error) {
      if (req.mobile) throw error
      return { payUrl: this.pagePayUrl(req) }
    }
    const extra = req.mobile && req.alipayMobileDeepLink
      ? { deepLink: `alipayqr://platformapi/startapp?saId=10000007&qrcode=${encodeURIComponent(result.qr_code)}` }
      : undefined
    return { tradeNo: result.trade_no, qrCode: result.qr_code, extra }
  }
  private pagePayUrl(req: PaymentCreateRequest) {
    const params: Record<string, string> = {
      app_id: this.config.appId, method: 'alipay.trade.page.pay', format: 'JSON', charset: 'utf-8', sign_type: 'RSA2',
      timestamp: getServerDate().toISOString().slice(0, 19).replace('T', ' '), version: '1.0', notify_url: req.notifyUrl, return_url: req.returnUrl,
      biz_content: JSON.stringify({ out_trade_no: req.outTradeNo, product_code: 'FAST_INSTANT_TRADE_PAY', total_amount: money(req.amountCents), subject: req.subject, timeout_express: getTimeoutExpress(req.expiresAt) })
    }
    params.sign = alipaySign(params, this.config.privateKey)
    return `${this.gateway}?${formEncode(params)}`
  }
  async query(outTradeNo: string) {
    let result: any
    try {
      result = await this.call('alipay.trade.query', { out_trade_no: outTradeNo })
    } catch (error) {
      if (/ACQ\.TRADE_NOT_EXIST|交易不存在|TRADE_NOT_EXIST/i.test(error instanceof Error ? error.message : String(error))) return { status: 'pending' as const }
      throw error
    }
    const status: PaymentQueryResult['status'] = ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(result.trade_status)
      ? 'paid'
      : result.trade_status === 'TRADE_CLOSED' ? 'failed' : 'pending'
    const amount = Number(result.total_amount)
    return { status, tradeNo: result.trade_no, ...(Number.isFinite(amount) && amount > 0 ? { amountCents: Math.round(amount * 100) } : {}) }
  }
  async verify(rawBody: string) {
    const params = Object.fromEntries(new URLSearchParams(rawBody))
    if (!alipayVerify(params, this.config.publicKey)) throw new Error('支付宝回调签名无效')
    if (!params.out_trade_no) throw new Error('支付宝回调缺少订单号')
    if (!params.app_id || String(params.app_id) !== String(this.config.appId)) throw new Error('支付宝回调应用 ID 不匹配')
    if (params.currency && String(params.currency).toUpperCase() !== 'CNY') throw new Error('支付宝回调币种不匹配')
    const amountCents = assertPositiveCents(Math.round(Number(params.total_amount) * 100), '支付宝回调')
    return { outTradeNo: params.out_trade_no, tradeNo: params.trade_no, amountCents, success: ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status || '') }
  }
  async refund(outTradeNo: string, _tradeNo: string | undefined, amountCents: number, reason: string) {
    const result = await this.call('alipay.trade.refund', { out_trade_no: outTradeNo, refund_amount: money(amountCents), refund_reason: reason, out_request_no: `${outTradeNo}-${getServerTimestamp()}` })
    if (result.fund_change !== 'Y') throw new Error('支付宝未确认退款成功')
    return { refundId: result.trade_no }
  }
  async cancel(outTradeNo: string) { await this.call('alipay.trade.close', { out_trade_no: outTradeNo }) }
}

const wxpayAuthorization = (method: string, path: string, body: string, config: Record<string, any>) => {
  const timestamp = Math.floor(getServerTimestamp() / 1000).toString()
  const nonce = randomBytes(16).toString('hex')
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = createSign('RSA-SHA256').update(message).sign(config.privateKey, 'base64')
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.serialNo}"`
}

class WxPayProvider implements PaymentProvider {
  constructor(private config: Record<string, any>) {}
  private async call(method: string, path: string, payload?: Record<string, unknown>) {
    const body = payload ? JSON.stringify(payload) : ''
    return requestJson(`https://api.mch.weixin.qq.com${path}`, {
      method, headers: { authorization: wxpayAuthorization(method, path, body, this.config), accept: 'application/json', 'content-type': 'application/json' }, body: body || undefined
    })
  }
  async create(req: PaymentCreateRequest) {
    assertCny(req.currency, '微信支付官方')
    assertPositiveCents(req.amountCents, '微信支付官方')
    const type = req.mobile ? 'h5' : 'native'
    const path = `/v3/pay/transactions/${type}`
    const payload: any = { appid: this.config.appId, mchid: this.config.mchId, description: req.subject, out_trade_no: req.outTradeNo, notify_url: req.notifyUrl, time_expire: req.expiresAt.toISOString(), amount: { total: req.amountCents, currency: req.currency } }
    if (type === 'h5') {
      const h5Info: Record<string, string> = { type: 'Wap' }
      const appName = String(this.config.h5AppName || '').trim()
      if (appName) h5Info.app_name = appName.slice(0, 64)
      const appUrl = String(this.config.h5AppUrl || '').trim()
      if (appUrl) {
        let parsed: URL
        try { parsed = new URL(appUrl) } catch { throw new Error('微信支付 H5 网站地址无效') }
        if (parsed.protocol !== 'https:') throw new Error('微信支付 H5 网站地址必须使用 HTTPS')
        h5Info.app_url = parsed.toString()
      }
      payload.scene_info = { payer_client_ip: req.clientIp, h5_info: h5Info }
    }
    const result = await this.call('POST', path, payload)
    if (type === 'native') {
      if (!result.code_url) throw new Error('微信支付未返回二维码链接')
      return { qrCode: result.code_url }
    }
    if (!result.h5_url) throw new Error('微信支付未返回 H5 支付链接')
    return { payUrl: `${result.h5_url}${String(result.h5_url).includes('?') ? '&' : '?'}redirect_url=${encodeURIComponent(req.returnUrl)}` }
  }
  async query(outTradeNo: string) {
    const result = await this.call('GET', `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(this.config.mchId)}`)
    const state = String(result.trade_state || '').toUpperCase()
    const status: PaymentQueryResult['status'] = state === 'SUCCESS' ? 'paid' : ['CLOSED', 'PAYERROR'].includes(state) ? 'failed' : 'pending'
    const amount = Number(result.amount?.total)
    return { status, tradeNo: result.transaction_id, ...(Number.isSafeInteger(amount) && amount > 0 ? { amountCents: amount } : {}) }
  }
  private async decryptWebhook(rawBody: string, headers: Record<string, string>) {
    const timestamp = headers['wechatpay-timestamp'] || ''
    const nonce = headers['wechatpay-nonce'] || ''
    const signature = headers['wechatpay-signature'] || ''
    if (!timestamp || !nonce || !signature) throw new Error('微信支付回调缺少验签请求头')
    assertRecentWebhookTimestamp(timestamp, '微信支付')
    let signatureValid = false
    try { signatureValid = createVerify('RSA-SHA256').update(`${timestamp}\n${nonce}\n${rawBody}\n`).verify(this.config.publicKey, signature, 'base64') } catch { throw new Error('微信支付回调验签配置无效') }
    if (!signatureValid) throw new Error('微信支付回调签名无效')
    const serial = String(headers['wechatpay-serial'] || '').trim()
    if (this.config.publicKeyId && serial !== String(this.config.publicKeyId).trim()) throw new Error('微信支付回调证书序列号不匹配')
    let event: any
    try { event = JSON.parse(rawBody) } catch { throw new Error('微信支付回调数据格式无效') }
    const resource = event.resource
    if (resource?.algorithm && resource.algorithm !== 'AEAD_AES_256_GCM') throw new Error('微信支付回调加密算法不支持')
    if (!resource?.nonce || !resource?.ciphertext || typeof resource.ciphertext !== 'string') throw new Error('微信支付回调缺少加密资源')
    const key = Buffer.from(String(this.config.apiV3Key || ''), 'utf8')
    if (key.length !== 32) throw new Error('微信支付 API v3 密钥长度必须为 32 个字符')
    const ciphertext = Buffer.from(resource.ciphertext, 'base64')
    if (ciphertext.length <= 16) throw new Error('微信支付回调密文无效')
    const decipher = (await import('node:crypto')).createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce))
    decipher.setAAD(Buffer.from(resource.associated_data || ''))
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16))
    const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()])
    const data = JSON.parse(plain.toString('utf8'))
    return { event, data }
  }
  async verify(rawBody: string, headers: Record<string, string>) {
    const { event, data } = await this.decryptWebhook(rawBody, headers)
    if (event.event_type !== 'TRANSACTION.SUCCESS') return null
    if (!data.out_trade_no) throw new Error('微信支付回调缺少订单号')
    if (String(data.appid || '') !== String(this.config.appId) || String(data.mchid || '') !== String(this.config.mchId)) throw new Error('微信支付回调商户信息不匹配')
    if (String(data.amount?.currency || 'CNY').toUpperCase() !== 'CNY') throw new Error('微信支付回调币种不匹配')
    const amountCents = assertPositiveCents(data.amount?.total, '微信支付回调')
    return { outTradeNo: data.out_trade_no, tradeNo: data.transaction_id, amountCents, success: data.trade_state === 'SUCCESS' }
  }
  async verifyRefund(rawBody: string, headers: Record<string, string>): Promise<PaymentRefundNotification | null> {
    const { event, data } = await this.decryptWebhook(rawBody, headers)
    if (event.event_type !== 'REFUND.SUCCESS') return null
    if (!data.out_trade_no || !data.out_refund_no) throw new Error('微信支付退款回调缺少订单号')
    if (String(data.mchid || '') !== String(this.config.mchId)) throw new Error('微信支付退款回调商户信息不匹配')
    if (String(data.refund_status || '').toUpperCase() !== 'SUCCESS') throw new Error('微信支付退款回调状态无效')
    return { outTradeNo: data.out_trade_no, refundId: data.out_refund_no, success: true }
  }
  async refund(outTradeNo: string, tradeNo: string | undefined, amountCents: number, reason: string, totalAmountCents = amountCents) {
    const outRefundNo = `${outTradeNo}-R${getServerTimestamp()}`
    const result = await this.call('POST', '/v3/refund/domestic/refunds', { out_refund_no: outRefundNo, ...(tradeNo ? { transaction_id: tradeNo } : { out_trade_no: outTradeNo }), reason, amount: { refund: amountCents, total: totalAmountCents, currency: 'CNY' }, notify_url: this.config.refundNotifyUrl })
    return { refundId: outRefundNo, pending: result.status !== 'SUCCESS' }
  }
  async queryRefund(outTradeNo: string, refundId?: string) {
    const outRefundNo = String(refundId || `${outTradeNo}-${getServerTimestamp()}`).trim()
    const result = await this.call('GET', `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}`)
    const status = String(result.status || '').toUpperCase()
    return { refundId: result.out_refund_no || outRefundNo, status: status === 'SUCCESS' ? 'paid' as const : ['CLOSED', 'ABNORMAL'].includes(status) ? 'failed' as const : 'pending' as const }
  }
  async cancel(outTradeNo: string) { await this.call('POST', `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`, { mchid: this.config.mchId }) }
}

class StripeProvider implements PaymentProvider {
  constructor(private config: Record<string, any>) {}
  private async call(path: string, values?: Record<string, string>, method = 'POST', idempotencyKey?: string) {
    return requestJson(`https://api.stripe.com/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.config.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      body: values ? formEncode(values) : undefined
    })
  }
  async create(req: PaymentCreateRequest) {
    const intent = await this.call('/payment_intents', {
      amount: String(req.amountCents),
      currency: req.currency.toLowerCase(),
      description: req.subject,
      'metadata[out_trade_no]': req.outTradeNo,
      'automatic_payment_methods[enabled]': 'true'
    }, 'POST', `voicehub-payment-${req.outTradeNo}`)
    if (!intent.id || !intent.client_secret) throw new Error('Stripe 未返回支付意图')
    return {
      tradeNo: intent.id,
      clientSecret: intent.client_secret,
      extra: { publishableKey: this.config.publishableKey, currency: req.currency }
    }
  }
  async query(_outTradeNo: string, tradeNo?: string) {
    if (!tradeNo) return { status: 'pending' as const }
    const intent = await this.call(`/payment_intents/${encodeURIComponent(tradeNo)}`, undefined, 'GET')
    const status: PaymentQueryResult['status'] = intent.status === 'succeeded' ? 'paid' : intent.status === 'canceled' ? 'failed' : 'pending'
    return { status, tradeNo: intent.id, amountCents: intent.amount }
  }
  async verify(rawBody: string, headers: Record<string, string>) {
    const signature = headers['stripe-signature'] || ''
    const timestamp = signature.split(',').map(item => item.split('=', 2)).find(([key]) => key === 't')?.[1] || ''
    const signatures = signature.split(',').flatMap(item => {
      const [key, value] = item.split('=', 2)
      return key === 'v1' && value ? [value] : []
    })
    assertRecentWebhookTimestamp(timestamp, 'Stripe')
    const expected = createHmac('sha256', this.config.webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex')
    const verified = signatures.some(value => {
      const actual = Buffer.from(value)
      const expectedBuffer = Buffer.from(expected)
      return actual.length === expectedBuffer.length && timingSafeEqual(expectedBuffer, actual)
    })
    if (!verified) throw new Error('Stripe 回调签名无效')
    const event = JSON.parse(rawBody)
    if (!['payment_intent.succeeded', 'payment_intent.payment_failed'].includes(event.type)) return null
    const payment = event.data.object
    const outTradeNo = payment.metadata?.out_trade_no
    if (!outTradeNo) throw new Error('Stripe 回调缺少订单号')
    const amountCents = Number(payment.amount)
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Stripe 回调金额无效')
    const callbackCurrency = String(payment.currency || '').trim().toUpperCase()
    const configuredCurrency = String(this.config.currency || 'CNY').trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(callbackCurrency) || callbackCurrency !== configuredCurrency) throw new Error('Stripe 回调币种不匹配')
    const failed = event.type === 'payment_intent.payment_failed'
    return { outTradeNo, tradeNo: payment.id, amountCents, success: !failed && payment.status === 'succeeded' }
  }
  async refund(_outTradeNo: string, tradeNo: string | undefined, amountCents: number) {
    if (!tradeNo) throw new Error('Stripe 退款缺少 PaymentIntent')
    const result = await this.call('/refunds', { payment_intent: tradeNo, amount: String(amountCents) })
    return { refundId: result.id, pending: result.status !== 'succeeded' }
  }
  async cancel(_outTradeNo: string, tradeNo?: string) {
    if (tradeNo) await this.call(`/payment_intents/${encodeURIComponent(tradeNo)}/cancel`)
  }
}

const airwallexTokens = new Map<string, { token: string; expires: number }>()
const normalizeAirwallexBase = (value: unknown) => {
  const raw = String(value || 'https://api.airwallex.com/api/v1').trim()
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('Airwallex API 地址无效') }
  if (url.protocol !== 'https:' || !['api.airwallex.com', 'api-demo.airwallex.com'].includes(url.hostname) || url.pathname.replace(/\/$/, '') !== '/api/v1' || url.search || url.hash) {
    throw new Error('Airwallex API 地址仅支持正式或测试环境的 /api/v1 HTTPS 地址')
  }
  return url.origin + '/api/v1'
}
const normalizeAirwallexCountry = (value: unknown) => {
  const country = String(value || 'CN').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('Airwallex 国家/地区代码必须为两个大写字母')
  return country
}
class AirwallexProvider implements PaymentProvider {
  private base: string
  constructor(private config: Record<string, any>) {
    this.base = normalizeAirwallexBase(config.apiBase)
  }
  private async token() {
    const cacheKey = `${this.base}|${this.config.clientId}|${this.config.accountId || ''}|${createHash('sha256').update(String(this.config.apiKey || '')).digest('hex').slice(0, 16)}`
    const cached = airwallexTokens.get(cacheKey)
    if (cached && cached.expires > getServerTimestamp() + 60000) return cached.token
    const data = await requestJson(`${this.base}/authentication/login`, { method: 'POST', headers: { 'x-client-id': this.config.clientId, 'x-api-key': this.config.apiKey, ...(this.config.accountId ? { 'x-login-as': this.config.accountId } : {}) } })
    airwallexTokens.set(cacheKey, { token: data.token, expires: Date.parse(data.expires_at) || getServerTimestamp() + 25 * 60000 })
    return data.token
  }
  private async call(path: string, payload?: Record<string, unknown>, method = 'POST') {
    const token = await this.token()
    return requestJson(`${this.base}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(this.config.accountId ? { 'x-on-behalf-of': this.config.accountId } : {}) }, body: payload ? JSON.stringify(payload) : undefined })
  }
  async create(req: PaymentCreateRequest) {
    const currency = String(this.config.currency || req.currency).trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Airwallex 支付币种无效')
    if (currency !== String(req.currency).toUpperCase()) throw new Error(`Airwallex 服务商币种 ${currency} 与套餐币种 ${req.currency} 不一致`)
    const countryCode = normalizeAirwallexCountry(this.config.countryCode)
    const result = await this.call('/pa/payment_intents/create', {
      request_id: deterministicRequestId('payment-intent', req.outTradeNo, String(req.amountCents), currency),
      amount: req.amountCents / 100,
      currency,
      merchant_order_id: req.outTradeNo,
      return_url: req.returnUrl,
      ...(String(this.config.descriptor || '').trim() ? { descriptor: String(this.config.descriptor).trim().slice(0, 64) } : {}),
      metadata: { order_id: req.outTradeNo }
    })
    if (!result.id || !result.client_secret) throw new Error('Airwallex 未返回支付意图')
    return { tradeNo: result.id, clientSecret: result.client_secret, extra: { environment: this.base.includes('api-demo') ? 'demo' : 'prod', currency, countryCode } }
  }
  async query(_outTradeNo: string, tradeNo?: string) {
    if (!tradeNo) return { status: 'pending' as const }
    const result = await this.call(`/pa/payment_intents/${encodeURIComponent(tradeNo)}`, undefined, 'GET')
    const status: PaymentQueryResult['status'] = result.status === 'SUCCEEDED' ? 'paid' : result.status === 'CANCELLED' ? 'failed' : 'pending'
    return { status, tradeNo: result.id, amountCents: Math.round(Number(result.amount) * 100) }
  }
  async verify(rawBody: string, headers: Record<string, string>) {
    const timestamp = headers['x-timestamp'] || ''
    const signature = String(headers['x-signature'] || '').trim().toLowerCase()
    assertRecentWebhookTimestamp(timestamp, 'Airwallex')
    const expected = createHmac('sha256', this.config.webhookSecret).update(timestamp + rawBody).digest('hex')
    const expectedBuffer = Buffer.from(expected)
    const signatureBuffer = Buffer.from(signature)
    if (!signature || signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) throw new Error('Airwallex 回调签名无效')
    const event = JSON.parse(rawBody)
    if (!['payment_intent.succeeded', 'payment_intent.cancelled'].includes(event.name)) return null
    const intent = event.data.object
    if (!intent.merchant_order_id) throw new Error('Airwallex 回调缺少订单号')
    if (event.name === 'payment_intent.succeeded' && String(intent.status || '').toUpperCase() !== 'SUCCEEDED') throw new Error('Airwallex 成功回调的支付状态无效')
    if (event.name === 'payment_intent.cancelled' && String(intent.status || '').toUpperCase() !== 'CANCELLED') throw new Error('Airwallex 取消回调的支付状态无效')
    const amountCents = Math.round(Number(intent.amount) * 100)
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Airwallex 回调金额无效')
    const configuredCurrency = String(this.config.currency || '').trim().toUpperCase()
    const callbackCurrency = String(intent.currency || '').trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(callbackCurrency) || (configuredCurrency && callbackCurrency !== configuredCurrency)) throw new Error('Airwallex 回调币种不匹配')
    return { outTradeNo: intent.merchant_order_id, tradeNo: intent.id, amountCents, success: event.name === 'payment_intent.succeeded' }
  }
  async refund(_outTradeNo: string, tradeNo: string | undefined, amountCents: number, reason: string) {
    if (!tradeNo) throw new Error('Airwallex 退款缺少 PaymentIntent')
    const result = await this.call('/pa/refunds/create', { request_id: deterministicRequestId('refund', tradeNo, String(amountCents)), payment_intent_id: tradeNo, amount: amountCents / 100, reason })
    return { refundId: result.id, pending: result.status !== 'SETTLED' }
  }
  async cancel(_outTradeNo: string, tradeNo?: string) { if (tradeNo) await this.call(`/pa/payment_intents/${encodeURIComponent(tradeNo)}/cancel`) }
}

export const createPaymentProvider = (providerKey: string, config: Record<string, any>): PaymentProvider => {
  switch (providerKey) {
    case 'easypay': return new EasyPayProvider(config)
    case 'alipay': return new AlipayProvider(config)
    case 'wxpay': return new WxPayProvider(config)
    case 'stripe': return new StripeProvider(config)
    case 'airwallex': return new AirwallexProvider(config)
    default: throw new Error(`不支持的支付服务商: ${providerKey}`)
  }
}
