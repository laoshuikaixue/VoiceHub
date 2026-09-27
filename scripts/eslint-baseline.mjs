/**
 * ESLint 基线 ratchet（R-40 / P-05）。
 *
 * 目的：在「存量非绿」（实测 1437 problems / 185 errors）的仓库上建立可用的增量门禁
 *       —— 只禁止新增 error，不用总数减少当通过证据。
 *
 * 用法：
 *   node scripts/eslint-baseline.mjs --regen                   重新冻结基线（生成物提交）
 *   node scripts/eslint-baseline.mjs --check                   当前 error 数不得超基线
 *   node scripts/eslint-baseline.mjs --report <ruleId>         打印该规则违规数（必须先已注册）
 *
 * 三个必须内建的反假绿保护（均有实测依据）：
 *   1. 报告为空 → 判失败（干净检出裸跑 eslint 会因缺 .nuxt/eslint.config.mjs 产出 0 条结果）；
 *   2. 扫描文件数 < (基线 − 跨平台容差) → 判失败（防止只扫到少数文件却「零新增 error」；
 *      容差是必须的：同一份代码在 Windows 扫到 665 个文件、Linux 扫到 662 个（实测差 3），
 *      冻结基线的平台不能要求另一平台 ≥ 原值 —— 该断言防的是「扫描范围塌缩」而不是钉死数字）；
 *   3. --report 指定的 ruleId 必须已在 eslint.config.mjs 注册，否则非零退出
 *      （实测：不存在的规则同样返回 0/exit 0，与「规则已生效且零违规」无法区分）。
 */

import fs from 'node:fs'
import { ROOT, runEslint, repoPath, ensureNuxtPrepare, fail, ok } from './lib/gate-utils.mjs'

const BASELINE_PATH = repoPath('eslint-baseline.json')
const ESLINT_CONFIG = repoPath('eslint.config.mjs')

/** 跨平台扫描文件数容差（Windows/Linux 实测差 3；留 10 的余量仍能抓住「范围塌缩」） */
const DEFAULT_FILES_TOLERANCE = 10

/** 跑一次 eslint（JSON 格式），返回 { problems, fileCount, perRule }。 */
function lintJson() {
  // .nuxt/eslint.config.mjs 缺失时 eslint 会 exit 2 且无输出 —— 先确保它存在，
  // 否则会把「配置没准备好」误报成「报告为空」。
  const prepared = ensureNuxtPrepare()
  if (!prepared.ok) {
    return { error: `Nuxt 产物准备失败：${prepared.error}` }
  }
  const result = runEslint(['.', '-f', 'json'])
  const raw = result.stdout.trim()
  if (!raw) {
    return { error: `eslint 无输出（退出码 ${result.code}）。通常是缺 .nuxt/eslint.config.mjs —— 请用 pnpm lint，或先跑 nuxt prepare。stderr: ${result.stderr.trim().slice(0, 300)}` }
  }
  let report
  try {
    report = JSON.parse(raw)
  } catch (err) {
    return { error: `eslint 输出不是合法 JSON：${err.message}` }
  }
  if (!Array.isArray(report) || report.length === 0) {
    return { error: 'eslint 报告为空（0 个文件）——拒绝把它当作「零违规」' }
  }
  let errors = 0
  let warnings = 0
  const perRule = new Map()
  for (const file of report) {
    for (const msg of file.messages || []) {
      if (msg.severity === 2) errors += 1
      else warnings += 1
      if (msg.ruleId) perRule.set(msg.ruleId, (perRule.get(msg.ruleId) || 0) + 1)
    }
  }
  return { errors, warnings, files: report.length, perRule }
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return null
  }
}

/** 规则是否已注册：检查 eslint.config.mjs 文本里出现该 ruleId 或它所属的插件文件。 */
function ruleRegistered(ruleId) {
  if (!fs.existsSync(ESLINT_CONFIG)) return false
  const cfg = fs.readFileSync(ESLINT_CONFIG, 'utf8')
  if (cfg.includes(ruleId)) return true
  const plugin = ruleId.split('/')[0]
  return cfg.includes(`eslint-rules/${plugin}`) || cfg.includes(`${plugin}/`)
}

function cmdRegen() {
  const res = lintJson()
  if (res.error) return fail(res.error)
  const baseline = {
    note: 'ESLint 增量基线（生成物）。只允许减少，不允许新增 error。改动此文件必须说明原因。',
    generatedBy: 'node scripts/eslint-baseline.mjs --regen',
    frozenOn: process.platform,
    filesTolerance: DEFAULT_FILES_TOLERANCE,
    errors: res.errors,
    warnings: res.warnings,
    files: res.files
  }
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
  ok(`基线已冻结：errors=${res.errors} warnings=${res.warnings} files=${res.files}`)
}

function cmdCheck() {
  const baseline = readBaseline()
  if (!baseline) return fail('缺少 eslint-baseline.json，请先执行 --regen')
  const res = lintJson()
  if (res.error) return fail(res.error)
  const tolerance = Number(baseline.filesTolerance ?? DEFAULT_FILES_TOLERANCE)
  const minFiles = Math.max(baseline.files - tolerance, 1)
  if (res.files < minFiles) {
    return fail(
      `扫描文件数 ${res.files} < 下限 ${minFiles}（基线 ${baseline.files} − 跨平台容差 ${tolerance}）—— 疑似扫描范围被缩小，拒绝判定通过`
    )
  }
  const delta = res.errors - baseline.errors
  if (delta > 0) {
    return fail(`新增 error ${delta} 条（当前 ${res.errors}，基线 ${baseline.errors}）`)
  }
  ok(`lint 增量检查通过：errors=${res.errors}（基线 ${baseline.errors}, delta ${delta >= 0 ? '+' : ''}${delta}）files=${res.files}`)
}

function cmdReport(ruleId) {
  if (!ruleId) return fail('--report 需要一个 ruleId')
  if (!ruleRegistered(ruleId)) {
    return fail(`规则 ${ruleId} 未在 eslint.config.mjs 注册 —— 拒绝用「0 违规」表示通过（假绿保护）`)
  }
  const res = lintJson()
  if (res.error) return fail(res.error)
  const count = res.perRule.get(ruleId) || 0
  console.log(`${ruleId}: ${count}`)
}

const args = process.argv.slice(2)
if (args.includes('--regen')) cmdRegen()
else if (args.includes('--check')) cmdCheck()
else if (args.includes('--report')) cmdReport(args[args.indexOf('--report') + 1])
else {
  console.log(`用法：
  node scripts/eslint-baseline.mjs --regen
  node scripts/eslint-baseline.mjs --check
  node scripts/eslint-baseline.mjs --report <ruleId>`)
  process.exitCode = 1
}

void ROOT
