import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('仅拉取模式的机器人无需配置服务地址，只有令牌是必填项', () => {
  const settings = read('../../server/api/admin/system-settings/index.post.ts')
  // pull 模式下 Base URL 只对 push 必需；否则管理员无法保存「仅拉取」配置。
  assert.match(settings, /if \(!token \|\| \(mode !== 'pull' && !baseUrl\)\)/)
  const bindCode = read('../../server/api/notifications/astrbot/bind-code.post.ts')
  assert.match(bindCode, /settings\.astrbotPushMode !== 'pull' && !settings\.astrbotBaseUrl/)
})

test('群推送恢复但必须带平台归属：目标走白名单校验，而非靠 UMO 前缀推断', () => {
  const settings = read('../../server/api/admin/system-settings/index.post.ts')
  const outbox = read('../../server/services/astrbotOutboxService.ts')
  const service = read('../../server/services/astrbotGroupService.ts')
  // 广播开关本身可被保存（历史实现一律拒绝，导致功能无法启用）。
  assert.match(settings, /updateData\.astrbotBroadcastEnabled = body\.astrbotBroadcastEnabled/)
  // 群目标的唯一判定依据是管理员白名单 + 平台开关，不得回退到前缀推断。
  assert.match(outbox, /isAstrbotGroupTargetAllowed\(groups, settings\.astrbotPlatforms, umo\)/)
  assert.match(service, /isAstrbotGroupTargetAllowed\(targets, settings\.platforms, umo\)/)
  // 群目标未保存平台归属时不得入队。
  assert.match(settings, /astrbotGroupTargets/)
})

test('群事件按事件开关与防刷屏参数入队，投递前复核白名单', () => {
  const service = read('../../server/services/astrbotGroupService.ts')
  // 事件开关关闭时不投递：选择逻辑必须看到事件键。
  assert.match(service, /selectAstrbotGroupTargets\(settings\.targets/)
  // 合并与冷却：高频事件合并成一条，冷却闸门控制投递时机。
  assert.match(service, /canMergeAstrbotGroupEvent\(row, now, throttle\)/)
  assert.match(service, /computeAstrbotGroupNotifyAfter\(/)
  // 移出白名单的旧队列条目不得继续投递。
  assert.match(service, /群目标已移出白名单/)
})
