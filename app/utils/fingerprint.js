/**
 * 浏览器指纹采集（零依赖）。
 *
 * 采集 canvas / WebGL / AudioContext / 字体 / 屏幕 / 时区 / UA-Data 等稳定信号，
 * 经 cyrb53 四轮哈希输出 64 位十六进制指纹。仅在客户端调用；SSR 下直接返回空。
 *
 * 稳定性约定：只采集不随主题、会话变化的信号；浏览器大版本升级可能导致指纹变化，
 * 用户在账号管理页重新启用即可。
 */

// cyrb53（公开域，bryc）：53 位字符串哈希，四轮不同种子拼接为 64 位十六进制
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

const FINGERPRINT_SEEDS = [0x9e3779b1, 0x85ebca6b, 0xc2b2ae3d, 0x27d4eb2f]

const getCanvasFingerprint = () => {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.textBaseline = 'top'
    ctx.font = '16px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(20, 8, 180, 30)
    ctx.fillStyle = '#069'
    ctx.fillText('VoiceHub fingerprint', 4, 8)
    ctx.strokeStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.arc(60, 30, 20, 0, Math.PI * 2)
    ctx.stroke()
    return canvas.toDataURL()
  } catch {
    return ''
  }
}

const getWebGLFingerprint = () => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return ''
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const parts = [
      debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      gl.getParameter(gl.MAX_VARYING_VECTORS),
      gl.getParameter(gl.VERSION),
      gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
    ]
    // 及时释放 WebGL 上下文，避免占用 GPU 资源
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return parts.join('|')
  } catch {
    return ''
  }
}

// 离线音频渲染：不同硬件/驱动的浮点累积结果存在稳定差异
const getAudioFingerprint = async () => {
  try {
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext
    if (!OfflineCtx) return ''
    const ctx = new OfflineCtx(1, 44100, 44100)
    const oscillator = ctx.createOscillator()
    oscillator.type = 'triangle'
    oscillator.frequency.value = 10000
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -50
    compressor.knee.value = 40
    compressor.ratio.value = 12
    compressor.attack.value = 0
    compressor.release.value = 0.25
    oscillator.connect(compressor)
    compressor.connect(ctx.destination)
    oscillator.start(0)
    const buffer = await ctx.startRendering()
    const samples = buffer.getChannelData(0)
    let sum = 0
    for (let i = 4500; i < 5000; i++) sum += Math.abs(samples[i])
    return String(sum)
  } catch {
    return ''
  }
}

// 字体探测：与基准字体宽度不一致视为已安装
const FONT_PROBE_LIST = [
  'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria', 'Cambria Math',
  'Comic Sans MS', 'Courier New', 'Georgia', 'Impact', 'Times New Roman',
  'Trebuchet MS', 'Verdana', 'Helvetica Neue', 'Segoe UI', 'Tahoma',
  'PingFang SC', 'Hiragino Sans', 'Microsoft YaHei', 'SimSun', 'SimHei',
  'Noto Sans CJK SC', 'Source Han Sans SC', 'Meiryo', 'MS Gothic'
]
const BASE_FONTS = ['monospace', 'sans-serif', 'serif']

const getFontsFingerprint = () => {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    const testString = 'WWWWWmmmmmmmiiiii'
    const baseWidths = {}
    ctx.font = '72px monospace'
    for (const baseFont of BASE_FONTS) {
      ctx.font = `72px ${baseFont}`
      baseWidths[baseFont] = ctx.measureText(testString).width
    }
    const available = []
    for (const font of FONT_PROBE_LIST) {
      let detected = false
      for (const baseFont of BASE_FONTS) {
        ctx.font = `72px "${font}", ${baseFont}`
        if (ctx.measureText(testString).width !== baseWidths[baseFont]) {
          detected = true
          break
        }
      }
      if (detected) available.push(font)
    }
    return available.join(',')
  } catch {
    return ''
  }
}

const getPluginsFingerprint = () => {
  try {
    const plugins = []
    const list = navigator.plugins || []
    for (let i = 0; i < Math.min(list.length, 30); i++) {
      plugins.push(`${list[i].name}::${list[i].filename}`)
    }
    return plugins.join(',')
  } catch {
    return ''
  }
}

// Chromium 高熵 UA：架构 / 位宽 / 机型 / 平台版本 / 完整版本号
const getHighEntropyUA = async () => {
  try {
    const uaData = navigator.userAgentData
    if (!uaData?.getHighEntropyValues) return ''
    const hints = await uaData.getHighEntropyValues([
      'architecture',
      'bitness',
      'model',
      'platformVersion',
      'uaFullVersion'
    ])
    return [
      hints.architecture,
      hints.bitness,
      hints.model,
      hints.platformVersion,
      hints.uaFullVersion
    ].join('|')
  } catch {
    return ''
  }
}

const safeMatchMedia = (query) => {
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

export const isFingerprintSupported = () => typeof window !== 'undefined'

/**
 * 采集浏览器指纹。
 * @returns {Promise<{fingerprint: string, components: Record<string, string>}>}
 *   fingerprint 为 64 位十六进制字符串；components 为各信号明细（调试用）
 */
export const collectFingerprint = async () => {
  if (typeof window === 'undefined') {
    return { fingerprint: '', components: {} }
  }

  const audio = await getAudioFingerprint()
  const highEntropyUA = await getHighEntropyUA()

  const components = {
    userAgent: navigator.userAgent || '',
    appVersion: navigator.appVersion || '',
    platform: navigator.platform || '',
    language: navigator.language || '',
    languages: (navigator.languages || []).join(','),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    timezoneOffset: String(new Date().getTimezoneOffset()),
    screen: [
      window.screen?.width,
      window.screen?.height,
      window.screen?.availWidth,
      window.screen?.availHeight,
      window.devicePixelRatio,
      window.screen?.colorDepth
    ].join('x'),
    hardwareConcurrency: String(navigator.hardwareConcurrency ?? ''),
    deviceMemory: String(navigator.deviceMemory ?? ''),
    maxTouchPoints: String(navigator.maxTouchPoints ?? ''),
    cookieEnabled: String(navigator.cookieEnabled),
    doNotTrack: String(navigator.doNotTrack ?? ''),
    pdfViewer: String(navigator.pdfViewerEnabled ?? ''),
    reducedMotion: String(safeMatchMedia('(prefers-reduced-motion: reduce)')),
    canvas: getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    audio,
    fonts: getFontsFingerprint(),
    plugins: getPluginsFingerprint(),
    highEntropyUA
  }

  const raw = Object.keys(components)
    .map((key) => `${key}=${components[key]}`)
    .join('\n')

  const fingerprint = FINGERPRINT_SEEDS.map((seed) =>
    cyrb53(raw, seed).toString(16).padStart(16, '0')
  ).join('')

  return { fingerprint, components }
}
