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

// 检查数据库schema是否包含当前代码依赖的关键对象。
async function checkSchemaConsistency(sql) {
  const requiredEnums = [
    ['user_status', ['graduate']],
    ['card_code_status', ['AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID']]
  ]
  const requiredTables = [
    'api_keys',
    'api_key_permissions',
    'api_logs',
    'CardCode',
    'CardCodeRedeemLog'
  ]
  const requiredColumns = {
    User: ['status', 'statusChangedAt', 'statusChangedBy', 'email', 'emailVerified'],
    Song: ['playUrl', 'submissionNote', 'submissionNotePublic', 'hitRequestId', 'cardCodeId'],
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
      'allowOAuthRegistration',
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
      'captchaMaxFailures'
    ]
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

  if (missing.length > 0) {
    warn(`检测到数据库schema不完整，缺少: ${missing.join(', ')}`)
    return false
  }

  return true
}

async function repairSchemaWithPush(sql) {
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
  } finally {
    await sql.end()
  }

  ok('数据库同步流程完成')
}

main().catch((e) => {
  err(`同步异常: ${e.message || e}`)
  process.exit(1)
})
