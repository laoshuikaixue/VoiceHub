import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

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
  assert.match(astrbot, /settings\.astrbotPushMode === 'pull'/)
  // 四平台独立开关下群广播已停用，入队只针对已绑定私聊目标。
  assert.match(astrbot, /await enqueueAstrbotNotifications\(userIds, title, content\)/)
})