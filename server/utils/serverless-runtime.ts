/**
 * Serverless 运行环境判定：云函数按实例独立建池、无常驻生命周期
 * db.ts 的连接池、备份导出与列表、群事件投递器共用，禁止再各写一份判定
 */
const SERVERLESS_PRESETS = new Set([
  'vercel',
  'netlify',
  'aws-lambda',
  'cloudflare-pages',
  'cloudflare-module',
  'deno-deploy'
])

// IS_SERVERLESS 是面向用户的手动开关：环境变量恒为字符串，非空即为真，
// 需排除 "false"/"0" 这类显式关闭值，否则 IS_SERVERLESS=false 会被反判为启用
function isEnvEnabled(value?: string): boolean {
  const v = String(value || '').trim().toLowerCase()
  return v !== '' && v !== 'false' && v !== '0'
}

export function isServerlessRuntime(): boolean {
  const preset = String(process.env.NITRO_PRESET || '').toLowerCase()
  return Boolean(
    process.env.VERCEL || process.env.VERCEL_ENV || process.env.NETLIFY ||
    isEnvEnabled(process.env.IS_SERVERLESS) || SERVERLESS_PRESETS.has(preset)
  )
}
