import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { unacceptableAddress } from '../../server/utils/music-source-plugins/network.ts'

// 备份目标地址复核：绝对禁止段任何情况拒，私网/回环维持默认放行（内网 NAS 与私有 S3 是常见部署）
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const OUTBOUND_URL = read('../../server/utils/outbound-url.ts')
const AUTO_CONFIG_PUT = read('../../server/api/admin/backup/auto-config.put.ts')
const TEST_S3 = read('../../server/api/admin/backup/test-s3.post.ts')
const TEST_WEBDAV = read('../../server/api/admin/backup/test-webdav.post.ts')

test('链路本地/组播/保留段被绝对禁止', () => {
  for (const address of [
    '169.254.169.254',
    '169.254.170.2',
    'fe80::1',
    '224.0.0.1',
    '0.0.0.0',
    '::',
    '192.0.0.192',
    '198.18.0.1',
    '2001:db8::1',
    '::ffff:169.254.169.254',
    'garbage-not-an-ip'
  ]) {
    assert.equal(unacceptableAddress(address), true, address)
  }
})

test('公网与内网备份目标不被绝对段误伤', () => {
  for (const address of [
    '8.8.8.8',
    '192.168.1.10',
    '10.0.0.5',
    '127.0.0.1',
    'fd00::1234',
    '100.100.100.200'
  ]) {
    assert.equal(unacceptableAddress(address), false, address)
  }
})

test('域名解析结果参与复核，字面黑名单仍在解析之前', () => {
  assert.match(OUTBOUND_URL, /export async function assertSafeOutboundUrl/)
  const literalChecks = OUTBOUND_URL.match(/const host = url\.hostname[\s\S]*?isIP\(host\)/)?.[0] ?? ''
  assert.ok(literalChecks, '未找到解析前的字面检查段')
  assert.match(literalChecks, /BLOCKED_METADATA_HOSTS\.has\(host\)/)
  assert.match(literalChecks, /BLOCKED_DOMAIN_SUFFIXES\.some/)
  // 字面 IP 与解析出的地址走同一套复核，域名不再能绕过黑名单
  assert.match(OUTBOUND_URL, /assertResolvedOutboundAddresses\(\[host\], field\)/)
  assert.match(OUTBOUND_URL, /assertResolvedOutboundAddresses\(\s*resolved\.map/)
  assert.match(OUTBOUND_URL, /lookup\(host, \{ all: true, verbatim: true \}\)/)
})

test('DNS 解析失败维持放行，不阻断先存配置后上线的部署', () => {
  const branch = OUTBOUND_URL.match(/catch \(error: any\) \{[\s\S]*?\n {2}\}/)?.[0] ?? ''
  assert.ok(branch, '未找到解析失败分支')
  assert.match(branch, /return/)
  assert.match(branch, /console\.warn/)
})

test('地址复核同时覆盖私网开关', () => {
  const block = OUTBOUND_URL.match(/export function assertResolvedOutboundAddresses\([\s\S]*?\n\}/)?.[0] ?? ''
  assert.ok(block, '未找到地址复核函数')
  assert.match(block, /BLOCKED_METADATA_HOSTS\.has\(normalized\) \|\| unacceptableAddress\(normalized\)/)
  assert.match(block, /blockPrivateNetwork\(\) && !publicAddress\(normalized\)/)
})

test('全部调用点等待异步校验', () => {
  assert.match(AUTO_CONFIG_PUT, /await assertSafeOutboundUrl\(config\.methods\?\.s3\?\.endpoint/)
  assert.match(AUTO_CONFIG_PUT, /await assertSafeOutboundUrl\(config\.methods\?\.webdav\?\.url/)
  assert.match(TEST_S3, /await assertSafeOutboundUrl\(endpoint/)
  assert.match(TEST_WEBDAV, /await assertSafeOutboundUrl\(url/)
  for (const source of [AUTO_CONFIG_PUT, TEST_S3, TEST_WEBDAV]) {
    assert.doesNotMatch(source, /^\s*assertSafeOutboundUrl\(/m, '存在未 await 的调用')
  }
})
