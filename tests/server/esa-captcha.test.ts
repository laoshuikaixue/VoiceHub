import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ESA_CAPTCHA_DEFAULT_REGION,
  ESA_CAPTCHA_REGIONS,
  ESA_CAPTCHA_VERIFY_HEADER,
  getEsaCaptchaServers,
  normalizeEsaCaptchaRegion
} from '../../app/utils/esaCaptcha.ts'

test('中国内地节点使用 cn 服务端域名', () => {
  assert.deepEqual(getEsaCaptchaServers('cn'), [
    'captcha-esa-open.aliyuncs.com',
    'captcha-esa-open-b.aliyuncs.com'
  ])
})

test('新加坡节点使用 sgp 服务端域名', () => {
  assert.deepEqual(getEsaCaptchaServers('sgp'), [
    'captcha-esa-open-southeast.aliyuncs.com',
    'captcha-esa-open-southeast-b.aliyuncs.com'
  ])
})

test('未知区域回退默认区域', () => {
  assert.equal(normalizeEsaCaptchaRegion('us'), ESA_CAPTCHA_DEFAULT_REGION)
  assert.equal(normalizeEsaCaptchaRegion(undefined), ESA_CAPTCHA_DEFAULT_REGION)
  assert.equal(normalizeEsaCaptchaRegion(null), ESA_CAPTCHA_DEFAULT_REGION)
  assert.equal(normalizeEsaCaptchaRegion(''), ESA_CAPTCHA_DEFAULT_REGION)
  assert.deepEqual(getEsaCaptchaServers('us'), getEsaCaptchaServers(ESA_CAPTCHA_DEFAULT_REGION))
})

test('每个区域都至少配置一个服务端域名', () => {
  for (const region of ESA_CAPTCHA_REGIONS) {
    assert.ok(region.servers.length > 0, `${region.value} 缺少服务端域名`)
  }
})

test('验签参数请求头名称固定为 captcha-verify-param', () => {
  assert.equal(ESA_CAPTCHA_VERIFY_HEADER, 'captcha-verify-param')
})
