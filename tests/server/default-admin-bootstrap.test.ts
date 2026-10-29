import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 部署引导的默认超级管理员守卫：硬编码口令必须按临时密码对待
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const CREATE_ADMIN = read('../../scripts/create-admin.js')
const CLEAR_DB = read('../../scripts/clear-database.js')
const README = read('../../README.md')

test('create-admin 用默认口令建超管时必须强制改密', () => {
  assert.match(CREATE_ADMIN, /const DEFAULT_ADMIN_PASSWORD = 'admin123'/, '默认口令常量缺失')
  assert.match(CREATE_ADMIN, /bcrypt\.hash\(DEFAULT_ADMIN_PASSWORD/, '建号仍应使用默认口令')
  assert.match(CREATE_ADMIN, /role: 'SUPER_ADMIN',\s*forcePasswordChange: true/, '默认口令账号必须置 forcePasswordChange')
  assert.doesNotMatch(CREATE_ADMIN, /forcePasswordChange: false/)
})

test('clear-database 重建默认超管时同样强制改密', () => {
  assert.match(CLEAR_DB, /role: 'SUPER_ADMIN',\s*forcePasswordChange: true/)
  assert.doesNotMatch(CLEAR_DB, /forcePasswordChange: false/)
})

test('存量超管仍在校验默认口令时被补上强制改密标记', () => {
  const detect = CREATE_ADMIN.match(/async function markDefaultPasswordSuperAdmins[\s\S]*?\n\}/)
  assert.ok(detect, '缺少存量默认口令检测')
  assert.match(
    detect[0],
    /if \(!account\.password \|\| account\.forcePasswordChange\) continue/,
    '无密码账号（如 OAuth 创建）与已标记账号不得被改写'
  )
  assert.match(
    detect[0],
    /bcrypt\.compare\(DEFAULT_ADMIN_PASSWORD, account\.password\)/,
    '只有口令确实是默认值才置位'
  )
  assert.match(detect[0], /forcePasswordChange: true/)
  assert.match(
    CREATE_ADMIN,
    /await markDefaultPasswordSuperAdmins\(existingSuperAdmin\)/,
    '已存在超管分支必须执行检测'
  )
})

test('默认口令在脚本内只定义一次', () => {
  const declarations = CREATE_ADMIN.match(/const DEFAULT_ADMIN_PASSWORD = 'admin123'/g) || []
  assert.equal(declarations.length, 1)
  assert.equal(CREATE_ADMIN.match(/bcrypt\.hash\(/g).length, 1, '建号处只允许一次默认口令哈希')
})

test('README 默认凭据说明同步首次登录改密要求', () => {
  const credentialBlocks = README.match(/默认口令按临时密码处理，首次登录需设置新密码/g) || []
  assert.equal(credentialBlocks.length, 2, 'Docker 与手动部署两处默认账号说明都要提示')
  const detectNotes = README.match(/启动时自动检测仍在使用默认口令的超级管理员/g) || []
  assert.equal(detectNotes.length, 2, '存量检测行为同样需两处说明')
  assert.match(README, /密码：admin123，首次登录需设置新密码/)
})
