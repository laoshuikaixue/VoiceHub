// 适配器名到平台的归类，供绑定鉴权与绑定数据恢复共用。
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
