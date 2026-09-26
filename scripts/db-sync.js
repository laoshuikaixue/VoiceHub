#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
import postgres from 'postgres'
config({ path: path.resolve(process.cwd(), '.env') })

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
}
const log = (msg, color = 'reset') => console.log(`${colors[color]}${msg}${colors.reset}`)
const ok = (msg) => log(`✅ ${msg}`, 'green')
const warn = (msg) => log(`⚠️  ${msg}`, 'yellow')
const err = (msg) => log(`❌ ${msg}`, 'red')

const NON_INTERACTIVE_ENV = {
  ...process.env,
  CI: 'true',
  DRIZZLE_KIT_FORCE: 'true',
  DRIZZLE_KIT_NON_INTERACTIVE: 'true',
  NODE_ENV: process.env.NODE_ENV || 'production'
}

function safeExec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options })
    return true
  } catch (e) {
    return false
  }
}

function fileExists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function ensureDrizzleFiles() {
  if (!fileExists('drizzle.config.ts')) throw new Error('Drizzle 配置文件不存在')
  if (!fileExists('app/drizzle/schema.ts')) throw new Error('Schema 文件不存在')
  if (!fileExists('app/drizzle/migrations/meta/_journal.json'))
    throw new Error('Drizzle journal 文件不存在')
}

function createSqlClient() {
  return postgres(process.env.DATABASE_URL, { max: 1 })
}

async function isEmptyDatabase(sql) {
  const result = await sql`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '__drizzle_migrations__'
  `

  return result[0]?.count === 0
}

async function hasMigrationRecords(sql) {
  const migrationTable = await sql`
    SELECT to_regclass('public.__drizzle_migrations__') AS table_name
  `

  if (!migrationTable[0]?.table_name) {
    return false
  }

  const result = await sql`
    SELECT COUNT(*)::int AS count
    FROM public.__drizzle_migrations__
  `

  return (result[0]?.count || 0) > 0
}

function loadMigrationJournalEntries() {
  const journalPath = path.resolve(process.cwd(), 'app/drizzle/migrations/meta/_journal.json')
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
  return [...journal.entries].sort((a, b) => a.when - b.when)
}

async function seedMissingMigrationRecords(sql) {
  const entries = loadMigrationJournalEntries()

  await sql`CREATE TABLE IF NOT EXISTS public.__drizzle_migrations__ (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`

  for (const entry of entries) {
    await sql`
      INSERT INTO public.__drizzle_migrations__ (hash, created_at)
      SELECT ${`legacy:${entry.tag}`}, ${entry.when}
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.__drizzle_migrations__
        WHERE created_at = ${entry.when}
      )
    `
  }
}

async function enumExists(sql, enumName) {
  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = ${enumName}
        AND t.typtype = 'e'
    ) AS exists
  `

  return result[0]?.exists === true
}

async function enumValueExists(sql, enumName, enumValue) {
  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname = 'public'
        AND t.typname = ${enumName}
        AND e.enumlabel = ${enumValue}
    ) AS exists
  `

  return result[0]?.exists === true
}

// user_status 枚举新增值显式幂等补齐
async function ensureUserStatusEnumValues(sql) {
  const pendingExists = await enumValueExists(sql, 'user_status', 'pending')
  if (!pendingExists) {
    const withdrawnExists = await enumValueExists(sql, 'user_status', 'withdrawn')
    if (withdrawnExists) {
      await sql`ALTER TYPE "public"."user_status" ADD VALUE 'pending' BEFORE 'withdrawn'`
    } else {
      await sql`ALTER TYPE "public"."user_status" ADD VALUE 'pending'`
    }
  }
  const rejectedExists = await enumValueExists(sql, 'user_status', 'rejected')
  if (!rejectedExists) {
    await sql`ALTER TYPE "public"."user_status" ADD VALUE 'rejected'`
  }
}

async function tableExists(sql, tableName) {
  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `

  return result[0]?.exists === true
}

async function columnExists(sql, tableName, columnName) {
  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS exists
  `

  return result[0]?.exists === true
}

async function indexExists(sql, tableName, indexName) {
  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ${tableName}
        AND indexname = ${indexName}
    ) AS exists
  `

  return result[0]?.exists === true
}

// 重复 username 会阻塞 User_username_unique 唯一索引的创建（push/migrate 均会失败）。
// 同步前把多余行重命名为 username_<后缀>，保留最早一行，保证唯一索引可创建。
async function ensureNoDuplicateUsernames(sql) {
  if (!(await tableExists(sql, 'User'))) return

  const duplicates = await sql`
    SELECT username, array_agg(id ORDER BY id) AS ids
    FROM "User"
    WHERE username IS NOT NULL
    GROUP BY username
    HAVING COUNT(*) > 1
  `

  if (duplicates.length === 0) return

  warn('检测到 User.username 重复值，重命名多余行以允许创建唯一索引')
  for (const dup of duplicates) {
    const [keptId, ...extraIds] = dup.ids
    for (const id of extraIds) {
      let suffix = 2
      let newUsername = `${dup.username}_${suffix}`
      while ((await sql`SELECT 1 FROM "User" WHERE username = ${newUsername} LIMIT 1`).length > 0) {
        suffix += 1
        newUsername = `${dup.username}_${suffix}`
      }
      await sql`UPDATE "User" SET username = ${newUsername} WHERE id = ${id}`
      warn(`User#${id}: ${dup.username} -> ${newUsername}（保留最早记录 User#${keptId}）`)
    }
  }
}

// 适配器到平台的归类，与 scripts/migrate-astrbot-bindings.ts 保持一致。
const ASTRBOT_ADAPTER_PLATFORMS = [
  ['aiocqhttp', 'qq'],
  ['qq_official', 'qq'],
  ['qq_official_webhook', 'qq'],
  ['wecom_ai_bot', 'wecom'],
  ['dingtalk', 'dingtalk'],
  ['lark', 'lark']
]

// 未识别适配器不得猜测为 QQ，返回 null 交由调用方跳过并告警。
function astrbotPlatformOf(adapter) {
  if (typeof adapter !== 'string') return null
  const matched = ASTRBOT_ADAPTER_PLATFORMS.find(([name]) => name === adapter)
  return matched ? matched[1] : null
}

// 升级时把 User 上的旧绑定搬迁到 AstrbotBinding，并把 astrbotEnabled=true 的站点开关延续到 astrbotPlatforms。
// 幂等：已存在的绑定不覆盖，已转换过（任一平台为 true）的开关不再改写；
// 表/列缺失时直接跳过，保证空库与新库路径不报错。搬迁失败即抛错终止部署。
async function migrateLegacyAstrbotBindings(sql) {
  if (!(await tableExists(sql, 'AstrbotBinding'))) {
    warn('未检测到 AstrbotBinding 表，跳过 AstrBot 旧绑定搬迁')
    return
  }

  const hasLegacyBindings =
    (await columnExists(sql, 'User', 'astrbotUmo')) &&
    (await columnExists(sql, 'User', 'astrbotPlatform')) &&
    (await columnExists(sql, 'User', 'astrbotBoundAt'))
  const hasPlatformsColumn =
    (await columnExists(sql, 'SystemSettings', 'astrbotPlatforms')) &&
    (await columnExists(sql, 'SystemSettings', 'astrbotEnabled'))

  if (!hasLegacyBindings && !hasPlatformsColumn) {
    log('AstrBot 旧绑定搬迁：数据库无旧绑定字段与开关列，跳过', 'cyan')
    return
  }

  let legacyRows = []
  if (hasLegacyBindings) {
    legacyRows = await sql`
      SELECT u."astrbotPlatform" AS adapter, array_agg(u.id ORDER BY u.id) AS "userIds"
      FROM "User" u
      WHERE u."astrbotUmo" IS NOT NULL
      GROUP BY u."astrbotPlatform"
    `
    for (const row of legacyRows) {
      if (astrbotPlatformOf(row.adapter)) continue
      warn(
        `AstrBot 旧绑定搬迁：跳过 ${row.userIds.length} 个用户（适配器 ${row.adapter ?? '<未设置>'} 无对应平台）: ${row.userIds
          .map((id) => `User#${id}`)
          .join(', ')}`
      )
    }
  }
  const knownAdapters = legacyRows.filter((row) => astrbotPlatformOf(row.adapter)).map((row) => row.adapter)

  try {
    const result = await sql.begin(async (tx) => {
      let migrated = 0
      if (knownAdapters.length > 0) {
        // 通过适配器->平台映射表 join 完成归类，未在映射表中的未知适配器自然被排除，不会被当作 QQ。
        const adapters = knownAdapters
        const platforms = knownAdapters.map((adapter) => astrbotPlatformOf(adapter))
        const inserted = await tx`
          INSERT INTO "AstrbotBinding" ("userId", "platform", "adapter", "umo", "boundAt")
          SELECT u.id, m.platform, u."astrbotPlatform", u."astrbotUmo", COALESCE(u."astrbotBoundAt", now())
          FROM "User" u
          JOIN unnest(${adapters}::text[], ${platforms}::text[]) AS m(adapter, platform)
            ON m.adapter = u."astrbotPlatform"
          WHERE u."astrbotUmo" IS NOT NULL
          ON CONFLICT DO NOTHING
          RETURNING "userId"
        `
        migrated = inserted.length
      }

      let converted = 0
      if (hasPlatformsColumn) {
        // 仅在四平台开关仍为迁移默认值（全 false，尚未转换）时改写：历史开启的站点延续 QQ，
        // 已有绑定的其它平台一并置 true；已转换过的记录不再触碰，避免覆盖管理员后续选择。
        const updated = await tx`
          UPDATE "SystemSettings" SET "astrbotPlatforms" = jsonb_build_object(
            'qq', true,
            'wecom', COALESCE(("astrbotPlatforms"->>'wecom')::boolean, false)
              OR EXISTS (SELECT 1 FROM "AstrbotBinding" WHERE platform = 'wecom'),
            'dingtalk', COALESCE(("astrbotPlatforms"->>'dingtalk')::boolean, false)
              OR EXISTS (SELECT 1 FROM "AstrbotBinding" WHERE platform = 'dingtalk'),
            'lark', COALESCE(("astrbotPlatforms"->>'lark')::boolean, false)
              OR EXISTS (SELECT 1 FROM "AstrbotBinding" WHERE platform = 'lark'))
          WHERE "astrbotEnabled" = true
            AND "astrbotPlatforms" = '{"qq":false,"wecom":false,"dingtalk":false,"lark":false}'::jsonb
          RETURNING "instance_id"
        `
        converted = updated.length
      }

      return { migrated, converted }
    })

    if (result.migrated === 0 && result.converted === 0) {
      log('AstrBot 旧绑定搬迁：无需变更', 'cyan')
    } else {
      ok(`AstrBot 旧绑定搬迁完成：新增绑定 ${result.migrated} 条，站点开关转换 ${result.converted} 个`)
    }
  } catch (e) {
    // 抛出交由 main 顶层处理：非零退出码会中止部署，不静默继续。
    throw new Error(`AstrBot 旧绑定搬迁失败，已中止部署: ${e.message || e}`, { cause: e })
  }
}

// 检查数据库schema是否包含当前代码依赖的关键对象。
async function checkSchemaConsistency(sql) {
  const requiredEnums = [
    ['user_status', ['graduate', 'pending', 'rejected']],
    ['card_code_status', ['AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID']]
  ]
  const requiredTables = [
    'api_keys',
    'api_key_permissions',
    'api_logs',
    'AstrbotBinding',
    'AstrbotOutbox',
    'AstrbotBindingCode',
    'BackupHistory',
    'CardCode',
    'CardCodeRedeemLog',
    'PasswordAuditLog',
    'PasswordRateLimit',
    'GradeClass',
    'auth_sessions'
  ]
  // 关键唯一索引（legacy 库可能缺失导致并发竞态/迁移失败）
  const requiredIndexes = [['User', 'User_username_unique']]
  const requiredColumns = {
    User: [
      'status',
      'statusChangedAt',
      'statusChangedBy',
      'email',
      'emailVerified',
      'tokenVersion',
      'remark',
      'avatarProvider',
      'avatarProviderUserId'
    ],
    Song: ['playUrl', 'submissionNote', 'submissionNotePublic', 'submissionNotePublicStatus', 'hitRequestId', 'cardCodeId'],
    song_replay_requests: ['submission_note', 'submission_note_public', 'submission_note_public_status'],
    user_status_logs: ['username', 'name'],
    Schedule: ['isDraft', 'publishedAt'],
    SystemSettings: [
      'instance_id',
      'telemetryEnabled',
      'smtpEnabled',
      'smtpHost',
      'smtpPort',
      'smtpSecure',
      'smtpUsername',
      'smtpPassword',
      'smtpFromEmail',
      'smtpFromName',
      'enableRequestTimeLimitation',
      'forceBlockAllRequests',
      'enableReplayRequests',
      'enableCollaborativeSubmission',
      'enableSubmissionRemarks',
      'enableCardCodeRequests',
      'requireCardCodeForRequests',
      'enableCardCodeLimitBypass',
      'captchaProvider',
      'turnstileSiteKey',
      'turnstileSecretKey',
      'esaCaptchaPrefix',
      'esaCaptchaScenes',
      'esaCaptchaRegion',
      'forcePasswordChangeOnFirstLogin',
      'allowOAuthRegistration',
      'allowRegister',
      'registerRequiresApproval',
      'oauthRegisterRequiresApproval',
      'registerEmailRequired',
      'registerRequiresGradeClass',
      'submissionNoteRequiresApproval',
      'defaultTheme',
      'enabledThemes',
      'oauthRedirectUri',
      'oauthStateSecret',
      'oauthProviders',
      'githubOAuthEnabled',
      'githubClientId',
      'githubClientSecret',
      'casdoorOAuthEnabled',
      'casdoorServerUrl',
      'casdoorClientId',
      'casdoorClientSecret',
      'casdoorOrganizationName',
      'googleOAuthEnabled',
      'googleClientId',
      'googleClientSecret',
      'aggregateOAuthEnabled',
      'aggregateOAuthAppId',
      'aggregateOAuthAppKey',
      'aggregateOAuthLoginType',
      'aggregateOAuthEndpoint',
      'customOAuthEnabled',
      'customOAuthDisplayName',
      'customOAuthAuthorizeUrl',
      'customOAuthTokenUrl',
      'customOAuthUserInfoUrl',
      'customOAuthScope',
      'customOAuthClientId',
      'customOAuthClientSecret',
      'customOAuthUserIdField',
      'customOAuthUsernameField',
      'customOAuthNameField',
      'customOAuthEmailField',
      'customOAuthAvatarField',
      'captchaEnabled',
      'captchaMaxFailures',
      'autoBackupEnabled',
      'autoBackupConfig',
      'astrbotEnabled',
      'astrbotPlatforms'
    ],
    AstrbotOutbox: ['targetOwners'],
    PasswordAuditLog: [
      'userId',
      'actorId',
      'action',
      'success',
      'ipAddress',
      'userAgent',
      'failureReason',
      'createdAt'
    ],
    PasswordRateLimit: ['key', 'count', 'resetAt']
  }

  const missing = []

  for (const [enumName, enumValues] of requiredEnums) {
    if (!(await enumExists(sql, enumName))) {
      missing.push(`${enumName} enum type`)
      continue
    }

    for (const enumValue of enumValues) {
      if (!(await enumValueExists(sql, enumName, enumValue))) {
        missing.push(`${enumName}.${enumValue} enum value`)
      }
    }
  }

  for (const tableName of requiredTables) {
    if (!(await tableExists(sql, tableName))) {
      missing.push(`${tableName} table`)
    }
  }

  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    for (const columnName of columns) {
      if (!(await columnExists(sql, tableName, columnName))) {
        missing.push(`${tableName}.${columnName} column`)
      }
    }
  }

  for (const [tableName, indexName] of requiredIndexes) {
    if (!(await indexExists(sql, tableName, indexName))) {
      missing.push(`${tableName}.${indexName} index`)
    }
  }

  if (missing.length > 0) {
    warn(`检测到数据库schema不完整，缺少: ${missing.join(', ')}`)
    return false
  }

  return true
}

async function repairSchemaWithPush(sql) {
  // 先补齐枚举值，再执行 push
  await ensureUserStatusEnumValues(sql)
  const pushCommand = 'pnpm exec drizzle-kit push --force --config=drizzle.config.ts'
  if (
    !safeExec(pushCommand, {
      env: { ...NON_INTERACTIVE_ENV, DRIZZLE_KIT_NON_INTERACTIVE: 'true' }
    })
  ) {
    err('数据库schema修复失败')
    return false
  }

  if (!(await checkSchemaConsistency(sql))) {
    err('push 后数据库schema仍不完整')
    return false
  }

  // push 只同步结构，不会写入迁移表；补齐记录可避免后续 migrate 重放已存在的结构。
  await seedMissingMigrationRecords(sql)
  ok('强制同步完成，迁移记录已补齐')
  return true
}

async function main() {
  log('🔄 数据库同步', 'cyan')

  if (!process.env.DATABASE_URL) {
    warn('未设置 DATABASE_URL')
    process.exit(0)
  }

  ensureDrizzleFiles()

  const sql = createSqlClient()

  try {
    const emptyDb = await isEmptyDatabase(sql)
    if (emptyDb) {
      log('🆕 检测到空库，执行迁移 (migrate)...', 'cyan')
      if (!safeExec('pnpm run db:migrate', { env: NON_INTERACTIVE_ENV })) {
        err('数据库迁移失败')
        process.exit(1)
      }
      if (!(await checkSchemaConsistency(sql))) {
        err('空库迁移后数据库schema仍不完整')
        process.exit(1)
      }
      ok('空库迁移完成')
    } else {
      // 重复 username 会阻塞唯一索引创建（push/migrate 均失败），先修复数据再同步
      await ensureNoDuplicateUsernames(sql)
      const migrationRecordsExist = await hasMigrationRecords(sql)
      if (migrationRecordsExist) {
        // 正常数据库必须先应用待执行迁移，再检查最终结构；否则新增字段会被误判为schema损坏。
        log('🔁 检测到迁移记录，先执行 migrate 同步...', 'cyan')
        const migrateSuccess = safeExec('pnpm run db:migrate', {
          env: { ...NON_INTERACTIVE_ENV, DRIZZLE_KIT_NON_INTERACTIVE: 'true' }
        })

        const schemaConsistent = migrateSuccess && (await checkSchemaConsistency(sql))
        if (migrateSuccess && schemaConsistent) {
          ok('migrate 同步成功')
        } else {
          if (migrateSuccess) {
            warn('migrate 已执行，但数据库schema仍不完整。')
          } else {
            warn('migrate 同步失败，可能是由于数据库结构与迁移记录不一致。')
          }
          log('🔄 尝试使用 push --force 进行强制同步...', 'cyan')
          if (!(await repairSchemaWithPush(sql))) {
            err('数据库同步完全失败。请检查数据库连接或迁移文件。')
            process.exit(1)
          }
        }
      } else {
        warn('检测到 legacy 数据库迁移记录为空，检查schema并写入迁移基线。')
        const schemaConsistent = await checkSchemaConsistency(sql)

        if (!schemaConsistent) {
          log('🔄 legacy schema不完整，尝试使用 push --force 进行同步...', 'cyan')
          if (!(await repairSchemaWithPush(sql))) {
            process.exit(1)
          }
        } else {
          await seedMissingMigrationRecords(sql)
        }
        ok('legacy schema同步完成，迁移基线记录已写入')
      }
    }

    // schema 就绪后再搬迁 AstrBot 旧绑定与站点开关，失败即抛错中止部署。
    await migrateLegacyAstrbotBindings(sql)
  } finally {
    await sql.end()
  }

  ok('数据库同步流程完成')
}

main().catch((e) => {
  err(`同步异常: ${e.message || e}`)
  process.exit(1)
})
