/**
 * 统一语言入口（i18n 轻量抽象）。
 *
 * 设计目的：
 * 1. 避免组件直接静态导入 `~/utils/locale/zh-CN`，与具体语言实现解耦。
 * 2. 后续引入 vue-i18n / 其它语言包时，只需调整本文件选择策略，组件零修改。
 * 3. 当前默认返回中文；预留 `currentLocale` ref 以便后续接入用户偏好或浏览器语言。
 */
import { ref } from 'vue'
import * as zhCN from './zh-CN'

export type Locale = 'zh-CN' | string

const messages: Record<string, any> = {
  'zh-CN': zhCN
}

const currentLocale = ref<Locale>('zh-CN')

/**
 * 切换当前语言（预留 API，后续接入 vue-i18n 时直接调用此函数）。
 * 传入未知语言码时静默忽略并保持当前语言，避免破坏页面渲染。
 */
export function setLocale(locale: Locale) {
  if (messages[locale]) {
    currentLocale.value = locale
  }
}

export function useLocale() {
  // 返回按当前语言动态解析的具名模块，避免组件直接耦合到具体语言包。
  // 采用 getter 实现响应式：currentLocale 变化时访问 locale.siteConfig 等属性也会随之更新。
  return {
    currentLocale: currentLocale.value,
    setLocale,
    get siteConfig() { return messages[currentLocale.value]?.siteConfig ?? messages['zh-CN'].siteConfig },
    get changePassword() { return messages[currentLocale.value]?.changePassword ?? messages['zh-CN'].changePassword }
  }
}