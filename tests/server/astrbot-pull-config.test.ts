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

test('群广播能力已移除，接口与投递路径都不再有广播分支', () => {
  const send = read('../../server/api/admin/notifications/send.post.ts')
  const notification = read('../../server/services/notificationService.ts')
  const astrbot = read('../../server/services/astrbotNotificationService.ts')
  const outbox = read('../../server/services/astrbotOutboxService.ts')
  for (const source of [send, notification, astrbot, outbox]) {
    assert.doesNotMatch(source, /shouldBroadcast/)
  }
  assert.match(send, /群广播无法按平台校验接收目标，已停用/)
  assert.match(notification, /sendBatchAstrbotNotifications\(\s*notificationsToCreate\.map\(\(row\) => row\.userId\), title, content\s*\)/)
})

test('系统设置启用开关为 true 时不再接受广播开关', () => {
  const settings = read('../../server/api/admin/system-settings/index.post.ts')
  assert.match(settings, /body\.astrbotBroadcastEnabled === true/)
  assert.match(settings, /四平台独立开关下暂不支持群广播/)
})
