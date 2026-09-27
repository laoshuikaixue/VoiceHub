/**
 * S2-3 单测：两条 ESLint 规则的反证（D16 / §5.6）。
 *
 * `no-raw-role-check` 用 RuleTester（纯 JS 语法，需要 AST）。
 * `no-lang-ts` 不走 RuleTester：该规则只读「文件名 + 文件文本」，而 `.vue` 用例需要
 * `vue-eslint-parser`（pnpm 下非根依赖，不在本包依赖清单里）→ 用最小 context 直接调用 create，
 * 仍然覆盖「命中/放行」两类行为，且不引入新依赖。
 *
 * 全仓违规数由 `node scripts/eslint-baseline.mjs --report voicehub/no-raw-role-check` 登记为 S3 输入基线。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { RuleTester } from 'eslint'
import noRawRoleCheck from '../../../../eslint-rules/no-raw-role-check.js'
import noLangTs from '../../../../eslint-rules/no-lang-ts.js'

const API_FILE = 'server/api/admin/users/index.get.ts'
const KERNEL_FILE = 'server/utils/rbac/guards.ts'

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2023, sourceType: 'module' }
})

test('S2-3 no-raw-role-check：5 条反证（含上一轮漏掉的 includes 实参）', () => {
  ruleTester.run('voicehub/no-raw-role-check', noRawRoleCheck, {
    valid: [
      // 白名单函数的直接实参：role 读取下沉到内核
      { filename: API_FILE, code: 'const ok = isSuperAdmin(targetUser)' },
      { filename: API_FILE, code: 'const ok = isAdminRole(user?.role)' },
      { filename: API_FILE, code: 'const ok = isSongAdminRole(user.role)' },
      { filename: API_FILE, code: 'const ok = getUserRole(dbUser)' },
      { filename: API_FILE, code: 'await requirePermission(event, PERMISSIONS.USER_READ)' },
      // 内核目录必须放行（legacyRoleCheck / guards 必须读 role）
      { filename: KERNEL_FILE, code: 'const r = targetUser.role' },
      { filename: 'app/utils/rbac.ts', code: 'const r = user.role' }
    ],
    invalid: [
      { filename: API_FILE, code: 'const r = targetUser.role', errors: [{ messageId: 'noRawRoleCheck' }] },
      { filename: API_FILE, code: 'const { role } = user', errors: [{ messageId: 'noRawRoleCheck' }] },
      {
        filename: API_FILE,
        code: "const allowed = ['ADMIN', 'SUPER_ADMIN'].includes(user.role)",
        errors: [{ messageId: 'noRawRoleCheck' }]
      },
      { filename: API_FILE, code: "const isAdmin = user?.role === 'ADMIN'", errors: [{ messageId: 'noRawRoleCheck' }] },
      { filename: API_FILE, code: "const r = user['role']", errors: [{ messageId: 'noRawRoleCheck' }] },
      { filename: API_FILE, code: 'const payload = { role: user.role }', errors: [{ messageId: 'noRawRoleCheck' }] },
      { filename: API_FILE, code: 'setCookie(event, "r", targetUser.role)', errors: [{ messageId: 'noRawRoleCheck' }] }
    ]
  })
})

/** 最小 ESLint context：no-lang-ts 只依赖 getFilename / sourceCode.text / report */
function runContentRule(rule, filename, code) {
  const reported = []
  const context = {
    getFilename: () => filename,
    getSourceCode: () => ({ text: code }),
    sourceCode: { text: code },
    report: (descriptor) => reported.push(descriptor)
  }
  const visitor = rule.create(context)
  // 规则对不在作用域内的文件返回空 visitor（这是设计行为，不是错误）
  if (typeof visitor.Program === 'function') visitor.Program({ type: 'Program' })
  return reported
}

test('S2-3 no-lang-ts：<script setup lang="ts"> 报错，纯 JS 放行', () => {
  const invalid = [
    'app/components/Admin/Foo.vue',
    "app/pages/index.vue"
  ]
  assert.equal(
    runContentRule(noLangTs, invalid[0], '<template><div /></template>\n<script setup lang="ts">\nconst a = 1\n</script>').length,
    1
  )
  assert.equal(runContentRule(noLangTs, invalid[1], "<script setup lang='ts'>const a = 1</script>").length, 1)

  // 放行：纯 JS 组件 / 非 .vue 文件（即使文本里出现 lang="ts" 字样）
  assert.equal(runContentRule(noLangTs, 'app/components/Admin/Foo.vue', '<script setup>const a = 1</script>').length, 0)
  assert.equal(runContentRule(noLangTs, 'server/utils/rbac/guards.ts', 'const lang = "ts"').length, 0)

  assert.equal(noLangTs.meta.messages.noLangTs.length > 0, true)
  assert.equal(noRawRoleCheck.meta.messages.noRawRoleCheck.length > 0, true)
})

