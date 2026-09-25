import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import postgres from 'postgres'
import { MUSIC_PLUGIN_LIMITS } from '../server/config/constants.ts'
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
      } catch (error) {
        console.warn(`已跳过下载或验证失败的插件 ${row.id}${row.enabled ? '（该插件已启用，本次部署不提供其音源）' : ''}：${(error as Error)?.message || error}`)
      }
    }
  } finally { await client.end() }
}
const manifestPath = 'server/utils/music-source-plugins/manifest.snapshot.ts'
const buildId = randomUUID()
// 快照里含沙箱预置环境与下载的第三方脚本，任意字符都可能破坏巨型字符串字面量的转义，
// 因此统一用 base64 承载，生成的源码只含 ASCII，解码在运行时完成。
const payload = JSON.stringify({ mode, buildId, prelude, artifacts })
const payloadBytes = Buffer.byteLength(payload)
if (payloadBytes > MUSIC_PLUGIN_LIMITS.snapshotBytes) {
  const sizes = artifacts.map((artifact) => `${artifact.id} ${(artifact.source.length / 1024).toFixed(0)} KB`).join('、')
  throw new Error(`插件部署快照 ${(payloadBytes / 1048576).toFixed(1)} MB 超出上限 ${(MUSIC_PLUGIN_LIMITS.snapshotBytes / 1048576).toFixed(0)} MB，请减少插件数量或换用更小的脚本。各插件体积：${sizes || '无'}`)
}
const encoded = Buffer.from(payload, 'utf8').toString('base64')
const output = [
  '// 构建生成的受限脚本数据，请勿手工编辑。',
  "import type { PluginManifest } from './types'",
  '',
  'const encoded = [',
  ...(encoded.match(/.{1,1024}/g) || []).map((chunk) => `  '${chunk}',`),
  "].join('')",
  '',
  "export const pluginManifest: PluginManifest = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))",
  ''
].join('\n')
await writeFile(manifestPath, output)
if (await readFile(manifestPath, 'utf8') !== output) throw new Error('插件部署快照写入校验失败，产物内容与预期不一致')
console.info(`插件构建完成：${mode}，${artifacts.length} 个脚本`)
