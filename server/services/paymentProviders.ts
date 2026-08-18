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

export interface PaymentProvider {
  create(request: PaymentCreateRequest): Promise<PaymentCreateResult>
  query(outTradeNo: string, tradeNo?: string): Promise<PaymentQueryResult>
  verify(rawBody: string, headers: Record<string, string>, query?: Record<string, string>): Promise<PaymentNotification | null>
  refund(outTradeNo: string, tradeNo: string | undefined, amountCents: number, reason: string, totalAmountCents?: number): Promise<{ refundId?: string; pending?: boolean }>
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
      pid: this.config.pid, type: req.method === 'wxpay' ? 'wxpay' : 'alipay',
      out_trade_no: req.outTradeNo, notify_url: req.notifyUrl, return_url: req.returnUrl,
      name: req.subject, money: money(req.amountCents), clientip: req.clientIp
    }
    const channel = req.method === 'wxpay' ? this.config.cidWxpay : this.config.cidAlipay
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
    const paid = row.trade_status === 'TRADE_SUCCESS' || Number(row.status) === 1
    return { status: paid ? 'paid' as const : 'pending' as const, tradeNo: row.trade_no, amountCents: Math.round(Number(row.money || 0) * 100) }
  }
  async verify(rawBody: string) {
    const params = Object.fromEntries(new URLSearchParams(rawBody))
    if (!params.sign || easyPaySign(params, this.config.pkey) !== params.sign) throw new Error('易支付回调签名无效')
    if (!params.out_trade_no) throw new Error('易支付回调缺少订单号')
    return { outTradeNo: params.out_trade_no, tradeNo: params.trade_no, amountCents: Math.round(Number(params.money) * 100), success: params.trade_status === 'TRADE_SUCCESS' }
  }
  async refund(outTradeNo: string, tradeNo: string | undefined, amountCents: number) {
    const params: Record<string, string> = { pid: this.config.pid, key: this.config.pkey, money: money(amountCents) }
    if (tradeNo) params.trade_no = tradeNo
    else params.out_trade_no = outTradeNo
    const data = await requestJson(`${normalizeBase(this.config.apiBase)}/api.php?act=refund`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: formEncode(params)
    })
    if (Number(data.code) !== 1) throw new Error(data.msg || '易支付退款失败')
    return { refundId: tradeNo || outTradeNo }
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
    this.gateway = config.gateway || 'https://openapi.alipay.com/gateway.do'
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
    if (!req.mobile && this.config.paymentMode === 'redirect') return { payUrl: this.pagePayUrl(req) }
    if (req.mobile && !req.alipayForceQrCode && !req.alipayMobileDeepLink) {
      const params: Record<string, string> = {
        app_id: this.config.appId, method: 'alipay.trade.wap.pay', format: 'JSON', charset: 'utf-8', sign_type: 'RSA2',
        timestamp: getServerDate().toISOString().slice(0, 19).replace('T', ' '), version: '1.0',
        notify_url: req.notifyUrl, return_url: req.returnUrl,
        biz_content: JSON.stringify({ out_trade_no: req.outTradeNo, total_amount: money(req.amountCents), subject: req.subject, product_code: 'QUICK_WAP_WAY', timeout_express: '30m' })
      }
      params.sign = alipaySign(params, this.config.privateKey)
      return { payUrl: `${this.gateway}?${formEncode(params)}` }
    }
    let result
    try {
      result = await this.call('alipay.trade.precreate', {
      out_trade_no: req.outTradeNo, total_amount: money(req.amountCents), subject: req.subject,
      timeout_express: '30m'
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
      biz_content: JSON.stringify({ out_trade_no: req.outTradeNo, product_code: 'FAST_INSTANT_TRADE_PAY', total_amount: money(req.amountCents), subject: req.subject, timeout_express: '30m' })
    }
    params.sign = alipaySign(params, this.config.privateKey)
    return `${this.gateway}?${formEncode(params)}`
  }
  async query(outTradeNo: string) {
    const result = await this.call('alipay.trade.query', { out_trade_no: outTradeNo })
    const status: PaymentQueryResult['status'] = ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(result.trade_status) ? 'paid' : 'pending'
    return { status, tradeNo: result.trade_no, amountCents: Math.round(Number(result.total_amount || 0) * 100) }
  }
  async verify(rawBody: string) {
    const params = Object.fromEntries(new URLSearchParams(rawBody))
    if (!alipayVerify(params, this.config.publicKey)) throw new Error('支付宝回调签名无效')
    if (!params.out_trade_no) throw new Error('支付宝回调缺少订单号')
    return { outTradeNo: params.out_trade_no, tradeNo: params.trade_no, amountCents: Math.round(Number(params.total_amount) * 100), success: ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status || '') }
  }
  async refund(outTradeNo: string, _tradeNo: string | undefined, amountCents: number, reason: string) {
    const result = await this.call('alipay.trade.refund', { out_trade_no: outTradeNo, refund_amount: money(amountCents), refund_reason: reason, out_request_no: `${outTradeNo}-${getServerTimestamp()}` })
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
    const type = req.mobile ? 'h5' : 'native'
    const path = `/v3/pay/transactions/${type}`
    const payload: any = { appid: this.config.appId, mchid: this.config.mchId, description: req.subject, out_trade_no: req.outTradeNo, notify_url: req.notifyUrl, amount: { total: req.amountCents, currency: req.currency } }
    if (type === 'h5') payload.scene_info = { payer_client_ip: req.clientIp, h5_info: { type: 'Wap' } }
    const result = await this.call('POST', path, payload)
    return type === 'native' ? { qrCode: result.code_url } : { payUrl: result.h5_url }
  }
  async query(outTradeNo: string) {
    const result = await this.call('GET', `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(this.config.mchId)}`)
    const status: PaymentQueryResult['status'] = result.trade_state === 'SUCCESS' ? 'paid' : result.trade_state === 'NOTPAY' ? 'pending' : 'failed'
    return { status, tradeNo: result.transaction_id, amountCents: Number(result.amount?.total || 0) }
  }
  async verify(rawBody: string, headers: Record<string, string>) {
    const timestamp = headers['wechatpay-timestamp'] || ''
    const nonce = headers['wechatpay-nonce'] || ''
    const signature = headers['wechatpay-signature'] || ''
    assertRecentWebhookTimestamp(timestamp, '微信支付')
    if (!createVerify('RSA-SHA256').update(`${timestamp}\n${nonce}\n${rawBody}\n`).verify(this.config.publicKey, signature, 'base64')) throw new Error('微信支付回调签名无效')
    const event = JSON.parse(rawBody)
    if (event.event_type !== 'TRANSACTION.SUCCESS') return null
    const resource = event.resource
    const key = Buffer.from(this.config.apiV3Key)
    const decipher = (await import('node:crypto')).createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce))
    decipher.setAAD(Buffer.from(resource.associated_data || ''))
    const ciphertext = Buffer.from(resource.ciphertext, 'base64')
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16))
    const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()])
    const data = JSON.parse(plain.toString('utf8'))
    if (!data.out_trade_no) throw new Error('微信支付回调缺少订单号')
    return { outTradeNo: data.out_trade_no, tradeNo: data.transaction_id, amountCents: Number(data.amount?.total || 0), success: data.trade_state === 'SUCCESS' }
  }
  async refund(outTradeNo: string, tradeNo: string | undefined, amountCents: number, reason: string, totalAmountCents = amountCents) {
    const result = await this.call('POST', '/v3/refund/domestic/refunds', { out_refund_no: `${outTradeNo}-${getServerTimestamp()}`, ...(tradeNo ? { transaction_id: tradeNo } : { out_trade_no: outTradeNo }), reason, amount: { refund: amountCents, total: totalAmountCents, currency: 'CNY' }, notify_url: this.config.refundNotifyUrl })
    return { refundId: result.refund_id, pending: result.status !== 'SUCCESS' }
  }
  async cancel(outTradeNo: string) { await this.call('POST', `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`, { mchid: this.config.mchId }) }
}

class StripeProvider implements PaymentProvider {
  constructor(private config: Record<string, any>) {}
  private async call(path: string, values?: Record<string, string>, method = 'POST') {
    return requestJson(`https://api.stripe.com/v1${path}`, { method, headers: { authorization: `Bearer ${this.config.secretKey}`, 'content-type': 'application/x-www-form-urlencoded' }, body: values ? formEncode(values) : undefined })
  }
  async create(req: PaymentCreateRequest) {
    const session = await this.call('/checkout/sessions', {
      mode: 'payment', success_url: req.returnUrl,
      cancel_url: `${req.returnUrl}&cancelled=1`,
      'line_items[0][price_data][currency]': req.currency.toLowerCase(), 'line_items[0][price_data][unit_amount]': String(req.amountCents),
      'line_items[0][price_data][product_data][name]': req.subject, 'line_items[0][quantity]': '1',
      client_reference_id: req.outTradeNo, 'metadata[out_trade_no]': req.outTradeNo
    })
    return { tradeNo: session.id, payUrl: session.url }
  }
  async query(_outTradeNo: string, tradeNo?: string) {
    if (!tradeNo) return { status: 'pending' as const }
    const session = await this.call(`/checkout/sessions/${encodeURIComponent(tradeNo)}`, undefined, 'GET')
    const status: PaymentQueryResult['status'] = session.payment_status === 'paid' ? 'paid' : 'pending'
    return { status, tradeNo: session.payment_intent, amountCents: session.amount_total }
  }
  async verify(rawBody: string, headers: Record<string, string>) {
    const signature = headers['stripe-signature'] || ''
    const parts: Record<string, string> = {}
    for (const item of signature.split(',')) { const [key, value] = item.split('=', 2); if (key && value && !parts[key]) parts[key] = value }
    assertRecentWebhookTimestamp(parts.t || '', 'Stripe')
    const expected = createHmac('sha256', this.config.webhookSecret).update(`${parts.t}.${rawBody}`).digest('hex')
    if (!parts.v1 || !timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))) throw new Error('Stripe 回调签名无效')
    const event = JSON.parse(rawBody)
    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'].includes(event.type)) return null
    const session = event.data.object
    const outTradeNo = session.client_reference_id || session.metadata?.out_trade_no
    if (!outTradeNo) throw new Error('Stripe 回调缺少订单号')
    return { outTradeNo, tradeNo: session.payment_intent || session.id, amountCents: session.amount_total, success: event.type !== 'checkout.session.async_payment_failed' && session.payment_status === 'paid' }
  }
  async refund(_outTradeNo: string, tradeNo: string | undefined, amountCents: number) {
    if (!tradeNo) throw new Error('Stripe 退款缺少 PaymentIntent')
    const result = await this.call('/refunds', { payment_intent: tradeNo, amount: String(amountCents) })
    return { refundId: result.id, pending: result.status !== 'succeeded' }
  }
}

const airwallexTokens = new Map<string, { token: string; expires: number }>()
class AirwallexProvider implements PaymentProvider {
  private base: string
  constructor(private config: Record<string, any>) {
    this.base = config.apiBase || 'https://api-demo.airwallex.com/api/v1'
  }
  private async token() {
    const cacheKey = `${this.base}|${this.config.clientId}|${this.config.accountId || ''}`
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
    const result = await this.call('/pa/payment_intents/create', { request_id: deterministicRequestId('payment-intent', req.outTradeNo, String(req.amountCents), req.currency), amount: req.amountCents / 100, currency: req.currency, merchant_order_id: req.outTradeNo, return_url: req.returnUrl, metadata: { order_id: req.outTradeNo } })
    return { tradeNo: result.id, clientSecret: result.client_secret, extra: { environment: this.base.includes('api-demo') ? 'demo' : 'prod', currency: req.currency, countryCode: this.config.countryCode || 'CN' } }
  }
  async query(_outTradeNo: string, tradeNo?: string) {
    if (!tradeNo) return { status: 'pending' as const }
    const result = await this.call(`/pa/payment_intents/${encodeURIComponent(tradeNo)}`, undefined, 'GET')
    const status: PaymentQueryResult['status'] = result.status === 'SUCCEEDED' ? 'paid' : result.status === 'CANCELLED' ? 'failed' : 'pending'
    return { status, tradeNo: result.id, amountCents: Math.round(Number(result.amount) * 100) }
  }
  async verify(rawBody: string, headers: Record<string, string>) {
    const timestamp = headers['x-timestamp'] || ''
    const signature = headers['x-signature'] || ''
    assertRecentWebhookTimestamp(timestamp, 'Airwallex')
    const expected = createHmac('sha256', this.config.webhookSecret).update(timestamp + rawBody).digest('hex')
    if (!signature || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()))) throw new Error('Airwallex 回调签名无效')
    const event = JSON.parse(rawBody)
    if (!['payment_intent.succeeded', 'payment_intent.cancelled'].includes(event.name)) return null
    const intent = event.data.object
    if (!intent.merchant_order_id) throw new Error('Airwallex 回调缺少订单号')
    return { outTradeNo: intent.merchant_order_id, tradeNo: intent.id, amountCents: Math.round(Number(intent.amount) * 100), success: event.name === 'payment_intent.succeeded' }
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
