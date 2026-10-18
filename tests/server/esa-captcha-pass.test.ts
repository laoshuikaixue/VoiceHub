import test from 'node:test'
import assert from 'node:assert/strict'
import { seal, unseal } from '../../server/utils/music-source-plugins/tickets.ts'
import {
  ESA_CAPTCHA_PASS_TICKET_PURPOSE,
  ESA_CAPTCHA_PASS_TICKET_TTL
} from '../../server/config/constants.ts'

/**
 * 公共验证接口签发的 passToken 走 seal/unseal（JWT_SECRET 派生密钥、内嵌 TTL）。
 * 此处只覆盖凭证原语语义：用途隔离、域名/用途载荷保真、TTL 过期。
 * 接口层「无场景放行 / 缺凭证拒绝」由 login/register 分支的 verifyEsaCaptchaPass 保证。
 */
test('ESA 通过凭证按 TTL 签发且同 purpose 可解回原载荷', () => {
  const previous = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-secret-for-esa-captcha-pass'
  try {
    const payload = { purpose: 'login', issuedHost: 'hub.example.com' }
    const token = seal(payload, ESA_CAPTCHA_PASS_TICKET_PURPOSE, ESA_CAPTCHA_PASS_TICKET_TTL)
    assert.equal(typeof token, 'string')
    assert.deepEqual(unseal(token, ESA_CAPTCHA_PASS_TICKET_PURPOSE), payload)
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previous
  }
})

test('ESA 通过凭证 purpose 不符无法解出，防止跨业务接口复用', () => {
  const previous = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-secret-for-esa-captcha-pass'
  try {
    const token = seal({ purpose: 'login', issuedHost: 'hub.example.com' }, ESA_CAPTCHA_PASS_TICKET_PURPOSE, ESA_CAPTCHA_PASS_TICKET_TTL)
    // 换一枚派生密钥（不同 purpose）即解验失败，模拟凭证被拿到别的用途下重放
    assert.throws(() => unseal(token, 'esa-captcha-pass-tampered'))
    // 篡改密文首字符同样破坏 GCM 认证标签
    assert.throws(() => unseal('x' + token.slice(1), ESA_CAPTCHA_PASS_TICKET_PURPOSE))
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previous
  }
})

test('ESA 通过凭证超过 TTL 后解验失败', () => {
  const previous = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-secret-for-esa-captcha-pass'
  try {
    // 负 TTL 使 expires 落在过去，命中 unseal 的过期分支，等价于凭证签发 60s 后再提交
    const token = seal({ purpose: 'register', issuedHost: 'hub.example.com' }, ESA_CAPTCHA_PASS_TICKET_PURPOSE, -1)
    assert.throws(() => unseal(token, ESA_CAPTCHA_PASS_TICKET_PURPOSE))
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previous
  }
})
