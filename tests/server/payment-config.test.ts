import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPaymentProviderAllowedMethods,
  getPaymentProviderConfigError,
  isPaymentMethodIdentifier,
  normalizeEasyPayCustomMethods
} from '../../server/config/payment.ts'

test('易支付自定义方式会归一化上游 type 并保留渠道 ID', () => {
  assert.deepEqual(normalizeEasyPayCustomMethods([
    { label: ' 云闪付 ', type: 'UnionPay', upstreamType: 'Up_UnionPay', cid: ' channel-1 ' }
  ]), [{ label: '云闪付', type: 'unionpay', upstreamType: 'up_unionpay', cid: 'channel-1' }])
  assert.deepEqual(normalizeEasyPayCustomMethods([
    { label: '信用卡', type: 'credit_card' }
  ]), [{ label: '信用卡', type: 'credit_card', upstreamType: 'credit_card' }])
})

test('易支付自定义方式拒绝非法、重复和官方方式', () => {
  assert.equal(normalizeEasyPayCustomMethods([{ label: '支付宝', type: 'alipay' }]), null)
  assert.equal(normalizeEasyPayCustomMethods([{ label: 'A', type: 'custom' }, { label: 'B', type: 'CUSTOM' }]), null)
  assert.equal(normalizeEasyPayCustomMethods([{ label: 'A', type: '../invalid' }]), null)
})

test('自定义方式只对易支付服务商生效', () => {
  const config = { customMethods: [{ label: '云闪付', type: 'unionpay' }] }
  assert.deepEqual(getPaymentProviderAllowedMethods('easypay', config), ['alipay', 'wxpay', 'unionpay'])
  assert.deepEqual(getPaymentProviderAllowedMethods('alipay', config), ['alipay'])
})

test('支付方式标识符只接受安全字符', () => {
  assert.equal(isPaymentMethodIdentifier('unionpay'), true)
  assert.equal(isPaymentMethodIdentifier('wx-pay_2'), true)
  assert.equal(isPaymentMethodIdentifier('__proto__'), false)
  assert.equal(isPaymentMethodIdentifier('../../pay'), false)
})

test('易支付 API 地址拒绝非公网 HTTPS 目标', () => {
  for (const apiBase of [
    'http://pay.example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://192.168.1.8',
    'https://[::1]',
    'https://user:password@pay.example.com',
    'https://pay.example.com?target=internal'
  ]) {
    assert.ok(getPaymentProviderConfigError('easypay', { apiBase }), apiBase)
  }
})

test('易支付 API 地址支持公网 HTTPS 子目录', () => {
  assert.equal(getPaymentProviderConfigError('easypay', { apiBase: 'https://pay.example.com/gateway' }), null)
  assert.equal(getPaymentProviderConfigError('easypay', { apiBase: 'https://pay.example.com/gateway/mapi.php' }), null)
})

test('易支付渠道 ID 为可选字段且拒绝空白和超长值', () => {
  assert.equal(getPaymentProviderConfigError('easypay', { cidAlipay: '', cidWxpay: 'wx-1001' }), null)
  assert.ok(getPaymentProviderConfigError('easypay', { cidAlipay: 'invalid channel' }))
  assert.ok(getPaymentProviderConfigError('easypay', { cidWxpay: 'x'.repeat(65) }))
})
