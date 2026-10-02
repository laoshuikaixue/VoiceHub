import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// 推送配置（SMTP 与 AstrBot）的端到端契约：菜单文案、通知分发路径、推拉模式与群推送目标。
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('推送配置的菜单、页签与页面标题一致，保留原路由标识', () => {
  const zh = read('../../app/utils/locale/zh-CN.ts')
  const en = read('../../app/utils/locale/en-US.ts')
  const sidebar = read('../../app/components/Admin/Sidebar.vue')
  assert.match(zh, /'smtp-config': '推送配置'/)
  assert.match(zh, /smtpConfig: '推送配置'/)
  assert.match(zh, /smtpManager: \{\s*title: '推送配置'/)
  assert.match(en, /'smtp-config': 'Push Configuration'/)
  assert.match(en, /smtpConfig: 'Push Configuration'/)
  assert.match(sidebar, /id: 'smtp-config'/)
})

test('管理员发布通知自动分发给有绑定 UMO 的目标，推拉模式共用此路径', () => {
  const send = read('../../server/api/admin/notifications/send.post.ts')
  const service = read('../../server/services/notificationService.ts')
  const astrbot = read('../../server/services/astrbotNotificationService.ts')
  assert.match(send, /await createSystemNotification\(/)
  assert.match(send, /await createBatchSystemNotifications\(/)
  assert.match(service, /await sendAstrbotNotificationToUser\(userId, title, content\)/)
  assert.match(service, /await sendBatchAstrbotNotifications\(/)
  assert.match(astrbot, /isAstrbotPullMode\(settings\.astrbotPushMode\)/)
  // 四平台独立开关下群广播已停用，入队只针对已绑定私聊目标。
  assert.match(astrbot, /await enqueueAstrbotNotifications\(userIds, title, content\)/)
})

test('推拉模式判定唯一权威：所有调用点复用 isAstrbotPullMode，禁止自写字面量比较', () => {
  const callers = [
    'server/services/astrbotNotificationService.ts',
    'server/services/astrbotGroupService.ts',
    'server/api/notifications/astrbot/test.post.ts',
    'server/api/notifications/astrbot/bind-code.post.ts',
    'server/plugins/astrbot-group-flush.ts',
    'server/api/bot/voicehub/pull.post.ts',
    'server/api/admin/system-settings/index.post.ts'
  ]
  for (const file of callers) {
    const code = read(`../../${file}`).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(code, /astrbotPushMode\s*[!=]==?\s*'pull'/, `${file} 应复用 isAstrbotPullMode`)
    assert.doesNotMatch(code, /mode\s*[!=]==?\s*'pull'/, `${file} 应复用 isAstrbotPullMode`)
  }
  for (const file of ['server/api/notifications/astrbot/test.post.ts',
    'server/api/notifications/astrbot/bind-code.post.ts', 'server/plugins/astrbot-group-flush.ts']) {
    assert.match(read(`../../${file}`), /isAstrbotPullMode\(/, `${file} 应调用 isAstrbotPullMode`)
  }
})

test('仅拉取模式的机器人无需配置服务地址，只有令牌是必填项', () => {
  const settings = read('../../server/api/admin/system-settings/index.post.ts')
  // pull 模式下 Base URL 只对 push 必需；否则管理员无法保存「仅拉取」配置。判定同样复用共享函数。
  assert.match(settings, /if \(!token \|\| \(!isAstrbotPullMode\(mode\) && !baseUrl\)\)/)
  const bindCode = read('../../server/api/notifications/astrbot/bind-code.post.ts')
  // 推拉判定复用共享函数，禁止再次出现字面量比较。
  assert.match(bindCode, /!isAstrbotPullMode\(settings\.astrbotPushMode\) && !settings\.astrbotBaseUrl/)
})

test('群推送目标只认白名单与平台开关，事件开关与防刷屏参数参与入队', () => {
  const settings = read('../../server/api/admin/system-settings/index.post.ts')
  const outbox = read('../../server/services/astrbotOutboxService.ts')
  const service = read('../../server/services/astrbotGroupService.ts')
  // 广播开关本身可被保存（历史实现一律拒绝，导致功能无法启用）。
  assert.match(settings, /updateData\.astrbotBroadcastEnabled = body\.astrbotBroadcastEnabled/)
  // 群目标必须带平台归属，唯一判定依据是管理员白名单 + 平台开关，不得回退到 UMO 前缀推断。
  assert.match(settings, /astrbotGroupTargets/)
  assert.match(outbox, /isAstrbotGroupTargetAllowed\(groups, settings\.astrbotPlatforms, umo\)/)
  assert.match(service, /isAstrbotGroupTargetAllowed\(targets, settings\.platforms, umo\)/)
  // 入队按事件开关、合并与冷却参数；移出白名单的旧队列条目不得继续投递。
  assert.match(service, /selectAstrbotGroupTargets\(settings\.targets/)
  assert.match(service, /canMergeAstrbotGroupEvent\(row, now, throttle\)/)
  assert.match(service, /computeAstrbotGroupNotifyAfter\(/)
  assert.match(service, /群目标已移出白名单/)
})
