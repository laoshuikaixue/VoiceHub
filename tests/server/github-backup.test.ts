import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import test from 'node:test'
import { publicAddress, unacceptableAddress } from '../../server/utils/music-source-plugins/network.ts'

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
const codes = new Proxy({}, { get: (_target, key) => key })
const wrapApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, data: { code } })
const compile = (source: string, globals: Record<string, unknown>, exports: string) => {
  const code = stripTypeScriptTypes(source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?$/gm, ''))
    .replace(/^export \{[^}]+\}\r?$/gm, '').replace(/^export /gm, '')
  return new Function(...Object.keys(globals), `${code}\nreturn { ${exports} }`)(...Object.values(globals))
}
const outbound = compile(read('server/utils/outbound-url.ts'), {
  isIP, lookup, http, https, createApiError: wrapApiError, SERVER_ERROR_CODES: codes, publicAddress, unacceptableAddress
}, 'fetchSafeOutbound, assertSafeOutboundUrl')
const gitClient = compile(read('server/utils/githubGitClient.ts'), {
  fetchSafeOutbound: outbound.fetchSafeOutbound
}, 'parseGitRepo, buildRepoFilePath, commitBackupFile, checkGitRepoAccess')

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

/** 极简 GitHub 兼容 Git Data API 替身，记录请求顺序与请求体 */
async function mockGit(t, { headSha = '', treeSha = 'head-tree', empty = false } = {}) {
  const requests = []
  const ref = { sha: headSha }
  const base = await listen(t, async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()
    if (req.url) requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null })

    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }
    if (req.method === 'GET' && /^\/api\/repos\/[^/]+\/[^/]+$/.test(req.url)) {
      return json(200, { default_branch: 'main', size: empty ? 0 : 12 })
    }
    if (req.method === 'GET' && req.url.includes('/git/ref/heads/')) {
      // 替身仓库仅存在 main 分支
      if (req.url.split('/git/ref/heads/')[1] !== 'main') return json(404, { message: 'Not Found' })
      return ref.sha ? json(200, { object: { sha: ref.sha } }) : json(404, { message: 'Not Found' })
    }
    if (req.method === 'GET' && req.url.includes('/git/commits/')) return json(200, { tree: { sha: treeSha } })
    if (req.method === 'POST' && req.url.endsWith('/git/trees')) return json(201, { sha: 'new-tree' })
    if (req.method === 'POST' && req.url.endsWith('/git/commits')) return json(201, { sha: 'new-commit' })
    if (req.method === 'PATCH' && req.url.includes('/git/refs/heads/')) {
      ref.sha = JSON.parse(body).sha
      return json(200, { ref: req.url.slice('/api'.length) })
    }
    if (req.method === 'POST' && req.url.endsWith('/git/refs')) {
      ref.sha = JSON.parse(body).sha
      return json(201, { ref: JSON.parse(body).ref })
    }
    return json(404, { message: 'Not Found' })
  })
  return { base: `${base}/api`, requests, ref }
}

const target = (base, extra = {}) => ({ apiBase: base, repo: 'voicehub/backups', branch: 'main', token: 'pat-1', ...extra })

test('仓库标识与仓库内路径解析', () => {
  assert.deepEqual(gitClient.parseGitRepo('voicehub/backups'), { owner: 'voicehub', name: 'backups' })
  assert.deepEqual(gitClient.parseGitRepo('https://github.com/voicehub/backups.git'), { owner: 'voicehub', name: 'backups' })
  assert.throws(() => gitClient.parseGitRepo('backups'), /owner\/repo/)
  assert.throws(() => gitClient.parseGitRepo('a/b/c'), /owner\/repo/)
  assert.equal(gitClient.buildRepoFilePath('voicehub-backups/', 'auto-backup-1.json'), 'voicehub-backups/auto-backup-1.json')
  assert.equal(gitClient.buildRepoFilePath('', 'auto-backup-1.json'), 'auto-backup-1.json')
  assert.throws(() => gitClient.buildRepoFilePath('../secret', 'a.json'), /\.\./)
  assert.throws(() => gitClient.buildRepoFilePath('a?b', 'a.json'), /仅支持/)
})

test('已有分支时按 repo→ref→commit→tree→commit→PATCH ref 推进，正文写入 tree', async (t) => {
  const { base, requests, ref } = await mockGit(t, { headSha: 'old-commit' })
  await gitClient.commitBackupFile(target(base), 'voicehub-backups/auto.json', '{"data":1}', 'VoiceHub 自动备份 auto.json')

  assert.deepEqual(requests.map((r) => `${r.method} ${r.url}`), [
    'GET /api/repos/voicehub/backups',
    'GET /api/repos/voicehub/backups/git/ref/heads/main',
    'GET /api/repos/voicehub/backups/git/commits/old-commit',
    'POST /api/repos/voicehub/backups/git/trees',
    'POST /api/repos/voicehub/backups/git/commits',
    'PATCH /api/repos/voicehub/backups/git/refs/heads/main'
  ])
  assert.equal(requests[1].auth, 'Bearer pat-1')
  const tree = requests[3].body
  assert.equal(tree.base_tree, 'head-tree')
  assert.deepEqual(tree.tree, [{ path: 'voicehub-backups/auto.json', mode: '100644', type: 'blob', content: '{"data":1}' }])
  assert.deepEqual(requests[4].body, { message: 'VoiceHub 自动备份 auto.json', tree: 'new-tree', parents: ['old-commit'] })
  // force=false 保证并发推进时报错而非覆盖
  assert.deepEqual(requests[5].body, { sha: 'new-commit', force: false })
  assert.equal(ref.sha, 'new-commit')
})

test('空仓库首个提交用 POST ref 建分支且无父提交', async (t) => {
  const { base, requests, ref } = await mockGit(t, { empty: true })
  await gitClient.commitBackupFile(target(base), 'auto.json', '{}', 'first')

  assert.deepEqual(requests.map((r) => `${r.method} ${r.url}`), [
    'GET /api/repos/voicehub/backups',
    'GET /api/repos/voicehub/backups/git/ref/heads/main',
    'POST /api/repos/voicehub/backups/git/trees',
    'POST /api/repos/voicehub/backups/git/commits',
    'POST /api/repos/voicehub/backups/git/refs'
  ])
  assert.deepEqual(requests[2].body, { tree: [{ path: 'auto.json', mode: '100644', type: 'blob', content: '{}' }] })
  assert.deepEqual(requests[3].body, { message: 'first', tree: 'new-tree', parents: [] })
  assert.deepEqual(requests[4].body, { ref: 'refs/heads/main', sha: 'new-commit' })
  assert.equal(ref.sha, 'new-commit')
})

test('非空仓库分支名写错时报错，不静默新建分支', async (t) => {
  const { base, requests } = await mockGit(t, { headSha: 'old-commit' })
  await assert.rejects(
    gitClient.commitBackupFile(target(base, { branch: 'mian' }), 'auto.json', '{}', 'msg'),
    /404/
  )
  assert.deepEqual(requests.map((r) => r.method), ['GET', 'GET'])
})

test('分支留空回退到仓库默认分支', async (t) => {
  const { base, requests } = await mockGit(t, { headSha: 'old-commit' })
  await gitClient.commitBackupFile(target(base, { branch: '' }), 'auto.json', '{}', 'msg')
  assert.deepEqual(requests.map((r) => r.url).slice(0, 2), [
    '/api/repos/voicehub/backups',
    '/api/repos/voicehub/backups/git/ref/heads/main'
  ])
})

test('令牌无写权限时报告状态码与原因，不静默成功', async (t) => {
  const forbidden = await listen(t, (_req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Resource not accessible by integration' }))
  })
  await assert.rejects(
    gitClient.checkGitRepoAccess(target(`${forbidden}/api`)),
    /403.*令牌权限不足或触发速率限制/
  )
})

test('连接测试校验仓库、分支并探测写权限', async (t) => {
  const { base, requests } = await mockGit(t, { headSha: 'old-commit' })
  await gitClient.checkGitRepoAccess(target(base))
  assert.deepEqual(requests.map((r) => `${r.method} ${r.url}`), [
    'GET /api/repos/voicehub/backups',
    'GET /api/repos/voicehub/backups/git/ref/heads/main',
    'POST /api/repos/voicehub/backups/git/trees'
  ])
  // 探测请求不带 base_tree，产物是游离 tree 对象，不进入分支历史
  assert.equal(requests[2].body.base_tree, undefined)
})

test('缺少 API 地址或令牌时拒绝发起请求', async () => {
  await assert.rejects(gitClient.commitBackupFile({ apiBase: '', repo: 'a/b', branch: 'main', token: 't' }, 'a.json', '{}', 'm'), /未配置 Git API 地址/)
  await assert.rejects(gitClient.commitBackupFile({ apiBase: 'https://api.github.com', repo: 'a/b', branch: 'main', token: '' }, 'a.json', '{}', 'm'), /未配置访问令牌/)
})
