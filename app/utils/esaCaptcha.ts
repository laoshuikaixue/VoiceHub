/**
 * 阿里云 ESA AI 验证码共享常量与场景 ID 解析。
 *
 * 区域取值与 server/config/constants.ts 的 ALIYUN_ESA_CAPTCHA_REGIONS 保持一致；
 * 服务端域名来自官方文档（region 为 cn 与 sgp 时使用不同的 ESA 服务端节点）。
 * ESA 验证码统一走公共验证接口（ESA 规则路径 /api/captcha/verify），
 * 场景 ID 按「域名」成组配置，验证通过后由源站签发短期凭证供各业务接口复用。
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

// ESA 边缘按此请求头读取验签参数（captchaVerifyParam），仅公共验证接口使用
export const ESA_CAPTCHA_VERIFY_HEADER = 'captcha-verify-param'

// 源站签发的人机验证通过凭证请求头，业务接口据此校验（非 ESA 边缘使用）
export const ESA_CAPTCHA_PASS_HEADER = 'captcha-pass'

// ESA 边缘在响应头回传验签原因码，源站不参与验签，只有客户端能读到
export const ESA_CAPTCHA_VERIFY_CODE_HEADER = 'x-captcha-verify-code'

// 通过类原因码：T001 验证通过、T005 测试模式放行、T006 命中白名单放行
export const ESA_CAPTCHA_PASS_CODES = ['T001', 'T005', 'T006'] as const

/**
 * 从请求错误中取出 ESA 边缘拦截的原因码
 * 拦截发生在边缘，请求不会到达源站，错误体并非本项目的 API 错误，只能靠响应头识别
 * @returns 未被拦截或响应未回传原因码时返回空字符串
 */
export const getEsaCaptchaRejectCode = (err: unknown): string => {
  const headers = (err as { response?: { headers?: { get?: (name: string) => string | null } } })?.response?.headers
  // Headers.get 在缺失时返回 null，必须先回退空串，否则会被拼成 "NULL"
  const raw = typeof headers?.get === 'function' ? headers.get(ESA_CAPTCHA_VERIFY_CODE_HEADER) : null
  const code = String(raw ?? '').trim().toUpperCase()
  // 只接受官方原因码格式，防止响应头任意内容进入提示文案
  if (!/^[TF]\d{3}$/.test(code)) return ''
  return (ESA_CAPTCHA_PASS_CODES as readonly string[]).includes(code) ? '' : code
}

// 公共验证接口在 ESA 控制台的规则路径（不含协议与域名），也是场景唯一覆盖的接口
export const ESA_CAPTCHA_VERIFY_PATH = '/api/captcha/verify'

// 场景配置的接口枚举（唯一权威定义）：仅公共验证接口；
// 旧版按业务接口（login/register）存储的条目不在枚举内，会被 parseEsaCaptchaScenes 过滤作废
export const ESA_CAPTCHA_ENDPOINTS = ['common'] as const

// 各接口对应的服务端路径，即 ESA 控制台「需验签的接口」直接填写此路径（不含协议与域名）
export const ESA_CAPTCHA_ENDPOINT_PATHS: Record<string, string> = {
  common: ESA_CAPTCHA_VERIFY_PATH
}

// 域名列填此值表示匹配任意域名
export const ESA_CAPTCHA_ANY_HOST = '*'

/** 未知区域回退默认值，避免无效配置导致 SDK 初始化失败 */
export const normalizeEsaCaptchaRegion = (region: string | null | undefined): string =>
  ESA_CAPTCHA_REGIONS.some((item) => item.value === region) ? (region as string) : ESA_CAPTCHA_DEFAULT_REGION

const esaCaptchaFallbackServers = ESA_CAPTCHA_REGIONS[0]?.servers ?? []

export const getEsaCaptchaServers = (region: string | null | undefined): string[] =>
  ESA_CAPTCHA_REGIONS.find((item) => item.value === normalizeEsaCaptchaRegion(region))?.servers ??
  esaCaptchaFallbackServers

const normalizeEsaHost = (host: unknown) => String(host ?? '').trim().toLowerCase()

/**
 * 解析场景 ID 规则列表：每项须同时具备合法的 endpoint、host 与 sceneId，非法项丢弃
 * @param raw 数据库中存储的 JSON 字符串或已解析的数组
 */
export const parseEsaCaptchaScenes = (raw: unknown): Array<{ endpoint: string; host: string; sceneId: string }> => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item) =>
          item &&
          ESA_CAPTCHA_ENDPOINTS.includes(item.endpoint) &&
          typeof item.host === 'string' &&
          item.host.trim() !== '' &&
          typeof item.sceneId === 'string' &&
          item.sceneId.trim() !== ''
      )
      .map((item) => ({
        endpoint: item.endpoint,
        host: normalizeEsaHost(item.host),
        sceneId: item.sceneId.trim()
      }))
  } catch {
    return []
  }
}

/**
 * 域名匹配：'*' 匹配任意域名，'*.example.com' 匹配任意层级子域（不含裸域），其余为精确匹配
 */
export const matchEsaCaptchaHost = (pattern: unknown, hostname: unknown) => {
  const target = normalizeEsaHost(hostname || '')
  const rule = normalizeEsaHost(pattern || '')
  if (rule === ESA_CAPTCHA_ANY_HOST) return true
  if (!target) return false
  if (rule.startsWith('*.')) return target.endsWith(rule.slice(1)) && target !== rule.slice(2)
  return target === rule
}

/**
 * 按业务接口与当前域名解析场景 ID，优先级：精确域名 > 通配子域 > 任意域名，同级取第一条
 * @returns 无匹配规则时返回空字符串
 */
export const resolveEsaCaptchaSceneId = (raw: unknown, endpoint: string, hostname: string) => {
  // SSR 阶段无域名，只能命中「任意域名」规则
  const target = normalizeEsaHost(hostname)
  const candidates = parseEsaCaptchaScenes(raw).filter((item) => item.endpoint === endpoint)
  const exact = target ? candidates.find((item) => item.host === target) : undefined
  if (exact) return exact.sceneId
  const wildcardSub = candidates.find((item) => matchEsaCaptchaHost(item.host, target) && item.host !== ESA_CAPTCHA_ANY_HOST)
  if (wildcardSub) return wildcardSub.sceneId
  const anyHost = candidates.find((item) => item.host === ESA_CAPTCHA_ANY_HOST)
  return anyHost ? anyHost.sceneId : ''
}
