/**
 * 阿里云 ESA AI 验证码共享常量。
 *
 * 区域取值与 server/config/constants.ts 的 ALIYUN_ESA_CAPTCHA_REGIONS 保持一致；
 * 服务端域名来自官方文档（region 为 cn 与 sgp 时使用不同的 ESA 服务端节点）。
 */

export const ESA_CAPTCHA_REGIONS = [
  {
    value: 'cn',
    // 中国内地节点
    servers: ['captcha-esa-open.aliyuncs.com', 'captcha-esa-open-b.aliyuncs.com']
  },
  {
    value: 'sgp',
    // 新加坡节点
    servers: ['captcha-esa-open-southeast.aliyuncs.com', 'captcha-esa-open-southeast-b.aliyuncs.com']
  }
]

export const ESA_CAPTCHA_DEFAULT_REGION = 'cn'

// ESA 边缘按此请求头读取验签参数（captchaVerifyParam）
export const ESA_CAPTCHA_VERIFY_HEADER = 'captcha-verify-param'

/** 未知区域回退默认值，避免无效配置导致 SDK 初始化失败 */
export const normalizeEsaCaptchaRegion = (region) =>
  ESA_CAPTCHA_REGIONS.some((item) => item.value === region) ? region : ESA_CAPTCHA_DEFAULT_REGION

export const getEsaCaptchaServers = (region) => {
  const target = normalizeEsaCaptchaRegion(region)
  return ESA_CAPTCHA_REGIONS.find((item) => item.value === target).servers
}
