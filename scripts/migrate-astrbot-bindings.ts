import postgres from 'postgres'
import { config } from 'dotenv'

config()
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置')
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
try {
  await sql.begin(async (tx) => {
    const legacyColumns = await tx`SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'User'
        AND column_name IN ('astrbotUmo', 'astrbotPlatform', 'astrbotBoundAt')`
    const columns = new Set(legacyColumns.map((row) => row.column_name))
    const rows = columns.has('astrbotUmo') && columns.has('astrbotPlatform')
      ? columns.has('astrbotBoundAt')
        ? await tx`SELECT id, "astrbotUmo" AS umo, "astrbotPlatform" AS adapter, COALESCE("astrbotBoundAt", now()) AS bound_at
          FROM "User" WHERE "astrbotUmo" IS NOT NULL FOR UPDATE`
        : await tx`SELECT id, "astrbotUmo" AS umo, "astrbotPlatform" AS adapter, now() AS bound_at
          FROM "User" WHERE "astrbotUmo" IS NOT NULL FOR UPDATE`
      : []
    const platformOf = (adapter: string) => {
      if (['aiocqhttp', 'qq_official', 'qq_official_webhook'].includes(adapter)) return 'qq'
      if (adapter === 'wecom_ai_bot') return 'wecom'
      if (adapter === 'dingtalk') return 'dingtalk'
      if (adapter === 'lark') return 'lark'
      return null
    }
    for (const row of rows) {
      const platform = platformOf(row.adapter)
      if (!platform) {
        console.warn(`跳过用户 ${row.id} 的未知适配器 ${row.adapter}`)
        continue
      }
      await tx`INSERT INTO "AstrbotBinding" ("userId", "platform", "adapter", "umo", "boundAt")
        VALUES (${row.id}, ${platform}, ${row.adapter}, ${row.umo}, ${row.bound_at})
        ON CONFLICT DO NOTHING`
    }
    // 历史开启的站点延续 QQ 开关；其他已有绑定的平台也保留可用。
    await tx`UPDATE "SystemSettings" SET "astrbotPlatforms" =
      jsonb_build_object('qq', "astrbotEnabled" OR COALESCE(("astrbotPlatforms"->>'qq')::boolean, false),
        'wecom', COALESCE(("astrbotPlatforms"->>'wecom')::boolean, false) OR EXISTS (SELECT 1 FROM "AstrbotBinding" WHERE platform = 'wecom'),
        'dingtalk', COALESCE(("astrbotPlatforms"->>'dingtalk')::boolean, false) OR EXISTS (SELECT 1 FROM "AstrbotBinding" WHERE platform = 'dingtalk'),
        'lark', COALESCE(("astrbotPlatforms"->>'lark')::boolean, false) OR EXISTS (SELECT 1 FROM "AstrbotBinding" WHERE platform = 'lark'))
      WHERE "astrbotEnabled" = true AND "astrbotPlatforms" =
        '{"qq":false,"wecom":false,"dingtalk":false,"lark":false}'::jsonb`
  })
} finally {
  await sql.end()
}
