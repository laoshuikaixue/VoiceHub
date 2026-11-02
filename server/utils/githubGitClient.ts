import { fetchSafeOutbound } from '~~/server/utils/outbound-url'
import { DEFAULT_GIT_API_MODE, GIT_API_MODES, type GitApiMode } from '~~/server/config/constants'

/** Git 请求超时（毫秒） */
const GIT_TIMEOUT = 120_000

/** 目标仓库；apiBase 为站点 API 根地址（GitHub 为 https://api.github.com，GHES 为 https://host/api/v3，Gitea 为 https://host/api/v1） */
export interface GitRepoTarget {
  apiBase: string
  repo: string
  branch: string
  token: string
  apiMode?: GitApiMode
}

/** 未知或缺失的模式一律回退 GitHub 口径，避免脏配置改变写路径 */
export function normalizeGitApiMode(mode: unknown): GitApiMode {
  return GIT_API_MODES.includes(mode as GitApiMode) ? mode as GitApiMode : DEFAULT_GIT_API_MODE
}

const NAME_SEGMENT = /^[A-Za-z0-9._-]+$/
const BRANCH_SEGMENT = /^[A-Za-z0-9._/-]+$/

/** 解析仓库标识，接受 owner/repo、owner/repo.git 或仓库网页地址 */
export function parseGitRepo(repo: string): { owner: string; name: string } {
  let value = (repo || '').trim().replace(/\.git$/, '')
  if (value.includes('://')) {
    try {
      value = new URL(value).pathname
    } catch {
      throw new Error('仓库地址不合法')
    }
  }
  const segments = value.split('/').map((segment) => segment.trim()).filter(Boolean)
  if (segments.length !== 2) throw new Error('仓库需写成 owner/repo 或完整仓库地址')
  const [owner, name] = segments
  if (!NAME_SEGMENT.test(owner) || !NAME_SEGMENT.test(name)) {
    throw new Error('仓库 owner 与名称仅支持字母、数字、点、下划线和短横线')
  }
  return { owner, name }
}

/** 拼接仓库内文件路径，拒绝上跳目录与非法字符 */
export function buildRepoFilePath(dir: string, filename: string): string {
  const segments = [...(dir || '').split('/'), ...(filename || '').split('/')]
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (!segments.length) throw new Error('未配置仓库目录')
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('仓库目录不得包含 . 或 ..')
  }
  for (const segment of segments) {
    if (!NAME_SEGMENT.test(segment)) {
      throw new Error('仓库目录仅支持字母、数字、点、下划线和短横线')
    }
  }
  return segments.join('/')
}

/** 状态码对应的可操作提示，避免用户拿到裸 HTTP 码无从下手 */
const STATUS_HINTS: Record<number, string> = {
  401: '访问令牌无效',
  403: '令牌权限不足或触发速率限制',
  404: '仓库或分支不存在',
  409: '分支已被其他提交更新，请重试',
  422: '提交内容校验失败'
}

function describeFailure(text: string, status: number): string {
  let message = ''
  try {
    message = String((JSON.parse(text) as { message?: unknown }).message || '').slice(0, 200)
  } catch { /* 非 JSON 响应体不透出 */ }
  return [STATUS_HINTS[status], message].filter(Boolean).join('：')
}

async function requestGitApi<T = any>(
  target: GitRepoTarget,
  method: string,
  path: string,
  payload?: unknown
): Promise<T> {
  const base = (target.apiBase || '').trim().replace(/\/+$/, '')
  if (!base) throw new Error('未配置 Git API 地址')
  if (!target.token) throw new Error('未配置访问令牌')

  const body = payload === undefined ? undefined : JSON.stringify(payload)
  let response: Awaited<ReturnType<typeof fetchSafeOutbound>>
  try {
    response = await fetchSafeOutbound(`${base}${path}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${target.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body,
      signal: AbortSignal.timeout(GIT_TIMEOUT)
    })
  } catch (error: any) {
    // SSRF 拦截等带状态码的错误原样抛出，保留本地化错误码
    if (error?.status || error?.statusCode) throw error
    throw new Error(`无法连接 Git 仓库 API：${error?.message || '请求失败'}`, { cause: error })
  }

  const text = await response.text().catch(() => '')
  if (!response.ok) {
    const detail = describeFailure(text, response.status)
    const error = new Error(
      `Git ${method} ${path} 失败 (${response.status})${detail ? `：${detail}` : ''}`
    ) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return (text ? JSON.parse(text) : {}) as T
}

/** 仓库路径前缀 */
function repoPathOf(target: GitRepoTarget): string {
  const { owner, name } = parseGitRepo(target.repo)
  return `/repos/${owner}/${name}`
}

/** 读取仓库信息并确定目标分支；empty 表示仓库尚无任何提交 */
async function inspectRepo(target: GitRepoTarget): Promise<{ repoPath: string; branch: string; empty: boolean; apiMode: GitApiMode; repo: any }> {
  const repoPath = repoPathOf(target)
  const repo = await requestGitApi(target, 'GET', repoPath)
  const branch = (target.branch || '').trim() || String((repo as { default_branch?: unknown }).default_branch || '')
  if (!branch) throw new Error('未配置分支且仓库无默认分支')
  if (!BRANCH_SEGMENT.test(branch) || branch.includes('..')) {
    throw new Error('分支名仅支持字母、数字、点、斜杠、下划线和短横线')
  }
  return { repoPath, branch, empty: (repo as { size?: number }).size === 0, apiMode: normalizeGitApiMode(target.apiMode), repo }
}

/**
 * Gitea 口径写入：PUT /repos/{o}/{r}/contents/{path} 单文件提交（正文 base64）。
 * 文件名为时间戳唯一，按新建处理；分支不存在时由站点报错，不做静默建分支。
 */
async function commitBackupFileViaContents(
  target: GitRepoTarget,
  repoPath: string,
  branch: string,
  filePath: string,
  content: string,
  message: string
): Promise<void> {
  const pathInUrl = filePath.split('/').map(encodeURIComponent).join('/')
  const result = await requestGitApi(target, 'PUT', `${repoPath}/contents/${pathInUrl}`, {
    message,
    branch,
    content: Buffer.from(content, 'utf8').toString('base64')
  })
  if (!result?.commit?.sha && !result?.content?.sha) throw new Error('未获取到站点返回的提交')
}

/**
 * 提交单个文件到目标分支。
 * github 模式走 Git Data API（文件正文写入 tree 条目，需站点实现写侧端点，GitHub / GHES 支持）；
 * gitea 模式未实现 Git Data API 写端点，改走 Contents API。
 */
export async function commitBackupFile(
  target: GitRepoTarget,
  filePath: string,
  content: string,
  message: string
): Promise<void> {
  const { repoPath, branch, empty, apiMode } = await inspectRepo(target)

  if (apiMode === 'gitea') {
    await commitBackupFileViaContents(target, repoPath, branch, filePath, content, message)
    return
  }

  let headSha = ''
  try {
    const ref = await requestGitApi(target, 'GET', `${repoPath}/git/ref/heads/${branch}`)
    headSha = String(ref?.object?.sha || '')
  } catch (error: any) {
    // 仅空仓库允许以 404 建分支，分支名写错不得静默新建分支
    if (error.status !== 404 || !empty) throw error
  }

  let baseTree = ''
  if (headSha) {
    const headCommit = await requestGitApi(target, 'GET', `${repoPath}/git/commits/${headSha}`)
    baseTree = String(headCommit?.tree?.sha || '')
    if (!baseTree) throw new Error('未读取到分支最新树对象')
  }

  const tree = await requestGitApi(target, 'POST', `${repoPath}/git/trees`, {
    ...(baseTree ? { base_tree: baseTree } : {}),
    tree: [{ path: filePath, mode: '100644', type: 'blob', content }]
  })
  if (!tree?.sha) throw new Error('未获取到新树对象')

  const commit = await requestGitApi(target, 'POST', `${repoPath}/git/commits`, {
    message,
    tree: tree.sha,
    parents: headSha ? [headSha] : []
  })
  if (!commit?.sha) throw new Error('未获取到新提交')

  if (headSha) {
    // force=false 保证分支被并发推进时报错而不是覆盖他人提交
    await requestGitApi(target, 'PATCH', `${repoPath}/git/refs/heads/${branch}`, {
      sha: commit.sha,
      force: false
    })
  } else {
    await requestGitApi(target, 'POST', `${repoPath}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha
    })
  }
}

/** 校验地址、令牌、仓库与分支，并确认令牌具备写权限 */
export async function checkGitRepoAccess(target: GitRepoTarget): Promise<void> {
  const { repoPath, branch, empty, apiMode, repo } = await inspectRepo(target)

  if (apiMode === 'gitea') {
    // Gitea 没有游离 tree 之类的只读写探测端点：分支用列提交确认，写权限按站点返回的 push 许可判定
    if (!empty) {
      const query = new URLSearchParams({ sha: branch, limit: '1' })
      await requestGitApi(target, 'GET', `${repoPath}/commits?${query.toString()}`)
    }
    if ((repo as { permissions?: Record<string, boolean> })?.permissions?.push === false) {
      throw new Error('令牌没有该仓库的推送权限')
    }
    return
  }

  try {
    await requestGitApi(target, 'GET', `${repoPath}/git/ref/heads/${branch}`)
  } catch (error: any) {
    if (error.status !== 404 || !empty) throw error
  }
  // 写入探测：创建一个不挂任何提交的游离 tree 对象，只验证写权限，不改动分支与历史
  await requestGitApi(target, 'POST', `${repoPath}/git/trees`, {
    tree: [{ path: '.voicehub-write-probe', mode: '100644', type: 'blob', content: 'VoiceHub connection test' }]
  })
}

/** 仓库内的单个备份提交 */
export interface GitBackupEntry {
  filename: string
  commitSha: string
  /** UTC ISO 字符串 */
  committedAt: string
  author: string
  /** 分支最新树中的字节数；null 表示文件已不在最新提交里 */
  size: number | null
}

export interface GitBackupHistory {
  branch: string
  scannedCommits: number
  entries: GitBackupEntry[]
}

const BACKUP_COMMIT_MESSAGE = /^VoiceHub 自动备份 (.+\.json)$/

/** 去掉首尾斜杠、空段与上跳段，得到仓库内目录前缀 */
function normalizeRepoDir(dir: string): string {
  return (dir || '').split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/')
}

/** GitHub 的 commit.tree 是对象，Gitea 的是树 SHA 字符串 */
function headTreeOf(item: any): string {
  const tree = item?.commit?.tree
  return typeof tree === 'string' ? tree : String(tree?.sha || '')
}

/** 读取分支上的备份提交列表，全程只发 GET 请求 */
export async function listBackupCommits(
  target: GitRepoTarget,
  dir: string,
  limit = 30
): Promise<GitBackupHistory> {
  const { repoPath, branch, empty, apiMode } = await inspectRepo(target)
  if (empty) return { branch, scannedCommits: 0, entries: [] }

  const pageSize = Math.min(100, Math.max(1, Math.trunc(limit) || 1))
  const dirPath = normalizeRepoDir(dir)
  // GitHub 用 per_page / recursive=1，Gitea 用 limit / recursive=true；Gitea 带 path 过滤时会忽略 limit
  const sizeParam = apiMode === 'gitea' ? 'limit' : 'per_page'
  const query = new URLSearchParams({ sha: branch, [sizeParam]: String(pageSize) })
  if (dirPath) query.set('path', dirPath)
  if (apiMode === 'gitea') {
    // Gitea 默认返回每条提交的 diff 统计与受影响文件，响应体易超出出站 1 MB 上限
    query.set('stat', 'false')
    query.set('verification', 'false')
    query.set('files', 'false')
  }
  const commits = await requestGitApi(target, 'GET', `${repoPath}/commits?${query.toString()}`)
  const list = Array.isArray(commits) ? commits : []
  if (!list.length) return { branch, scannedCommits: 0, entries: [] }

  // 用最新树补齐文件大小
  const sizeByPath = new Map<string, number>()
  const sizeByBaseName = new Map<string, number>()
  const headTree = headTreeOf(list[0])
  if (headTree) {
    const recursive = apiMode === 'gitea' ? 'true' : '1'
    const tree = await requestGitApi(target, 'GET', `${repoPath}/git/trees/${headTree}?recursive=${recursive}`)
    for (const item of (Array.isArray(tree?.tree) ? tree.tree : [])) {
      if (item?.type !== 'blob' || typeof item.size !== 'number') continue
      const path = String(item.path || '')
      sizeByPath.set(path, item.size)
      const baseName = path.split('/').pop() || path
      if (!sizeByBaseName.has(baseName)) sizeByBaseName.set(baseName, item.size)
    }
  }

  const entries: GitBackupEntry[] = []
  for (const item of list) {
    const message = String(item?.commit?.message || '').split('\n')[0].trim()
    const matched = BACKUP_COMMIT_MESSAGE.exec(message)
    if (!matched) continue
    const filename = matched[1]
    const fullPath = dirPath ? `${dirPath}/${filename}` : filename
    entries.push({
      filename,
      commitSha: String(item?.sha || ''),
      committedAt: String(item?.commit?.author?.date || ''),
      author: String(item?.commit?.author?.name || ''),
      size: sizeByPath.get(fullPath) ?? sizeByBaseName.get(filename) ?? null
    })
  }
  return { branch, scannedCommits: list.length, entries }
}
