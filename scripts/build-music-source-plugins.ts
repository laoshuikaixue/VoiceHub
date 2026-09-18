import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import postgres from 'postgres'
import { preparePrelude, downloadScript } from '../server/utils/music-source-plugins/prepare.ts'
import { runPlugin } from '../server/utils/music-source-plugins/runtime.ts'
import { unseal } from '../server/utils/music-source-plugins/tickets.ts'
import type { PluginArtifact, PluginProtocol } from '../server/utils/music-source-plugins/types.ts'

config({ quiet: true })
const preset = process.env.VERCEL ? 'vercel' : process.env.NETLIFY ? 'netlify' : process.env.NITRO_PRESET || 'node-server'
const mode = preset === 'node-server' ? 'hot' : 'snapshot'
const prelude = await preparePrelude()
const artifacts: PluginArtifact[] = []
if (mode === 'snapshot') {
  if (!process.env.DATABASE_URL) throw new Error('插件部署快照需要 DATABASE_URL')
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
  try {
    const rows = await client.begin('isolation level repeatable read read only', async (tx) => tx`
      SELECT p.id, p.enabled, r.revision, r."scriptUrl", r.protocol, r.variables
      FROM "MusicSourcePlugin" p JOIN "MusicSourcePluginRevision" r
      ON r."pluginId" = p.id AND r.revision = p."desiredRevision"
      WHERE p."deletedAt" IS NULL ORDER BY p.priority, p.id
    `)
    for (const row of rows) {
      try {
        const code = await downloadScript(row.scriptUrl)
        const protocol = row.protocol as PluginProtocol
        const { capability } = await runPlugin({ prelude, source: code.source, protocol, variables: unseal(row.variables, 'variables') })
        artifacts.push({ id: row.id, revision: row.revision, protocol, ...code, capability })
      } catch {
        if (row.enabled) throw new Error(`插件 ${row.id} 下载或验证失败，部署已终止`)
        console.warn(`已跳过未启用且验证失败的插件 ${row.id}`)
      }
    }
  } finally { await client.end() }
}
const manifest = { mode, buildId: randomUUID(), prelude, artifacts }
await writeFile('server/utils/music-source-plugins/manifest.ts', `// 构建生成的受限脚本数据。\nimport type { PluginManifest } from './types'\nexport const pluginManifest: PluginManifest = ${JSON.stringify(manifest)}\n`)
console.info(`插件构建完成：${mode}，${artifacts.length} 个脚本`)
