import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 工具通过 `~~/` 别名引用服务端常量，纯 Node 无法解析该别名，
 * 这里先用 esbuild 打包再加载，顺带覆盖别名解析。
 */
const utilSource = fileURLToPath(new URL('../../server/utils/neteaseRealIp.ts', import.meta.url))

const compiled = await build({
  entryPoints: [utilSource],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  alias: {
    '~~/server/config/constants': fileURLToPath(
      new URL('../../server/config/constants.ts', import.meta.url)
    )
  }
})

const { isChinaIp, isNeteaseRealIpEnabled, pickChinaIp, resolveNeteaseRealIp } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`
)

test('随机 IP 落在中国大陆网段池内且为合法 IPv4', () => {
  for (let i = 0; i < 200; i += 1) {
    const ip = pickChinaIp()
    assert.match(ip, /^\d{1,3}(\.\d{1,3}){3}$/)
    assert.ok(isChinaIp(ip), `${ip} 不在中国大陆网段池内`)
  }
})

test('同一扫码 key 恒定得到同一 IP', () => {
  const first = pickChinaIp('qr:abcdef123456')
  const second = pickChinaIp('qr:abcdef123456')
  assert.equal(first, second)
})

test('不同扫码 key 会分散到不同 IP', () => {
  const ips = new Set(Array.from({ length: 50 }, (_, i) => pickChinaIp(`qr:key-${i}`)))
  assert.ok(ips.size > 10, `仅生成 ${ips.size} 个不同 IP，随机性不足`)
})

test('不带种子时会随机分散', () => {
  const ips = new Set(Array.from({ length: 50 }, () => pickChinaIp()))
  assert.ok(ips.size > 10, `仅生成 ${ips.size} 个不同 IP`)
})

test('随机结果避开网段内的 .0 与 .255 广播地址', () => {
  for (let i = 0; i < 200; i += 1) {
    const lastOctet = Number(pickChinaIp(`seed-${i}`).split('.')[3])
    assert.notEqual(lastOctet, 0)
    assert.notEqual(lastOctet, 255)
  }
})

test('不包含腾讯云等 IDC 网段，避免被识别为机房 IP', () => {
  assert.equal(isChinaIp('129.204.10.10'), false)
  assert.equal(isChinaIp('119.29.10.10'), false)
  assert.equal(isChinaIp('157.255.10.10'), false)
})

test('NETEASE_REAL_IP 可指定固定出口，非法值则回退随机池', () => {
  const original = process.env.NETEASE_REAL_IP
  try {
    process.env.NETEASE_REAL_IP = '119.145.10.20'
    assert.equal(resolveNeteaseRealIp('qr:any'), '119.145.10.20')

    process.env.NETEASE_REAL_IP = 'not-an-ip'
    assert.ok(isChinaIp(resolveNeteaseRealIp('qr:any')))
  } finally {
    if (original === undefined) delete process.env.NETEASE_REAL_IP
    else process.env.NETEASE_REAL_IP = original
  }
})

test('NETEASE_REAL_IP_MODE=off 时可整体关停', () => {
  const original = process.env.NETEASE_REAL_IP_MODE
  try {
    process.env.NETEASE_REAL_IP_MODE = 'off'
    assert.equal(isNeteaseRealIpEnabled(), false)
    process.env.NETEASE_REAL_IP_MODE = 'gd'
    assert.equal(isNeteaseRealIpEnabled(), true)
  } finally {
    if (original === undefined) delete process.env.NETEASE_REAL_IP_MODE
    else process.env.NETEASE_REAL_IP_MODE = original
  }
})
