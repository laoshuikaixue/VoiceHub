import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import test from 'node:test'
import { z } from 'zod'
import { publicAddress, unacceptableAddress } from '../../server/utils/music-source-plugins/network.ts'
import { isSafeBackupFilename } from '../../server/utils/backup-filename.ts'

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
  fetchSafeOutbound: outbound.fetchSafeOutbound,
  GIT_API_MODES: ['github', 'gitea'],
  DEFAULT_GIT_API_MODE: 'github'
}, 'parseGitRepo, buildRepoFilePath, commitBackupFile, checkGitRepoAccess, listBackupCommits, normalizeGitApiMode, fetchRepoFileContent, buildBackupCommitMessage, parseBackupCommitFilename, isValidCommitSha, GIT_BACKUP_COMMIT_PREFIX')

/** 编译以 export default defineEventHandler 写法实现的接口，返回事件处理函数 */
const endpoint = (file: string, globals: Record<string, unknown>) => {
  const code = stripTypeScriptTypes(read(file))
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?$/gm, '')
    .replace('export default defineEventHandler', 'return defineEventHandler')
  return new Function(...Object.keys(globals), code)(...Object.values(globals))
}

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
async function mockGit(t, { headSha = '', treeSha = 'head-tree', empty = false, commits = [], blobs = [], push = true, files = {}, patchStatus = 0, treeStatus = 0 } = {}) {
  const requests = []
  const ref = { sha: headSha }
  const base = await listen(t, async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()
    if (req.url) requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, accept: req.headers.accept, body: body ? JSON.parse(body) : null })

    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }
    const raw = (content) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(content)
    }
    if (req.method === 'GET' && /^\/api\/repos\/[^/]+\/[^/]+$/.test(req.url)) {
      return json(200, { default_branch: 'main', size: empty ? 0 : 12, permissions: { admin: push, push, pull: true } })
    }
    // Contents API 写文件（Gitea 唯一可用的写入端点）
    if (req.method === 'PUT' && /\/api\/repos\/[^/]+\/[^/]+\/contents\//.test(req.url)) {
      return json(200, { content: { sha: 'blob-sha', path: decodeURIComponent(req.url.split('/contents/')[1]) }, commit: { sha: 'contents-commit' } })
    }
    // 备份文件正文：GitHub 走 contents + raw 媒体类型，Gitea 走 raw 下载端点
    if (req.method === 'GET' && /\/api\/repos\/[^/]+\/[^/]+\/(contents|raw)\//.test(req.url)) {
      const key = decodeURIComponent(req.url.split(/\/(?:contents|raw)\//)[1].split('?')[0])
      return files[key] === undefined ? json(404, { message: 'Not Found' }) : raw(files[key])
    }
    // 提交列表（历史读取）
    if (req.method === 'GET' && /\/api\/repos\/[^/]+\/[^/]+\/commits\?/.test(req.url)) {
      return json(200, commits)
    }
    // 树对象列举（补齐文件大小）
    if (req.method === 'GET' && req.url.includes('/git/trees/')) {
      return treeStatus ? json(treeStatus, { message: 'Tree unavailable' }) : json(200, { tree: blobs })
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
      if (patchStatus) return json(patchStatus, { message: 'Update is not a fast forward' })
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

test('API 地址无法连接时给出中文说明', async () => {
  await assert.rejects(
    gitClient.listBackupCommits(target('http://127.0.0.1:1'), 'voicehub-backups/', 30),
    /无法连接 Git 仓库 API/
  )
})

test('缺少 API 地址或令牌时拒绝发起请求', async () => {
  await assert.rejects(gitClient.commitBackupFile({ apiBase: '', repo: 'a/b', branch: 'main', token: 't' }, 'a.json', '{}', 'm'), /未配置 Git API 地址/)
  await assert.rejects(gitClient.commitBackupFile({ apiBase: 'https://api.github.com', repo: 'a/b', branch: 'main', token: '' }, 'a.json', '{}', 'm'), /未配置访问令牌/)
})

const backupCommit = (sha: string, filename: string, date = '2026-11-02T10:00:00Z') => ({
  sha,
  commit: {
    message: gitClient.buildBackupCommitMessage(filename),
    author: { name: 'voicehub-bot', date },
    tree: { sha: `${sha}-tree` }
  }
})

test('历史读取按提交信息解析备份文件并用最新树补大小，全程只发 GET', async (t) => {
  const { base, requests } = await mockGit(t, {
    headSha: 'newest',
    commits: [
      backupCommit('c3', 'auto-3.json'),
      { sha: 'c2', commit: { message: '手动提交说明', author: { name: 'me', date: 'x' }, tree: { sha: 'c2-tree' } } },
      backupCommit('c1', 'auto-1.json', '2026-11-01T09:00:00Z')
    ],
    blobs: [
      { type: 'blob', path: 'voicehub-backups/auto-3.json', size: 2048 },
      { type: 'blob', path: 'voicehub-backups/README.md', size: 12 },
      { type: 'tree', path: 'voicehub-backups' }
    ]
  })
  const history = await gitClient.listBackupCommits(target(base), 'voicehub-backups/', 30)

  assert.equal(history.branch, 'main')
  assert.equal(history.scannedCommits, 3)
  assert.deepEqual(history.entries, [
    { filename: 'auto-3.json', commitSha: 'c3', committedAt: '2026-11-02T10:00:00Z', author: 'voicehub-bot', size: 2048 },
    // 已被后续提交删除的文件仍留在历史里，大小给 null
    { filename: 'auto-1.json', commitSha: 'c1', committedAt: '2026-11-01T09:00:00Z', author: 'voicehub-bot', size: null }
  ])
  assert.deepEqual(requests.map((r) => r.method), ['GET', 'GET', 'GET'])
  assert.deepEqual(requests.map((r) => r.url), [
    '/api/repos/voicehub/backups',
    '/api/repos/voicehub/backups/commits?sha=main&per_page=30&path=voicehub-backups',
    '/api/repos/voicehub/backups/git/trees/c3-tree?recursive=1'
  ])
  assert.equal(requests[0].auth, 'Bearer pat-1')
})

test('空仓库历史为空且不再发起后续请求', async (t) => {
  const { base, requests } = await mockGit(t, { empty: true })
  const history = await gitClient.listBackupCommits(target(base), 'voicehub-backups/', 30)
  assert.deepEqual(history, { branch: 'main', scannedCommits: 0, entries: [] })
  assert.deepEqual(requests.map((r) => r.url), ['/api/repos/voicehub/backups'])
})

test('分支与目录参与查询，条数上限夹到 1..100', async (t) => {
  const wide = await mockGit(t, { commits: [backupCommit('c1', 'auto-1.json')] })
  await gitClient.listBackupCommits(target(wide.base, { branch: 'release/backup' }), '', 500)
  assert.equal(wide.requests[1].url, '/api/repos/voicehub/backups/commits?sha=release%2Fbackup&per_page=100')
  // 目录留空则不带 path，直接读仓库根
  assert.equal(wide.requests.length, 3)

  const zero = await mockGit(t, { commits: [backupCommit('c1', 'auto-1.json')] })
  await gitClient.listBackupCommits(target(zero.base, { branch: '' }), 'voicehub-backups/', 0)
  assert.equal(zero.requests[1].url, '/api/repos/voicehub/backups/commits?sha=main&per_page=1&path=voicehub-backups')
})

test('令牌缺少读权限时报告原因，不返回空列表', async (t) => {
  const forbidden = await listen(t, (_req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Resource not accessible by integration' }))
  })
  await assert.rejects(
    gitClient.listBackupCommits(target(`${forbidden}/api`), 'voicehub-backups/', 30),
    /403.*令牌权限不足或触发速率限制/
  )
})

test('Gitea 模式写入只发一次 Contents PUT，正文 base64 且带分支', async (t) => {
  const { base, requests } = await mockGit(t)
  await gitClient.commitBackupFile(target(base, { apiMode: 'gitea' }), 'voicehub-backups/auto.json', '{"data":1}', 'VoiceHub 自动备份 auto.json')

  assert.deepEqual(requests.map((r) => `${r.method} ${r.url}`), [
    'GET /api/repos/voicehub/backups',
    'PUT /api/repos/voicehub/backups/contents/voicehub-backups/auto.json'
  ])
  const put = requests[1].body
  assert.equal(put.branch, 'main')
  assert.equal(put.message, 'VoiceHub 自动备份 auto.json')
  assert.equal(Buffer.from(put.content, 'base64').toString('utf8'), '{"data":1}')
})

test('Gitea 连接测试用列提交探分支，不做游离 tree 探测', async (t) => {
  const { base, requests } = await mockGit(t, { headSha: 'old-commit' })
  await gitClient.checkGitRepoAccess(target(base, { apiMode: 'gitea' }))
  assert.deepEqual(requests.map((r) => `${r.method} ${r.url}`), [
    'GET /api/repos/voicehub/backups',
    'GET /api/repos/voicehub/backups/commits?sha=main&limit=1'
  ])
})

test('Gitea 令牌无推送权限时报错，不误报连接成功', async (t) => {
  const { base } = await mockGit(t, { headSha: 'old-commit', push: false })
  await assert.rejects(
    gitClient.checkGitRepoAccess(target(base, { apiMode: 'gitea' })),
    /令牌没有该仓库的推送权限/
  )
})

test('历史读取按模式切换分页与递归参数，并兼容 tree 为字符串', async (t) => {
  const giteaCommits = [{
    sha: 'g1',
    commit: {
      message: 'VoiceHub 自动备份 auto-9.json',
      author: { name: 'bot', date: '2026-11-02T10:00:00Z' },
      tree: 'plain-tree'
    }
  }]
  const gitea = await mockGit(t, {
    commits: giteaCommits,
    blobs: [{ type: 'blob', path: 'voicehub-backups/auto-9.json', size: 4096 }]
  })
  const history = await gitClient.listBackupCommits(target(gitea.base, { apiMode: 'gitea' }), 'voicehub-backups/', 30)
  assert.deepEqual(gitea.requests.map((r) => r.url), [
    '/api/repos/voicehub/backups',
    '/api/repos/voicehub/backups/commits?sha=main&limit=30&path=voicehub-backups&stat=false&verification=false&files=false',
    '/api/repos/voicehub/backups/git/trees/plain-tree?recursive=true'
  ])
  assert.deepEqual(history.entries, [{
    filename: 'auto-9.json',
    commitSha: 'g1',
    committedAt: '2026-11-02T10:00:00Z',
    author: 'bot',
    size: 4096
  }])

  // GitHub 口径仍用 per_page 与 recursive=1
  const github = await mockGit(t, { commits: giteaCommits, blobs: [{ type: 'blob', path: 'voicehub-backups/auto-9.json', size: 4096 }] })
  await gitClient.listBackupCommits(target(github.base), 'voicehub-backups/', 30)
  assert.equal(github.requests[1].url, '/api/repos/voicehub/backups/commits?sha=main&per_page=30&path=voicehub-backups')
  assert.equal(github.requests[2].url, '/api/repos/voicehub/backups/git/trees/plain-tree?recursive=1')
})

test('未知 apiMode 回退 GitHub 口径，不改走 Contents API', async () => {
  assert.equal(gitClient.normalizeGitApiMode('gitea'), 'gitea')
  assert.equal(gitClient.normalizeGitApiMode('Gitea'), 'github')
  assert.equal(gitClient.normalizeGitApiMode(undefined), 'github')
})

test('GitHub 口径按 contents raw 媒体类型读取备份正文', async (t) => {
  const repo = await mockGit(t, { files: { 'voicehub-backups/auto-backup-1.json': '{"metadata":{},"data":{}}' } })
  const text = await gitClient.fetchRepoFileContent(target(repo.base), 'voicehub-backups/', 'auto-backup-1.json')
  assert.equal(text, '{"metadata":{},"data":{}}')
  assert.deepEqual(repo.requests.map((r) => r.url), [
    '/api/repos/voicehub/backups',
    '/api/repos/voicehub/backups/contents/voicehub-backups/auto-backup-1.json?ref=main'
  ])
  assert.match(repo.requests[1].accept, /vnd\.github\.raw/)
})

test('Gitea 口径走 raw 下载端点读取备份正文', async (t) => {
  const repo = await mockGit(t, { files: { 'voicehub-backups/auto-backup-2.json': '{"data":2}' } })
  const text = await gitClient.fetchRepoFileContent(target(repo.base, { apiMode: 'gitea' }), 'voicehub-backups/', 'auto-backup-2.json')
  assert.equal(text, '{"data":2}')
  assert.deepEqual(repo.requests.map((r) => r.url), [
    '/api/repos/voicehub/backups',
    '/api/repos/voicehub/backups/raw/voicehub-backups/auto-backup-2.json?ref=main'
  ])
  assert.equal(repo.requests[1].accept, 'text/plain')
})

test('目录上跳被拒，仓库缺文件按 404 报错', async (t) => {
  const repo = await mockGit(t, { files: {} })
  await assert.rejects(
    () => gitClient.fetchRepoFileContent(target(repo.base), 'voicehub-backups/', 'missing.json'),
    /失败 \(404\)/
  )
  await assert.rejects(
    () => gitClient.fetchRepoFileContent(target(repo.base), '../etc', 'passwd.json'),
    /\.\./
  )
})

test('备份正文读取显式放宽响应上限，其余请求维持 1 MB', async (t) => {
  const seen = []
  const spyClient = compile(read('server/utils/githubGitClient.ts'), {
    GIT_API_MODES: ['github', 'gitea'],
    DEFAULT_GIT_API_MODE: 'github',
    fetchSafeOutbound: async (url, options) => {
      seen.push({ url, maxBytes: options.maxBytes, accept: options.headers.Accept })
      return { ok: true, status: 200, text: async () => '{"default_branch":"main","size":12}' }
    }
  }, 'fetchRepoFileContent, listBackupCommits')
  await spyClient.fetchRepoFileContent(target('http://127.0.0.1:1'), 'voicehub-backups/', 'auto-backup-1.json')
  assert.equal(seen[0].maxBytes, undefined, '仓库信息读取不应放宽上限')
  assert.ok(seen[1].maxBytes > 1024 * 1024, '备份正文读取应显式放宽上限')

  const big = 'x'.repeat(1024 * 1024 + 16)
  const base = await listenWithBody(t, big)
  await assert.rejects(() => outbound.fetchSafeOutbound(base, { method: 'GET' }), /超过大小限制/)
  const response = await outbound.fetchSafeOutbound(base, { method: 'GET', maxBytes: 4 * 1024 * 1024 })
  assert.equal((await response.text()).length, big.length)
})

test('备份提交信息由单一常量生成并能被历史解析还原', () => {
  const message = gitClient.buildBackupCommitMessage('auto-backup-1730000000.json')
  assert.equal(message, `${gitClient.GIT_BACKUP_COMMIT_PREFIX} auto-backup-1730000000.json`)
  assert.equal(gitClient.parseBackupCommitFilename(`${message}\n\n由自动备份任务提交`), 'auto-backup-1730000000.json')
  assert.equal(gitClient.parseBackupCommitFilename('手动提交说明'), null)
  assert.equal(gitClient.parseBackupCommitFilename('VoiceHub 自动备份 notes.txt'), null)
})

test('分支被并发推进时 409 报错，不覆盖他人提交', async (t) => {
  const { base, requests, ref } = await mockGit(t, { headSha: 'old-commit', patchStatus: 409 })
  await assert.rejects(
    () => gitClient.commitBackupFile(target(base), 'auto.json', '{}', 'msg'),
    /409.*分支已被其他提交更新/
  )
  assert.equal(ref.sha, 'old-commit')
  assert.equal(requests.some((item) => item.method === 'POST' && item.url.endsWith('/git/refs')), false)
})

test('读取仓库树失败时历史仍可用，文件大小降级为未知', async (t) => {
  const { base, requests } = await mockGit(t, { commits: [backupCommit('c1', 'auto-1.json')], treeStatus: 500 })
  const history = await gitClient.listBackupCommits(target(base), 'voicehub-backups/', 30)
  assert.deepEqual(history.entries, [{
    filename: 'auto-1.json',
    commitSha: 'c1',
    committedAt: '2026-11-02T10:00:00Z',
    author: 'voicehub-bot',
    size: null
  }])
  assert.deepEqual(requests.map((item) => item.method), ['GET', 'GET', 'GET'])
})

test('触发速率限制时给出可定位提示', async (t) => {
  const limited = await listen(t, (_req, res) => {
    res.writeHead(429, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'You have exceeded a secondary rate limit' }))
  })
  await assert.rejects(
    () => gitClient.listBackupCommits(target(`${limited}/api`), 'voicehub-backups/', 30),
    /429.*速率限制/
  )
})

test('按提交号读取历史版本，非法提交号回退分支最新内容', async (t) => {
  const sha = 'ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12'
  const repo = await mockGit(t, { files: { 'voicehub-backups/auto-backup-1.json': '{"v":1}' } })
  await gitClient.fetchRepoFileContent(target(repo.base), 'voicehub-backups/', 'auto-backup-1.json', sha)
  assert.equal(repo.requests[1].url, `/api/repos/voicehub/backups/contents/voicehub-backups/auto-backup-1.json?ref=${sha}`)

  await gitClient.fetchRepoFileContent(target(repo.base), 'voicehub-backups/', 'auto-backup-1.json', 'main OR 1=1')
  assert.equal(repo.requests[3].url, '/api/repos/voicehub/backups/contents/voicehub-backups/auto-backup-1.json?ref=main')

  assert.equal(gitClient.isValidCommitSha('abc1234'), true)
  assert.equal(gitClient.isValidCommitSha('a'.repeat(41)), false)
  assert.equal(gitClient.isValidCommitSha(undefined), false)
  assert.equal(gitClient.isValidCommitSha(['abc1234']), false)
})

const savedGithub = {
  enabled: true,
  apiBase: 'https://git.example.com/api/v1',
  repo: 'voicehub/backups',
  branch: 'main',
  path: 'voicehub-backups/',
  token: 'saved-pat'
}

const loadCredentials = (methods: Record<string, any>) => compile(read('server/utils/backup-test-credentials.ts'), {
  getAutoBackupConfig: async () => ({ methods }),
  createApiError: wrapApiError,
  SERVER_ERROR_CODES: codes
}, 'resolveBackupTestParams').resolveBackupTestParams

test('未提交密钥时复用已存密钥，但要求出站目标与已存配置一致', async () => {
  const resolve = loadCredentials({ github: savedGithub })
  const merged = await resolve('github', { apiBase: 'https://git.example.com/api/v1/', repo: 'voicehub/backups' })
  assert.equal(merged.token, 'saved-pat')
  assert.equal(merged.branch, 'main')
  assert.equal(merged.path, 'voicehub-backups/')

  const error = await resolve('github', { apiBase: 'http://127.0.0.1:8080', repo: 'voicehub/backups' }).catch((item: any) => item)
  assert.equal(error.statusCode, 400)
  assert.equal(error.data.code, 'COMMON_INVALID_PARAMS')
})

test('提交新密钥时允许指定任意目标，不复用已存密钥', async () => {
  const resolve = loadCredentials({ github: savedGithub })
  const params = await resolve('github', { apiBase: 'https://other.example.com/api/v1', repo: 'a/b', token: 'fresh-pat' })
  assert.equal(params.token, 'fresh-pat')
  assert.equal(params.apiBase, 'https://other.example.com/api/v1')
})

test('S3 与 WebDAV 同样拒绝改目标后复用已存密钥', async () => {
  const resolve = loadCredentials({
    s3: { enabled: true, endpoint: 'https://s3.example.com', bucket: 'b', region: 'auto', accessKey: 'ak', secretKey: 'sk' },
    webdav: { enabled: true, url: 'https://dav.example.com/dav', username: 'u', password: 'p', path: 'x' }
  })
  const s3 = await resolve('s3', { endpoint: 'https://s3.example.com', bucket: 'b', accessKey: 'ak' })
  assert.equal(s3.secretKey, 'sk')
  assert.equal(s3.region, 'auto')

  const webdav = await resolve('webdav', { username: 'u' })
  assert.equal(webdav.url, 'https://dav.example.com/dav')
  assert.equal(webdav.password, 'p')

  const error = await resolve('webdav', { url: 'http://127.0.0.1:9' }).catch((item: any) => item)
  assert.equal(error.statusCode, 400)
})

test('test-github 接口在目标被改动时拒绝复用已存令牌，不发起出站请求', async () => {
  const calls: string[] = []
  const handler = endpoint('server/api/admin/backup/test-github.post.ts', {
    defineEventHandler: (fn: any) => fn,
    readBody: async (event: any) => event.body,
    createApiError: wrapApiError,
    SERVER_ERROR_CODES: codes,
    resolveBackupTestParams: loadCredentials({ github: savedGithub }),
    checkGitRepoAccess: async (params: any) => { calls.push(params.apiBase) },
    normalizeGitApiMode: (mode: any) => mode || 'github',
    assertSafeOutboundUrl: async () => {},
    recordAdminAudit: async () => {},
    ADMIN_AUDIT_RESULT: { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE' }
  })

  const error = await handler({ body: { apiBase: 'http://127.0.0.1:9999', repo: 'voicehub/backups' } }).catch((item: any) => item)
  assert.equal(error.statusCode, 400)
  assert.deepEqual(calls, [])

  const ok = await handler({ body: { apiBase: 'https://git.example.com/api/v1', repo: 'voicehub/backups' } })
  assert.equal(ok.success, true)
  assert.deepEqual(calls, ['https://git.example.com/api/v1'])
})

test('github-history 接口失败时抛错误码，不再返回 200 包裹的失败体', async () => {
  const build = (listImpl: any) => endpoint('server/api/admin/backup/github-history.get.ts', {
    defineEventHandler: (fn: any) => fn,
    getQuery: () => ({}),
    createApiError: wrapApiError,
    SERVER_ERROR_CODES: codes,
    getAutoBackupConfig: async () => ({ methods: { github: savedGithub } }),
    assertSafeOutboundUrl: async () => {},
    listBackupCommits: listImpl,
    formatDateTime: () => '2026/11/2 18:00:00',
    parseUtcTimestamp: (value: any) => value
  })

  const failed = await build(async () => { throw Object.assign(new Error('上游拒绝'), { status: 403 }) })({})
    .catch((item: any) => item)
  assert.equal(failed.statusCode, 502)
  assert.equal(failed.data.code, 'COMMON_INSUFFICIENT_PERMISSION')

  const missing = await build(async () => { throw Object.assign(new Error('没有该分支'), { status: 404 }) })({})
    .catch((item: any) => item)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.data.code, 'COMMON_TARGET_NOT_FOUND')

  const ok = await build(async () => ({
    branch: 'main',
    scannedCommits: 1,
    entries: [{ filename: 'auto-backup-1.json', commitSha: 'abcdef1', committedAt: '2026-11-02T10:00:00Z', author: 'bot', size: null }]
  }))({})
  assert.equal(ok.success, true)
  assert.equal(ok.data.entries[0].committedAtBeijing, '2026/11/2 18:00:00')
})

test('github-file 接口拒绝非法提交号，合法提交号透传给读取', async () => {
  const seen: any[][] = []
  const handler = endpoint('server/api/admin/backup/github-file.get.ts', {
    defineEventHandler: (fn: any) => fn,
    getQuery: (event: any) => event.query,
    setHeader: () => {},
    createApiError: wrapApiError,
    SERVER_ERROR_CODES: codes,
    getAutoBackupConfig: async () => ({ methods: { github: savedGithub } }),
    assertSafeOutboundUrl: async () => {},
    fetchRepoFileContent: async (...args: any[]) => { seen.push(args); return '{"data":1}' },
    isValidCommitSha: gitClient.isValidCommitSha,
    isSafeBackupFilename
  })

  const error = await handler({ query: { filename: 'auto-backup-1.json', sha: 'bad sha' } }).catch((item: any) => item)
  assert.equal(error.statusCode, 400)
  assert.deepEqual(seen, [])

  const content = await handler({ query: { filename: 'auto-backup-1.json', sha: 'abcdef1' } })
  assert.equal(content, '{"data":1}')
  assert.equal(seen[0][3], 'abcdef1')

  await handler({ query: { filename: 'auto-backup-1.json' } })
  assert.equal(seen[1][3], '')
})

test('启用 Git 备份但缺 API 地址时保存被拒；令牌留空保留已存值', async () => {
  const build = (existingConfig: string | null) => {
    const writes: any[] = []
    const handler = endpoint('server/api/admin/backup/auto-config.put.ts', {
      defineEventHandler: (fn: any) => fn,
      readBody: async (event: any) => event.body,
      z,
      createApiError: wrapApiError,
      GIT_API_MODES: ['github', 'gitea'],
      SERVER_ERROR_CODES: codes,
      db: {
        select: () => ({ from: () => ({ limit: async () => (existingConfig === null ? [] : [{ id: 1, autoBackupConfig: existingConfig }]) }) }),
        insert: () => ({ values: async (value: any) => { writes.push(value) } }),
        update: () => ({ set: (value: any) => ({ where: async () => { writes.push(value) } }) })
      },
      systemSettings: { id: 'id', autoBackupConfig: 'autoBackupConfig', updatedAt: 'updatedAt' },
      eq: () => null,
      SYSTEM_SETTINGS_DEFAULTS: {},
      assertSafeOutboundUrl: async () => {},
      buildRepoFilePath: gitClient.buildRepoFilePath,
      parseGitRepo: gitClient.parseGitRepo,
      getServerDate: () => new Date('2026-11-03T00:00:00Z'),
      recordAdminAudit: async () => {}
    })
    return { handler, writes }
  }
  const methods = (github: Record<string, any>) => ({
    s3: { enabled: false, endpoint: '', bucket: '', region: '', pathPrefix: '', accessKey: '' },
    webdav: { enabled: false, url: '', username: '', path: '' },
    github,
    telegram: { enabled: false, chatId: '' },
    email: { enabled: false, recipient: '' }
  })

  const missing = build(null)
  const error = await missing.handler({ body: { enabled: true, config: { methods: methods({ enabled: true, apiBase: '', repo: 'voicehub/backups', branch: 'main', path: 'x/' }) } } }).catch((item: any) => item)
  assert.equal(error.statusCode, 400)
  assert.deepEqual(missing.writes, [])

  const stored = JSON.stringify({ methods: { github: savedGithub } })
  const keep = build(stored)
  await keep.handler({
    body: {
      enabled: true,
      config: { methods: methods({ enabled: true, apiBase: 'https://git.example.com/api/v1', repo: 'voicehub/backups', branch: 'main', path: 'x/' }) }
    }
  })
  const saved = JSON.parse(keep.writes[0].autoBackupConfig)
  assert.equal(saved.methods.github.token, 'saved-pat')
})

async function listenWithBody(t, body) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(body)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  })
  const address = server.address()
  return `http://127.0.0.1:${address.port}`
}
