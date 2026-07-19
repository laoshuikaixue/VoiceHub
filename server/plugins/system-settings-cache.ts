import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'

export default defineNitroPlugin(async () => {
  // 预热失败时仍由读取函数采用安全默认值，避免阻断应用启动。
  await getSystemSettingsCached()
})
