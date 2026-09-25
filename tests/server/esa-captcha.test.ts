import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ESA_CAPTCHA_ANY_HOST,
  ESA_CAPTCHA_DEFAULT_REGION,
  ESA_CAPTCHA_ENDPOINTS,
  ESA_CAPTCHA_ENDPOINT_PATHS,
  ESA_CAPTCHA_REGIONS,
  ESA_CAPTCHA_VERIFY_HEADER,
  getEsaCaptchaServers,
  matchEsaCaptchaHost,
  normalizeEsaCaptchaRegion,
  parseEsaCaptchaScenes,
  resolveEsaCaptchaSceneId
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

test('受保护接口枚举包含登录与注册', () => {
  assert.deepEqual([...ESA_CAPTCHA_ENDPOINTS], ['login', 'register'])
  assert.equal(ESA_CAPTCHA_ANY_HOST, '*')
})

test('每个受保护接口都登记了可供填写的路径', () => {
  // 路径会直接展示在后台供管理员粘到 ESA 控制台，漏配会显示为空白
  assert.deepEqual(Object.keys(ESA_CAPTCHA_ENDPOINT_PATHS).sort(), [...ESA_CAPTCHA_ENDPOINTS].sort())
  for (const endpoint of ESA_CAPTCHA_ENDPOINTS) {
    const path = ESA_CAPTCHA_ENDPOINT_PATHS[endpoint]
    assert.match(path, /^\/api\/auth\/[a-z-]+$/, `${endpoint} 的路径应为 /api/auth/ 下的接口`)
  }
})

test('非法的场景 ID 存储值回退空数组', () => {
  assert.deepEqual(parseEsaCaptchaScenes('{ not json'), [])
  assert.deepEqual(parseEsaCaptchaScenes(null), [])
  assert.deepEqual(parseEsaCaptchaScenes(undefined), [])
  assert.deepEqual(parseEsaCaptchaScenes('"Aaaaa1"'), [])
  assert.deepEqual(parseEsaCaptchaScenes({ endpoint: 'login' }), [])
})

test('缺少必填项或接口非法的规则项被丢弃', () => {
  const raw = JSON.stringify([
    { endpoint: 'login', host: '*', sceneId: 'Aaaaa1' },
    { endpoint: 'login', host: '*', sceneId: '   ' },
    { endpoint: 'login', host: '  ', sceneId: 'Bbbbb2' },
    { endpoint: 'unbind', host: '*', sceneId: 'Ccccc3' },
    { endpoint: 'register', sceneId: 'Dddd4' },
    null
  ])
  assert.deepEqual(parseEsaCaptchaScenes(raw), [{ endpoint: 'login', host: '*', sceneId: 'Aaaaa1' }])
})

test('域名归一化大小写与首尾空白', () => {
  assert.deepEqual(
    parseEsaCaptchaScenes([{ endpoint: 'login', host: ' Hub.Example.COM ', sceneId: ' Aaaaa1 ' }]),
    [{ endpoint: 'login', host: 'hub.example.com', sceneId: 'Aaaaa1' }]
  )
})

test('通配域名匹配任意层级子域但不含裸域', () => {
  assert.equal(matchEsaCaptchaHost('*.example.com', 'a.example.com'), true)
  assert.equal(matchEsaCaptchaHost('*.example.com', 'x.a.example.com'), true)
  assert.equal(matchEsaCaptchaHost('*.example.com', 'example.com'), false)
  assert.equal(matchEsaCaptchaHost('*.example.com', 'notexample.com'), false)
  assert.equal(matchEsaCaptchaHost('*.EXAMPLE.com', 'A.Example.COM'), true)
})

test('任意域名匹配任何主机，精确域名需全等', () => {
  assert.equal(matchEsaCaptchaHost('*', 'anything.test'), true)
  assert.equal(matchEsaCaptchaHost('*', ''), true)
  assert.equal(matchEsaCaptchaHost('hub.example.com', 'hub.example.com'), true)
  assert.equal(matchEsaCaptchaHost('hub.example.com', 'www.example.com'), false)
  assert.equal(matchEsaCaptchaHost('hub.example.com', ''), false)
})

test('场景 ID 解析优先级为精确域名高于通配子域高于任意域名', () => {
  const raw = [
    { endpoint: 'login', host: '*', sceneId: 'AnyL1' },
    { endpoint: 'login', host: '*.example.com', sceneId: 'SubL2' },
    { endpoint: 'login', host: 'hub.example.com', sceneId: 'ExactL3' }
  ]
  assert.equal(resolveEsaCaptchaSceneId(raw, 'login', 'hub.example.com'), 'ExactL3')
  assert.equal(resolveEsaCaptchaSceneId(raw, 'login', 'a.example.com'), 'SubL2')
  assert.equal(resolveEsaCaptchaSceneId(raw, 'login', 'other.test'), 'AnyL1')
})

test('场景 ID 按接口隔离', () => {
  const raw = [{ endpoint: 'register', host: '*', sceneId: 'OnlyR' }]
  assert.equal(resolveEsaCaptchaSceneId(raw, 'login', 'hub.example.com'), '')
  assert.equal(resolveEsaCaptchaSceneId(raw, 'register', 'hub.example.com'), 'OnlyR')
})

test('SSR 无域名时只命中任意域名规则，无匹配返回空字符串', () => {
  const raw = [
    { endpoint: 'login', host: 'hub.example.com', sceneId: 'ExactL' },
    { endpoint: 'login', host: '*', sceneId: 'AnyL' },
    { endpoint: 'register', host: 'hub.example.com', sceneId: 'ExactR' }
  ]
  assert.equal(resolveEsaCaptchaSceneId(raw, 'login', ''), 'AnyL')
  assert.equal(resolveEsaCaptchaSceneId(raw, 'register', ''), '')
  assert.equal(resolveEsaCaptchaSceneId(raw, 'login', 'unknown.test'), 'AnyL')
})

test('场景 ID 存储值异常时解析结果为空', () => {
  assert.equal(resolveEsaCaptchaSceneId('{ broken', 'login', 'hub.example.com'), '')
  assert.equal(resolveEsaCaptchaSceneId(null, 'login', 'hub.example.com'), '')
})

test('未启用 ESA 时后台提交的未填完占位行被丢弃而不报错', () => {
  // 保存接口在非 ESA 服务商下走此容错路径，保证默认一行空场景不阻断整页设置保存
  const raw = JSON.stringify([
    { endpoint: 'login', host: ESA_CAPTCHA_ANY_HOST, sceneId: '' },
    { endpoint: 'register', host: 'hub.example.com', sceneId: 'ValidR' }
  ])
  assert.deepEqual(parseEsaCaptchaScenes(raw), [
    { endpoint: 'register', host: 'hub.example.com', sceneId: 'ValidR' }
  ])
})
