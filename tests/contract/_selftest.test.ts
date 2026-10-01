/**
 * S0 自证用例：证明测试入口的嵌套 glob 真的生效。
 *
 * 背景（实测）：`node --test "tests/server/*.test.ts"` 的 glob **不递归**，
 * 放在 tests/contract/ 等嵌套目录下的用例永远不会被执行。S0-2 把入口改成
 * `tests/**\/*.test.ts` 后，本用例必须被收集到。
 *
 * 注意：不能用「测试输出里出现文件名」来断言（spec/tap/dot 三种 reporter 的
 * 通过输出都不含文件路径），所以用例名带可检索标记，并单独断言收集数。
 */

import assert from 'node:assert/strict'
import { globSync } from 'node:fs'
import test from 'node:test'

test('S0-5 nested glob works', () => {
  const files = globSync('tests/**/*.test.ts').map((p) => String(p).replace(/\\/g, '/'))
  assert.ok(
    files.includes('tests/contract/_selftest.test.ts'),
    `嵌套用例未被 glob 收集到，实际收到：${files.join(', ')}`
  )
})
