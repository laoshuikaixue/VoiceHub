import { randomBytes } from 'node:crypto'

/**
 * 启动时安全配置校验。
 *
 * 背景：历史版本的 docker-compose.yml / .env.example 预置了公开的示例密钥
 * （JWT_SECRET=your-jwt-secret-here）。任何按 README 快速部署且未修改 .env 的实例，
 * 其 JWT 签名密钥是公开已知的，攻击者可以自行签发任意管理员身份令牌
 * （{userId, role, jti, tokenVersion}），造成完整的管理员接管。
 *
 * 这里在服务启动时 fail-fast：检测到弱密钥或缺失密钥则拒绝启动。
 */

// 公开仓库中出现过的示例值，等价于没有密钥
const KNOWN_PLACEHOLDER_SECRETS = [
  'your-jwt-secret-here',
  'your-very-secure-jwt-secret-key',
  'your-secret-key',
  'secret',
  'change-me',
  'jwt-secret',
  'voicehub-secret',
  '你的密钥',
  '你的jwt密钥'
]

const MIN_SECRET_LENGTH = 32

function validateJwtSecret(): void {
  const secret = String(process.env.JWT_SECRET || '').trim()
  const problems: string[] = []

  if (!secret) {
    problems.push('JWT_SECRET 未设置')
  } else if (KNOWN_PLACEHOLDER_SECRETS.includes(secret.toLowerCase())) {
    problems.push('JWT_SECRET 仍是公开示例值（攻击者可在 GitHub 上查到）')
  } else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(`JWT_SECRET 长度不足 ${MIN_SECRET_LENGTH} 位（当前 ${secret.length} 位）`)
  } else if (/^(.)\1+$/.test(secret)) {
    problems.push('JWT_SECRET 是单一字符重复，熵值过低')
  }

  if (problems.length === 0) return

  console.error('')
  console.error('╔══════════════════════════════════════════════════════════════╗')
  console.error('║  安全校验失败：拒绝启动                                       ║')
  console.error('╚══════════════════════════════════════════════════════════════╝')
  for (const problem of problems) {
    console.error(`  ✗ ${problem}`)
  }
  console.error('')
  console.error('  JWT_SECRET 用于签发登录会话与管理员令牌，一旦可预测即等于任意管理员接管。')
  console.error('  请生成一个高强度随机密钥后重新启动：')
  console.error('')
  console.error('      openssl rand -base64 48')
  console.error('')
  console.error('  然后写入 .env：  JWT_SECRET=<生成的值>')
  console.error('')
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    // 测试环境不阻断，避免影响现有测试
    return
  }
  process.exit(1)
}

export default defineNitroPlugin(() => {
  validateJwtSecret()
})