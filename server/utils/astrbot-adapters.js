// 旧绑定回填与新绑定鉴权共用的适配器归类。
/** @type {Map<string, 'qq' | 'wecom' | 'dingtalk' | 'lark'>} */
const ADAPTER_PLATFORMS = new Map([
  ['aiocqhttp', 'qq'],
  ['qq_official', 'qq'],
  ['qq_official_webhook', 'qq'],
  ['wecom_ai_bot', 'wecom'],
  ['dingtalk', 'dingtalk'],
  ['lark', 'lark']
])

/** @param {unknown} adapter */
export function classifyAstrbotAdapter(adapter) {
  return typeof adapter === 'string' ? ADAPTER_PLATFORMS.get(adapter) ?? null : null
}
