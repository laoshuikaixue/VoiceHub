/**
 * 门禁脚本共享工具。
 *
 * 设计约束（均来自 S0 执行评估与本轮实测）：
 *   1. 调用 eslint 用 spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', ...])
 *      —— spawnSync('pnpm'/'npx') 报 ENOENT，'pnpm.cmd' 报 EINVAL（Node 20+ 对 .cmd 的安全限制）。
 *   2. `pnpm` 在 Windows 上必须经 which() 解析成全路径再 spawn（否则同样 ENOENT）。
 *   3. 所有路径相对「仓库根」解析，不能用 import.meta.url —— 那样在 worktree 下会指到
 *      主仓库的 .git/worktrees/<name>/ 里去。
 *   4. 报告为空一律判失败 —— 干净检出上裸跑 eslint 会因缺 .nuxt/eslint.config.mjs 产出 0 条结果。
 */

import { spawnSync } from 'node:child_process'
import fs, { globSync } from 'node:fs'
import path from 'node:path'

/** 仓库根 = 当前工作目录。所有门禁脚本必须从仓库根执行。 */
export const ROOT = process.cwd()

export function repoPath(...segments) {
  return path.join(ROOT, ...segments)
}

/**
 * 解析命令的真实可执行文件路径。
 * Windows 上 `spawnSync('pnpm')` 会 ENOENT（pnpm 实为 pnpm.cmd，而 Node 20+ 拒绝直接
 * spawn .cmd/.bat；显式写 'pnpm.cmd' 又报 EINVAL）。所以在 PATH 里显式找 .cmd/.exe/.bat。
 * 解析不到时返回原名，由调用方拿到 ENOENT 后报错。
 */
export function which(command) {
  if (process.platform !== 'win32') return command
  const exts = ['.cmd', '.exe', '.bat', '']
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext)
      try {
        if (fs.existsSync(candidate)) return candidate
      } catch {
        // 忽略不可访问的 PATH 项
      }
    }
  }
  return command
}

/** 运行一条命令，返回 { code, stdout, stderr }（不抛异常，由调用方判定）。 */
export function run(command, args, options = {}) {
  const executable = which(command)
  // Windows：.cmd/.bat 无法被 Node 直接 spawn（EINVAL），必须经 cmd.exe 包装。
  // 实测：spawnSync('cmd.exe', ['/d','/s','/c','pnpm --version']) -> 0 / "10.29.3"
  const needsShellWrapper = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable)
  const spawnCommand = needsShellWrapper ? (process.env.ComSpec || 'cmd.exe') : executable
  const spawnArgs = needsShellWrapper
    ? ['/d', '/s', '/c', [executable, ...args].map(quoteForCmd).join(' ')]
    : args

  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    ...options
  })
  const stderr = `${result.stderr || ''}${result.error ? `spawn error: ${result.error.message}` : ''}`
  return {
    code: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr
  }
}

/** cmd.exe 参数引用：仅当含空格或 cmd 元字符时加引号（供上面 .cmd 包装使用）。 */
function quoteForCmd(value) {
  const text = String(value)
  if (text === '') return '""'
  if (!/[\s"&|<>^()]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

/** 通过 node 直接执行一个 JS 入口（避免 shell 与 .cmd 差异）。 */
export function runNode(scriptPath, args = []) {
  return run(process.execPath, [scriptPath, ...args])
}

/** 直调 eslint 的 JS 入口（不要走 pnpm/npx）。 */
export function runEslint(args) {
  return runNode(repoPath('node_modules', 'eslint', 'bin', 'eslint.js'), args)
}

/**
 * 确保 Nuxt 生成物存在（.nuxt/eslint.config.mjs 是 eslint.config.mjs 的第一行 import）。
 *
 * 为什么必须显式准备：`pnpm install` 之后 `.nuxt/eslint.config.mjs` 会消失，
 * 此时任何 eslint 调用都会 ERR_MODULE_NOT_FOUND 并以 exit 2 结束（而不是真实的 lint 结果），
 * ratchet 会把这种情况当成「报告为空」而误判。实测 @nuxt/eslint 只在
 * NODE_ENV=development（或 npm_lifecycle_event 含 lint）时才生成该文件。
 */
export function ensureNuxtPrepare({ quiet = true } = {}) {
  const target = repoPath('.nuxt', 'eslint.config.mjs')
  if (fs.existsSync(target)) return { ok: true, prepared: false }

  const nuxtBin = repoPath('node_modules', 'nuxt', 'bin', 'nuxt.mjs')
  if (!fs.existsSync(nuxtBin)) {
    return { ok: false, prepared: false, error: 'node_modules/nuxt 不存在，请先 pnpm install' }
  }

  const attempts = [{ NODE_ENV: 'development' }, { NODE_ENV: 'development', npm_lifecycle_event: 'lint' }]
  for (const env of attempts) {
    const res = run(process.execPath, [nuxtBin, 'prepare'], {
      env: { ...process.env, ...env }
    })
    if (fs.existsSync(target)) {
      if (!quiet && res.stdout) process.stdout.write(res.stdout)
      return { ok: true, prepared: true }
    }
  }
  return {
    ok: false,
    prepared: false,
    error: `.nuxt/eslint.config.mjs 仍未生成 —— eslint.config.mjs 会 import 失败，无法给出可信 lint 结果`
  }
}

/** 收集测试文件列表。 */
export function collectTestFiles(pattern = 'tests/**/*.test.ts') {
  return globSync(pattern, { cwd: ROOT }).map((p) => String(p).replace(/\\/g, '/')).sort()
}

/** `.github/workflows/` 是否被改动（D23：不得变更主仓库 CI）。 */
export function workflowsDirty() {
  const result = run('git', ['status', '--porcelain', '.github'])
  return result.stdout.trim()
}

export function fail(message) {
  console.error(`✖ ${message}`)
  process.exitCode = 1
}

export function ok(message) {
  console.log(`✔ ${message}`)
}
