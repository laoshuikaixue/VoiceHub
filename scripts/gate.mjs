/**
 * 本地门禁（S0-1）—— 一条命令跑完全部检查。
 *
 * 为什么是本地脚本而不是 CI workflow（D23，用户明确指令）：
 *   不得新增或修改 .github/workflows/ 下任何文件，也不得改变主仓库 CI 行为。
 *   门禁逻辑因此落在本脚本，输出贴进 PR 描述作为证据；主仓库 PR 侧沿用既有 nix.yml。
 *
 * 用法：pnpm gate            （六步全跑）
 *       pnpm gate --no-build （跳过 10 分钟的构建，日常迭代用）
 *       pnpm gate --only=test,contract
 *
 * 六步：install → db:check → lint ratchet → test → contract → build
 */

import { run, runNode, repoPath, collectTestFiles, workflowsDirty, ensureNuxtPrepare, fail, ok } from './lib/gate-utils.mjs'

const args = process.argv.slice(2)
const skipBuild = args.includes('--no-build')
const onlyArg = args.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : null
const TEST_FILE_BASELINE = 26

function elapsed(startedAt) {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`
}

const steps = [
  {
    id: 'install',
    title: 'pnpm install --frozen-lockfile（校验 lockfile 与 package.json 未漂移）',
    run: () => run('pnpm', ['install', '--frozen-lockfile'])
  },
  {
    id: 'db:check',
    title: 'pnpm db:check（drizzle-kit check，无需 DB）',
    run: () => run('pnpm', ['db:check'])
  },
  {
    id: 'lint',
    title: 'lint ratchet（eslint 增量基线）',
    run: () => {
      // pnpm install 之后 .nuxt/eslint.config.mjs 会消失，必须先生成；否则 eslint 以
      // exit 2 + 空报告结束，会被 ratchet 误读成「零新增 error」。
      const prepared = ensureNuxtPrepare()
      if (!prepared.ok) {
        return { code: 1, stdout: '', stderr: `Nuxt 产物准备失败：${prepared.error}` }
      }
      return runNode(repoPath('scripts', 'eslint-baseline.mjs'), ['--check'])
    }
  },
  {
    id: 'test',
    title: 'pnpm test（全量 tests/**/*.test.ts）',
    run: () => {
      // node --test 在 glob 无匹配时 exit 0 且零用例 —— 必须独立断言收集数
      const files = collectTestFiles()
      if (files.length < TEST_FILE_BASELINE) {
        return {
          code: 1,
          stdout: '',
          stderr: `测试文件收集数 ${files.length} < 基线 ${TEST_FILE_BASELINE}（glob 或目录异常）`
        }
      }
      const res = run('pnpm', ['test'])
      return { ...res, stdout: `收集测试文件 ${files.length} 个\n${res.stdout}` }
    }
  },
  {
    id: 'contract',
    title: 'permission contract（scripts/contract-checks/*.mjs）',
    run: () => runNode(repoPath('scripts', 'check-permission-contract.mjs'))
  },
  {
    id: 'build',
    title: 'pnpm build（实测约 10 分钟；能抓到「纯 JS <script setup> 里写类型注解」这类构建期缺陷）',
    run: () => run('pnpm', ['build']),
    skip: skipBuild
  }
]

const selected = steps.filter((s) => !s.skip && (!only || only.includes(s.id)))
if (selected.length === 0) {
  fail('没有匹配到任何步骤，请检查 --only 参数')
} else {
  const results = []
  for (const step of selected) {
    const startedAt = Date.now()
    console.log(`\n=== [${step.id}] ${step.title} ===`)
    const res = step.run()
    if (res.stdout) process.stdout.write(res.stdout)
    if (res.stderr) process.stderr.write(res.stderr)
    const code = res.code
    console.log(`--- [${step.id}] exit=${code} 耗时 ${elapsed(startedAt)}`)
    results.push({ id: step.id, code, seconds: elapsed(startedAt) })
    if (code !== 0) break
  }

  console.log('\n=== 门禁汇总 ===')
  for (const r of results) {
    console.log(`  ${r.code === 0 ? '✔' : '✖'} ${r.id.padEnd(9)} exit=${r.code}  ${r.seconds}`)
  }

  const dirty = workflowsDirty()
  if (dirty) {
    console.error('\n✖ .github/ 有未提交改动 —— 违反 D23（不得变更主仓库 CI）：')
    console.error(dirty)
    process.exitCode = 1
  } else {
    console.log('✔ .github/ 无改动（D23 守约）')
  }

  if (results.some((r) => r.code !== 0)) process.exitCode = 1
  else ok(`门禁通过（${results.length} 步）`)
}
