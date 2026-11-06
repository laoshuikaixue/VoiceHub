import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import * as Vue from 'vue'
import * as zh from '../../app/utils/locale/zh-CN.ts'
import * as bot from '../../server/utils/astrbot-platforms.ts'
import * as group from '../../server/utils/astrbot-group.ts'
import * as weekly from '../../server/utils/astrbot-weekly-config.ts'
import { useSafeLocale } from '../../app/composables/useSafeLocale.ts'
import * as permissions from '../../app/utils/admin-permissions.ts'
import { pickScopeSettings, isAdminSettingsScope } from '../../server/utils/admin-settings-scope.ts'
import { resolvePermissionRouteGuard } from '../../server/utils/admin-permission-routes.ts'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('vue/compiler-sfc')
const { compile, parse: parseDom } = createRequire(require.resolve('vue'))('@vue/compiler-dom')
const { renderToString } = require('vue/server-renderer')

const settings = { smtpEnabled: true, smtpHost: 'mail.example', smtpPort: 587, smtpPassword: '****************', smtpUsername: 'school', enabledPlatforms: '["netease"]', platformOrder: '["netease"]', enablePlayTimeSelection: true, playSlotRequired: false, enableRequestTimeLimitation: true }
const messages = Object.fromEntries(Object.entries(zh).map(([key, value]) => [key, Vue.ref(value)]))
const fixture = (path: string) => {
  const scope = path.split('/').at(-1)
  if (path.startsWith('/api/admin/system-settings/') && isAdminSettingsScope(scope)) return pickScopeSettings(scope, settings)
  if (path.endsWith('email-templates')) return { templates: [{ key: 'test', name: '测试模板', subject: '广播', html: '<p>test</p>', isBuiltin: true }] }
  if (path.endsWith('play-times') || path.endsWith('request-times')) return []
  if (path.endsWith('history')) return { success: true, notifications: [], senders: [], pagination: { total: 0, totalPages: 1 } }
  if (path.endsWith('grade-class-options')) return { success: true, classes: [{ grade: '高一', class: '1班' }] }
  return { success: true, responseTime: 5, activities: [], data: {} }
}

async function component(name: string, codes: string[]) {
  const perms = [permissions.PRIV_ADMIN_CONSOLE, ...codes]
  const can = (code: string) => permissions.hasAdminPermission({ perms }, code)
  const requests: string[] = [], denied: string[] = [], mounted: (() => unknown)[] = []
  const fetchData = async (path: string, options: any = {}) => {
    const pathname = path.split('?')[0], method = options.method || 'GET'
    requests.push(`${method} ${pathname}`)
    const guard = resolvePermissionRouteGuard(pathname, method)
    if (guard && (guard.deny || !permissions.hasAllPermissions(perms, guard.all) || !permissions.hasAnyPermission(perms, guard.any))) {
      denied.push(`${method} ${pathname}`)
      throw new Error('发生无权限请求')
    }
    return fixture(pathname)
  }
  const noop = () => {}
  const stub = Vue.defineComponent({ setup: (_: any, context: any) => () => Vue.h('span', context.slots.default?.()) })
  const text = (value: any, ...args: any[]) => typeof value === 'function' ? value(...args) : String(value ?? '').replace(/\{(\d+)\}/g, (_: string, i: string) => args[Number(i)] ?? '')
  const localeText = (section: any) => {
    const get = (key: string, ...args: any[]) => text(section.value?.[key], ...args)
    return { t: get, msg: get, format: text, nested: (sectionKey: string, key: string, ...args: any[]) => text(section.value?.[sectionKey]?.[key], ...args) }
  }
  const deps: Record<string, any> = {
    ...Vue, ...bot, ...group, ...weekly, ...permissions,
    onMounted: (fn: () => unknown) => mounted.push(fn), onUnmounted: noop,
    usePermissions: () => ({
      can, canAccessPage: (page: string) => permissions.canAccessAdminPage(perms, page),
      canUsePage: (page: string) => permissions.canUseAdminPage(perms, page),
      canAccessAdmin: Vue.computed(() => permissions.canAccessAdminConsole(perms)),
      getUserPages: Vue.computed(() => permissions.accessiblePages(perms).filter(page => page !== 'password'))
    }),
    useAuth: () => ({ user: Vue.ref({ id: 9, role: 'TEST', perms }), isAuthenticated: Vue.ref(true), getAuthConfig: () => ({}) }),
    useSiteConfig: () => ({ siteTitle: Vue.ref('VoiceHub'), initSiteConfig: async () => {} }),
    useScrollMemory: noop, definePageMeta: noop, provide: noop, navigateTo: noop,
    useLocale: () => ({ ...messages, currentLocale: Vue.ref('zh-CN') }), useSafeLocale, useLocaleText: localeText,
    formatLocale: text, getThrownMessage: (error: any) => error.message,
    useServerErrors: () => ({ localize: (_: unknown, fallback = '错误') => fallback }),
    useToast: () => ({ showToast: noop, success: noop, error: noop }),
    useAdmin: () => ({ sendAdminNotification: () => fetchData('/api/admin/notifications/send', { method: 'POST' }) }),
    usePlatformConfig: () => ({ refreshPlatformConfig: async () => {} }),
    BUILTIN_PLATFORMS: ['netease', 'tencent', 'bilibili', 'migu'], getPlatformDisplayName: (key: string) => key,
    packageJson: { version: 'test' }, getSyncedDate: () => new Date('2026-11-02T00:00:00Z'),
    setInterval: () => 1, clearInterval: noop, setTimeout: () => 1, clearTimeout: noop,
    defineProps: () => ({ refreshKey: 0 }), defineEmits: () => noop,
    $fetch: fetchData,
    fetch: async (path: string, options: any) => ({ ok: true, json: () => fetchData(path, options) }),
    window: { $showNotification: noop, addEventListener: noop, innerWidth: 1280 },
    document: { addEventListener: noop, title: '' }, renderMarkdown: (value: string) => value
  }
  const file = name === 'Dashboard' ? 'app/pages/dashboard.vue' : `app/components/Admin/${name}.vue`
  const { descriptor } = parse(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'))
  const compiled = compileScript(descriptor, { id: name })
  const bindings = compiled.bindings
  const imported = compiled.scriptSetupAst.filter((node: any) => node.type === 'ImportDeclaration')
    .flatMap((node: any) => node.specifiers.map((item: any) => item.local.name))
  for (const key of imported) if (/^[A-Z]/.test(key) && !(key in deps)) deps[key] = stub
  const script = descriptor.scriptSetup.content.replace(/^import[\s\S]*?from\s*['"][^'"]+['"]\s*;?\r?$/gm, '')
  const parameters = Object.entries(deps).filter(([key]) => /^[A-Za-z_$][\w$]*$/.test(key) && key !== 'default' && (!(key in bindings) || imported.includes(key)))
  const exposed = Object.keys(bindings).filter(key => !['props', 'props-aliased'].includes(bindings[key]))
  const values = new Function(...parameters.map(([key]) => key), `${script}; return { ${exposed.join(',')} }`)(...parameters.map(([, value]) => value))
  for (const hook of mounted) await hook()
  await new Promise<void>((resolve) => setImmediate(resolve))
  const render = new Function('Vue', compile(descriptor.template.content, { mode: 'function' }).code)(Vue)
  const app = Vue.createSSRApp({ setup: () => values, render })
  app.config.warnHandler = noop
  const registered = new Set<string>()
  function register(node: any) {
    if (node.type === 1 && /^[A-Z]/.test(node.tag) && !registered.has(node.tag)) {
      registered.add(node.tag)
      app.component(node.tag, stub)
    }
    for (const child of node.children || []) register(child)
  }
  register(parseDom(descriptor.template.content))
  const html = await renderToString(app)
  return { html, requests, denied, values }
}

test('SMTP 单功能角色只加载 SMTP 配置，保存可用，测试、机器人和模板面板不发起请求', async () => {
  const view = await component('SmtpManager', ['smtp:write'])
  assert.deepEqual(view.requests, ['GET /api/admin/system-settings/smtp'])
  assert.deepEqual(view.denied, [])
  assert.match(view.html, /SMTP/)
  assert.doesNotMatch(view.html, /邮件模板管理/)
  await view.values.saveConfig()
  assert.ok(view.requests.includes('POST /api/admin/system-settings/smtp'))
  const before = view.requests.length
  await view.values.sendTestEmail()
  await view.values.saveAstrbotConfig()
  assert.equal(view.requests.length, before)
})

test('机器人、模板和音源插件可独立进入组合页面，不请求其他模块配置', async () => {
  const botView = await component('SmtpManager', ['astrbot:write'])
  assert.deepEqual(botView.requests, ['GET /api/admin/system-settings/astrbot'])
  const templates = await component('EmailTemplateManager', ['email-templates:read'])
  assert.deepEqual(templates.requests, ['GET /api/admin/email-templates'])
  await templates.values.save()
  await templates.values.restore()
  assert.deepEqual(templates.requests, ['GET /api/admin/email-templates'])
  const plugins = await component('MusicSourceController', ['music-source-plugins:read'])
  assert.deepEqual(plugins.requests, [])
  assert.equal(plugins.values.loading.value, false)
})

test('时段模块只读账号正常加载，保存与开关操作不会发送写请求', async () => {
  for (const [name, code, deniedAction] of [
    ['PlayTimeManager', 'play-times:read', 'toggleGlobalEnabled'],
    ['RequestTimeManager', 'request-times:read', 'toggleGlobalRequest']
  ]) {
    const view = await component(name, [code])
    assert.deepEqual(view.denied, [])
    assert.ok(view.requests.some(path => path.includes(`/system-settings/${code.split(':')[0]}`)))
    const before = view.requests.length
    await view.values[deniedAction]()
    assert.equal(view.requests.length, before)
    assert.match(view.html, /disabled/)
  }
})

test('概览按数据权限加载面板，数据库只读账号不能打开维护或备份弹窗', async () => {
  const overview = await component('OverviewDashboard', ['activities:read'])
  assert.deepEqual(overview.requests, ['GET /api/admin/activities'])
  assert.deepEqual(overview.denied, [])
  const database = await component('DatabaseManager', ['database:read'])
  assert.deepEqual(database.requests, [])
  for (const card of ['backup', 'restore', 'reset-db', 'reset-seq', 'auto-backup']) database.values.openModal(card)
  assert.equal(database.values.activeModal.value, 'none')
})

test('通知只读账号仅查看历史，通知操作员的用户选择不依赖完整用户管理权限', async () => {
  const readonly = await component('NotificationSender', ['notifications:read'])
  assert.deepEqual(readonly.requests, [])
  await readonly.values.sendNotification()
  assert.deepEqual(readonly.requests, [])
  const history = await component('NotificationHistory', ['notifications:read'])
  assert.deepEqual(history.denied, [])
  assert.deepEqual(history.requests, ['GET /api/admin/notifications/history'])
  const operator = await component('NotificationSender', ['notifications:write'])
  await operator.values.searchUsers('同学')
  assert.deepEqual(operator.denied, [])
  assert.ok(operator.requests.includes('GET /api/admin/recipients'))
  assert.equal(operator.requests.some(path => path.includes('/api/admin/users')), false)
})

test('控制台自动选择可用功能，没有模块或仅有页面码时显示明确提示', async () => {
  const smtp = await component('Dashboard', ['smtp:write'])
  assert.equal(smtp.values.activeTab.value, 'smtp-config')
  const empty = await component('Dashboard', [])
  assert.equal(empty.values.activeTab.value, null)
  assert.match(empty.html, /尚未分配可用模块/)
  const pageOnly = await component('Dashboard', ['page:users'])
  assert.equal(pageOnly.values.activeTab.value, 'users')
  assert.match(pageOnly.html, /缺少模块权限/)
  assert.deepEqual(pageOnly.requests, [])
})
