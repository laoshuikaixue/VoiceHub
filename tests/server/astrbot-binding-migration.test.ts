import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const dbSync = read('../../scripts/db-sync.js')
const deploy = read('../../scripts/deploy.js')

test('部署流程仍在迁移后调用 db-sync.js，且 db-sync 失败会中止部署', () => {
  assert.match(deploy, /execAsync\(process\.execPath, \['scripts\/db-sync\.js'\]/)
  assert.match(deploy, /throw new Error\('数据库同步失败，已终止部署[^']*'\)/)
  // 迁移必须先于构建，保证构建期读取的库结构已就绪。
  assert.match(deploy, /await syncDatabase\(\)\s*\n\s*await buildApplication\(\)/)
})

test('db-sync 升级路径会调用旧绑定搬迁，且搬迁在 schema 同步之后', () => {
  assert.match(dbSync, /await migrateLegacyAstrbotBindings\(sql\)/)
  const syncIndex = dbSync.indexOf('ok(\'legacy schema同步完成，迁移基线记录已写入\')')
  const migrateIndex = dbSync.indexOf('await migrateLegacyAstrbotBindings(sql)')
  assert.ok(syncIndex > -1 && migrateIndex > syncIndex, '搬迁必须在 schema 同步完成后执行')
})

test('已执行被取代的 AstrBot 迁移时，在任何 schema 写入前拒绝自动同步', () => {
  const guard = dbSync.indexOf('await rejectSupersededAstrbotMigrations(sql)')
  const usernameWrite = dbSync.indexOf('await ensureNoDuplicateUsernames(sql)')
  const migrate = dbSync.indexOf("safeExec('pnpm run db:migrate'")
  assert.ok(guard > -1 && guard < usernameWrite && guard < migrate)
  assert.match(dbSync, /FROM public\.__drizzle_migrations__/)
  assert.match(dbSync, /旧版 AstrBot 迁移已执行/)
})

test('旧绑定搬迁使用 ON CONFLICT DO NOTHING，冲突时不覆盖新表既有绑定', () => {
  const block = dbSync.slice(
    dbSync.indexOf('async function migrateLegacyAstrbotBindings'),
    dbSync.indexOf('// 检查数据库schema是否包含当前代码依赖的关键对象')
  )
  assert.match(block, /INSERT INTO "AstrbotBinding" \("userId", "platform", "adapter", "umo", "boundAt"\)/)
  assert.match(block, /ON CONFLICT DO NOTHING/)
  assert.match(block, /WHERE u\."astrbotUmo" IS NOT NULL/)
  // 不得出现覆盖式写入。
  assert.doesNotMatch(block, /ON CONFLICT[^;]*DO UPDATE/)
})

test('搬迁只归类受支持的适配器，未知适配器不猜测为 QQ 且告警跳过', () => {
  const block = dbSync.slice(
    dbSync.indexOf('const ASTRBOT_ADAPTER_PLATFORMS'),
    dbSync.indexOf('// 检查数据库schema是否包含当前代码依赖的关键对象')
  )
  for (const adapter of ['aiocqhttp', 'qq_official', 'qq_official_webhook']) {
    assert.match(block, new RegExp(`\\['${adapter}', 'qq'\\]`), `${adapter} 应归为 qq`)
  }
  assert.match(block, /\['wecom_ai_bot', 'wecom'\]/)
  assert.match(block, /\['dingtalk', 'dingtalk'\]/)
  assert.match(block, /\['lark', 'lark'\]/)
  assert.match(block, /无对应平台/)
  // 未命中映射表返回 null，不得回退成任何平台。
  assert.match(block, /const matched = ASTRBOT_ADAPTER_PLATFORMS\.find\(\(\[name\]\) => name === adapter\)\s*\n\s*return matched \? matched\[1\] : null/)
})

test('开关回填以 astrbotEnabled 与四平台全 false 为前置条件，已转换的记录不再改写', () => {
  const block = dbSync.slice(
    dbSync.indexOf('async function migrateLegacyAstrbotBindings'),
    dbSync.indexOf('// 检查数据库schema是否包含当前代码依赖的关键对象')
  )
  assert.ok(block.includes('WHERE "astrbotEnabled" = true'), '回填必须以 astrbotEnabled = true 为前置条件')
  assert.ok(
    block.includes(`AND "astrbotPlatforms" = '{"qq":false,"wecom":false,"dingtalk":false,"lark":false}'::jsonb`),
    '回填仅作用于仍为迁移默认值（四平台全 false）的记录，保证已转换的记录不被改写'
  )
  // 历史开启的站点延续 QQ；已有绑定的其它平台一并置 true。
  assert.ok(block.includes(`'qq', true`), 'astrbotEnabled 的站点需延续 QQ 开关')
  for (const platform of ['wecom', 'dingtalk', 'lark']) {
    assert.ok(
      block.includes(`"astrbotPlatforms"->>'${platform}')::boolean, false)`),
      `${platform} 需保留原开关值`
    )
    assert.ok(
      block.includes(`OR EXISTS (SELECT 1 FROM "AstrbotBinding" WHERE platform = '${platform}')`),
      `${platform} 有已有绑定时需置 true`
    )
  }
  // 不得无条件把 wecom/dingtalk/lark 写成 true（会打开管理员未启用的平台）。
  for (const platform of ['wecom', 'dingtalk', 'lark']) {
    assert.ok(!block.includes(`'${platform}', true`), `${platform} 不得无条件置 true`)
  }
})

test('仅在 AstrbotBinding 表与相关列存在时执行搬迁，缺失即跳过而非报错', () => {
  const block = dbSync.slice(
    dbSync.indexOf('async function migrateLegacyAstrbotBindings'),
    dbSync.indexOf('// 检查数据库schema是否包含当前代码依赖的关键对象')
  )
  assert.match(block, /if \(!\(await tableExists\(sql, 'AstrbotBinding'\)\)\) \{/)
  assert.match(block, /await columnExists\(sql, 'User', 'astrbotUmo'\)/)
  assert.match(block, /await columnExists\(sql, 'User', 'astrbotPlatform'\)/)
  assert.match(block, /await columnExists\(sql, 'User', 'astrbotBoundAt'\)/)
  assert.match(block, /await columnExists\(sql, 'SystemSettings', 'astrbotPlatforms'\)/)
  assert.match(block, /await columnExists\(sql, 'SystemSettings', 'astrbotEnabled'\)/)
  assert.match(block, /if \(!hasLegacyBindings && !hasPlatformsColumn\) \{\s*\n\s*log\([^)]*跳过[^)]*\)\s*\n\s*return/)
})

test('搬迁在一个事务里执行，失败即抛出以中止部署而非静默继续', () => {
  const block = dbSync.slice(
    dbSync.indexOf('async function migrateLegacyAstrbotBindings'),
    dbSync.indexOf('// 检查数据库schema是否包含当前代码依赖的关键对象')
  )
  assert.match(block, /await sql\.begin\(async \(tx\) => \{/)
  assert.match(block, /throw new Error\(`AstrBot 旧绑定搬迁失败，已中止部署/)
  assert.match(block, /catch \(e\) \{\s*\n\s*\/\//)
  // 顶部 main().catch 会把异常转为非零退出码。
  assert.match(dbSync, /main\(\)\.catch\(\(e\) => \{\s*\n\s*err\(`同步异常/)
  assert.match(dbSync, /process\.exit\(1\)/)
})

test('搬迁日志输出搬迁条数与跳过的用户', () => {
  const block = dbSync.slice(
    dbSync.indexOf('async function migrateLegacyAstrbotBindings'),
    dbSync.indexOf('// 检查数据库schema是否包含当前代码依赖的关键对象')
  )
  assert.match(block, /ok\(`AstrBot 旧绑定搬迁完成：新增绑定 \$\{result\.migrated\} 条，站点开关转换 \$\{result\.converted\} 个`\)/)
  assert.match(block, /warn\(\s*\n?\s*`AstrBot 旧绑定搬迁：跳过 \$\{row\.userIds\.length\} 个用户/)
})

test('schema 一致性检查覆盖 AstrBot 表与关键列', () => {
  const block = dbSync.slice(dbSync.indexOf('const requiredTables = ['))
  for (const table of ['AstrbotBinding', 'AstrbotOutbox', 'AstrbotBindingCode']) {
    assert.match(block, new RegExp(`'${table}'`), `${table} 必须列入 requiredTables`)
  }
  assert.match(block, /AstrbotOutbox: \['targetOwners'\]/)
  const settings = block.slice(block.indexOf('SystemSettings: ['), block.indexOf('AstrbotOutbox:'))
  assert.match(settings, /'astrbotPlatforms'/)
  assert.match(settings, /'astrbotEnabled'/)
})

test('无 DATABASE_URL 时早退且不报错', () => {
  assert.match(dbSync, /if \(!process\.env\.DATABASE_URL\) \{\s*\n\s*warn\('未设置 DATABASE_URL'\)\s*\n\s*process\.exit\(0\)/)
})

test('safe-migrate 迁移后同样调用 db-sync.js 完成回填，失败即中止', () => {
  const safeMigrate = read('../../scripts/safe-migrate.js')
  assert.match(safeMigrate, /scripts\/db-sync\.js/)
  assert.match(safeMigrate, /throw new Error\('数据库同步或 AstrBot 旧绑定回填失败'\)/)
  // 回填必须在迁移流程末尾执行。
  const migrateDone = safeMigrate.indexOf("log('✅ 数据库迁移流程完成！', 'green')")
  const backfill = safeMigrate.indexOf('scripts/db-sync.js')
  assert.ok(migrateDone > -1 && backfill > migrateDone, '回填必须排在迁移完成之后')
})

test('safe-migrate 在 push 或 migrate 前也拒绝被取代的 AstrBot 旧迁移链', () => {
  const safeMigrate = read('../../scripts/safe-migrate.js')
  const guard = safeMigrate.indexOf('await rejectSupersededAstrbotMigrations()')
  const push = safeMigrate.indexOf('drizzle-kit push --force --config=drizzle.config.ts')
  const migrate = safeMigrate.indexOf('pnpm run db:migrate')
  assert.ok(guard > -1 && guard < push && guard < migrate)
})
