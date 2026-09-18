import { test } from 'node:test'
import assert from 'node:assert/strict'
import { preparePrelude } from '../../server/utils/music-source-plugins/prepare.ts'
import { runPlugin } from '../../server/utils/music-source-plugins/runtime.ts'
import { publicAddress, networkUrl, requestNetwork } from '../../server/utils/music-source-plugins/network.ts'
import { seal, unseal } from '../../server/utils/music-source-plugins/tickets.ts'

const prelude = preparePrelude()

test('MusicFree 依赖、原始字段和用户参数在受限环境中可用', async () => {
  const response = await runPlugin({ prelude: await prelude, protocol: 'auto', variables: { token: 'sample' }, source: `
    const crypto = require('crypto-js'); const $ = require('cheerio').load('<b>测试</b>');
    module.exports = { platform: '测试', async getMediaSource(item) {
      return { url: new URL('/track/' + item.hash, 'https://example.com').href,
        text: $('b').text(), hash: crypto.MD5('abc').toString(), token: env.getUserVariables().token,
        globals: [typeof process, typeof globalThis.constructor.constructor('return this')().process],
        encoded: btoa('abc'), decoded: atob('YWJj') };
    }};`, action: 'musicUrl', params: { item: { id: 'track', hash: 'abc' }, quality: 'standard' } })
  assert.equal(response.capability.protocol, 'musicfree')
  assert.equal(response.result.url, 'https://example.com/track/abc')
  assert.equal(response.result.text, '测试')
  assert.equal(response.result.hash, '900150983cd24fb0d6963f7d28e17f72')
  assert.equal(response.result.token, 'sample')
  assert.deepEqual(response.result.globals, ['undefined', 'undefined'])
  assert.equal(response.result.encoded, 'YWJj')
  assert.equal(response.result.decoded, 'abc')
})

test('LX 等待异步 inited，并透传 source、音质与歌曲 ID', async () => {
  const response = await runPlugin({ prelude: await prelude, protocol: 'lx', source: `
    setTimeout(async () => {
      await window.lx.on(lx.EVENT_NAMES.request, async ({source, info}) => 'https://example.com/' + source + '/' + info.musicInfo.songmid + '/' + info.type);
      await lx.send(lx.EVENT_NAMES.inited, { sources: { wy: { actions: ['musicUrl'], qualitys: ['320k'] } } });
    }, 5);`, action: 'musicUrl', params: { source: 'wy', quality: '320k', item: { songmid: '123' } } })
  assert.equal(response.result, 'https://example.com/wy/123/320k')
  assert.deepEqual(response.capability.sources.wy.qualities, ['320k'])
})

test('顶层、方法和 Promise 回调死循环均被中断且不污染下一次调用', async () => {
  for (const source of ['while(true){}', 'module.exports={getMediaSource(){while(true){}}}', 'module.exports={async getMediaSource(){await Promise.resolve();while(true){}}}']) {
    await assert.rejects(runPlugin({ prelude: await prelude, protocol: 'musicfree', source, action: 'musicUrl', timeout: 150 }))
  }
  const result = await runPlugin({ prelude: await prelude, protocol: 'musicfree', source: 'module.exports={getMediaSource:async()=>({url:"ok"})}', action: 'musicUrl' })
  assert.equal(result.result.url, 'ok')
})

test('插件不能引入 Node 模块或访问内网', async () => {
  await assert.rejects(runPlugin({ prelude: await prelude, protocol: 'musicfree', source: 'require("node:fs")' }))
  await assert.rejects(requestNetwork('http://127.0.0.1/', { signal: AbortSignal.timeout(100) }))
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::', '::ffff:127.0.0.1', 'fd00::1', '100.64.0.1']) assert.equal(publicAddress(address), false, address)
  assert.equal(publicAddress('8.8.8.8'), true)
  assert.throws(() => networkUrl('file:///etc/passwd'))
  assert.throws(() => networkUrl('https://user:secret@example.com'))
})

test('媒体和选择凭证按用途隔离且不能篡改', () => {
  const previous = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'test-plugin-ticket-secret-not-for-production'
  try {
    const ticket = seal({ userId: 1 }, 'selection', 10000)
    assert.deepEqual(unseal(ticket, 'selection'), { userId: 1 })
    assert.throws(() => unseal(ticket, 'media'))
    assert.throws(() => unseal('x' + ticket.slice(1), 'selection'))
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previous
  }
})
