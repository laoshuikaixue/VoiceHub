import { getSystemSettingsCached } from '../utils/system-settings-helper'

export default defineNitroPlugin(async () => {
  // 启动时预热可让首个业务请求直接命中内存或 Redis，预热失败由读取函数按安全默认值降级。
  await getSystemSettingsCached()
})
