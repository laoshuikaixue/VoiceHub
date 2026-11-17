import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isChinaIp,
  isNeteaseRealIpEnabled,
  pickChinaIp,
  resolveNeteaseRealIp
} from '../../server/utils/neteaseRealIp.ts'

test('随机 IP 落在中国大陆网段池内且为合法 IPv4', () => {
  for (let i = 0; i < 200; i += 1) {
    const ip = pickChinaIp()
    assert.match(ip, /^\d{1,3}(\.\d{1,3}){3}$/)
    assert.ok(isChinaIp(ip), `${ip} 不在中国大陆网段池内`)
  }
})

test('同一 seed 恒定得到同一 IP', () => {
  const first = pickChinaIp('qr:abcdef123456')
  const second = pickChinaIp('qr:abcdef123456')
  assert.equal(first, second)
})

test('不同 seed 会分散到不同 IP', () => {
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

test('网段池覆盖多个省级行政区（华北/华东/华南/华中/西南/西北/东北）', () => {
  // 从各区域代表段中取 IP，均应被识别为池内地址
  for (const ip of [
    '61.135.1.10',  // 华北
    '61.172.1.10',  // 华东
    '113.108.1.10', // 华南
    '61.183.1.10',  // 华中
    '61.139.1.10',  // 西南
    '117.36.1.10',  // 西北
    '124.93.1.10'   // 东北
  ]) {
    assert.equal(isChinaIp(ip), true, `${ip} 应在中国大陆网段池内`)
  }
})

test('不包含云厂商 IDC 网段，避免被识别为机房 IP', () => {
  for (const ip of ['129.204.10.10', '119.29.10.10', '157.255.10.10', '47.96.10.10']) {
    assert.equal(isChinaIp(ip), false, `${ip} 不应在住宅网段池内`)
  }
})

test('NETEASE_REAL_IP 可指定固定出口，非法值则回退随机池', () => {
  const original = process.env.NETEASE_REAL_IP
  try {
    process.env.NETEASE_REAL_IP = '113.108.10.20'
    assert.equal(resolveNeteaseRealIp('qr:any'), '113.108.10.20')

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
    process.env.NETEASE_REAL_IP_MODE = 'cn'
    assert.equal(isNeteaseRealIpEnabled(), true)
  } finally {
    if (original === undefined) delete process.env.NETEASE_REAL_IP_MODE
    else process.env.NETEASE_REAL_IP_MODE = original
  }
})
