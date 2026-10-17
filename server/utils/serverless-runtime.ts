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

export function isServerlessRuntime(): boolean {
  const preset = String(process.env.NITRO_PRESET || '').toLowerCase()
  return Boolean(
    process.env.VERCEL || process.env.VERCEL_ENV || process.env.NETLIFY ||
    process.env.IS_SERVERLESS || SERVERLESS_PRESETS.has(preset)
  )
}
