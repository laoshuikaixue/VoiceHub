import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import test from 'node:test'
import { publicAddress, unacceptableAddress } from '../../server/utils/music-source-plugins/network.ts'
import { maskSystemSettingsSecrets, omitMaskedSystemSettingsSecrets } from '../../server/api/admin/system-settings/secretMask.ts'

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
const codes = new Proxy({}, { get: (_target, key) => key })
const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, data: { code } })
const compile = (source: string, globals: Record<string, unknown>, exports: string) => {
  const code = stripTypeScriptTypes(source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?$/gm, ''))
    .replace(/^export \{[^}]+\}\r?$/gm, '').replace(/^export /gm, '')
  return new Function(...Object.keys(globals), `${code}\nreturn { ${exports} }`)(...Object.values(globals))
}
const outbound = (resolve = lookup) => compile(read('server/utils/outbound-url.ts'), {
  isIP, lookup: resolve, http, https, createApiError, SERVER_ERROR_CODES: codes, publicAddress, unacceptableAddress
}, 'fetchSafeOutbound, assertSafeOutboundUrl')

const originalPrivatePolicy = process.env.BACKUP_BLOCK_PRIVATE_NETWORK
test.beforeEach(() => { delete process.env.BACKUP_BLOCK_PRIVATE_NETWORK })
test.afterEach(() => {
  if (originalPrivatePolicy === undefined) delete process.env.BACKUP_BLOCK_PRIVATE_NETWORK
  else process.env.BACKUP_BLOCK_PRIVATE_NETWORK = originalPrivatePolicy
})

async function listen(t, handler) {
  const server = http.createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}

test('备份上传允许内网 NAS，保留请求正文、认证与空响应状态', async (t) => {
  const requests = []
  const base = await listen(t, async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    requests.push({ method: req.method, auth: req.headers.authorization, body: Buffer.concat(chunks).toString() })
    res.writeHead(req.method === 'DELETE' ? 204 : 201)
    res.end()
  })
  const { fetchSafeOutbound } = outbound()
  assert.equal((await fetchSafeOutbound(base + '/backup.json', {
    method: 'PUT', headers: { Authorization: 'Basic test' }, body: '{"backup":true}'
  })).status, 201)
  const deleted = await fetchSafeOutbound(base + '/backup.json', { method: 'DELETE' })
  assert.equal(deleted.status, 204)
  assert.equal(await deleted.text(), '')
  assert.deepEqual(requests[0], { method: 'PUT', auth: 'Basic test', body: '{"backup":true}' })
})

test('备份上传拒绝重定向，不把正文和凭据发往下一跳', async (t) => {
  let targetRequests = 0
  const base = await listen(t, (req, res) => {
    if (req.url === '/target') targetRequests++
    res.writeHead(req.url === '/redirect' ? 307 : 200, { Location: '/target' })
    res.end()
  })
  await assert.rejects(outbound().fetchSafeOutbound(base + '/redirect', {
    method: 'PUT', headers: { Authorization: 'Basic test' }, body: 'backup'
  }), /重定向/)
  assert.equal(targetRequests, 0)
})

test('备份在建连时重新校验 DNS，拦截预检查后的地址变更', async () => {
  let lookups = 0
  const resolve = async () => [{ address: ++lookups === 1 ? '8.8.8.8' : '169.254.169.254', family: 4 }]
  await assert.rejects(outbound(resolve as typeof lookup).fetchSafeOutbound('http://backup.example/file', {
    method: 'PUT', body: 'backup', signal: AbortSignal.timeout(1000)
  }), (error) => error.statusCode === 400)
  assert.equal(lookups, 2)
})

test('备份执行时仍遵守禁止私网配置和元数据地址限制', async () => {
  const { fetchSafeOutbound } = outbound()
  for (const target of ['http://169.254.169.254/x', 'http://100.100.100.200/x', 'http://[::ffff:169.254.169.254]/x']) {
    await assert.rejects(fetchSafeOutbound(target, { method: 'PUT' }), (error) => error.statusCode === 400)
  }
  process.env.BACKUP_BLOCK_PRIVATE_NETWORK = 'true'
  await assert.rejects(fetchSafeOutbound('http://127.0.0.1/x', { method: 'PUT' }), (error) => error.statusCode === 400)
})

test('备份请求限制响应体，并能中止无响应连接', async (t) => {
  const base = await listen(t, (req, res) => {
    if (req.url === '/large') res.end(Buffer.alloc(1024 * 1024 + 1))
  })
  const { fetchSafeOutbound } = outbound()
  await assert.rejects(fetchSafeOutbound(base + '/large', { method: 'PUT' }), /大小限制/)
  await assert.rejects(fetchSafeOutbound(base + '/timeout', { method: 'PUT', signal: AbortSignal.timeout(100) }),
    (error) => error.name === 'AbortError')
})

test('自动备份包含派发流水，设置脱敏覆盖机器人令牌且保留业务配置', async () => {
  const source = read('server/services/autoBackupService.ts')
  const names = source.match(/^import \{\r?\n([\s\S]+?)\} from '~\/drizzle\/schema'/m)![1]
    .split(',').map((name) => name.trim()).filter(Boolean)
  const tables = Object.fromEntries(names.map((name) => [name, name]))
  const data = {
    cardCodes: [{ id: 1, status: 'ASSIGNED', assignedTo: 2 }],
    cardCodeAssignments: [{ id: 3, cardCodeId: 1, userId: 2, status: 'ASSIGNED', assignedByName: '管理员' }],
    systemSettings: [{ id: 1, siteTitle: '测试站点', astrbotToken: 'bot-secret', smtpPassword: 'smtp-secret',
      customOAuthClientSecret: 'oauth-secret', autoBackupConfig: '{"secretKey":"backup-secret"}', customCss: 'body{}' }]
  }
  const { exportBackupData } = compile(source, {
    ...tables,
    db: { select: () => ({ from: async (table) => data[table] || [] }) },
    pluginBackupTables: {}, createApiError, SERVER_ERROR_CODES: codes,
    uploadToS3() {}, fetchSafeOutbound() {}, getServerDate: () => new Date('2026-10-31T12:00:00Z'),
    maskSystemSettingsSecrets, omitMaskedSystemSettingsSecrets,
    desc() {}, eq() {}, lt() {}, sql() {}, enqueueAstrbotGroupEvent() {}
  }, 'exportBackupData')
  const exported = await exportBackupData()
  const backup = JSON.parse(exported.json)
  assert.deepEqual(backup.data.cardCodeAssignments, data.cardCodeAssignments)
  assert.equal(backup.metadata.tables.find((table) => table.name === 'cardCodeAssignments').recordCount, 1)
  assert.equal(backup.metadata.totalRecords, 3)
  assert.equal(backup.data.systemSettings[0].customCss, 'body{}')
  assert.equal(backup.data.systemSettings[0].siteTitle, '测试站点')
  for (const secret of ['bot-secret', 'smtp-secret', 'oauth-secret', 'backup-secret']) {
    assert.ok(!exported.json.includes(secret), secret)
  }
})
