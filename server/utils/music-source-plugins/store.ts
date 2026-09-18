import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { musicSourcePlugins as plugins, musicSourcePluginRevisions as revisions, musicSourceConfigState as state } from '~/drizzle/schema'
import { MUSIC_PLUGIN_CATALOGS, MUSIC_PLUGIN_LIMITS, MUSIC_PLUGIN_PROTOCOLS } from '../../config/constants'
import { getServerDate } from '../serverTime'
import { pluginManifest } from './manifest'
import { pluginError } from './errors'
import { seal, unseal } from './tickets'
import { networkUrl } from './network'
import { extractPluginName, runPlugin } from './runtime'
import type { PluginArtifact, PluginCapability, PluginProtocol } from './types'

const artifactRoot = join(process.cwd(), '.data', 'music-source-plugins')
const inflight = new Map<string, Promise<PluginArtifact>>()
export const snapshotMode = () => pluginManifest.mode === 'snapshot'
export async function prelude() {
  return pluginManifest.prelude || (await import('./prepare')).preparePrelude()
}
export const listPluginRows = () => db.select().from(plugins).where(isNull(plugins.deletedAt)).orderBy(asc(plugins.priority), asc(plugins.id))
export async function pluginRevision(id: string, revision: number) {
  const [row] = await db.select().from(revisions).where(and(eq(revisions.pluginId, id), eq(revisions.revision, revision))).limit(1)
  if (!row) throw pluginError('PLUGIN_UNAVAILABLE')
  return row
}
export async function configRevision() {
  const [row] = await db.select().from(state).where(eq(state.id, 1))
  return row?.revision || 0
}

export function validatePluginInput(input: any) {
  const name = String(input?.name || '').trim()
  const scriptUrl = String(input?.scriptUrl || '').trim()
  const protocol = input?.protocol || 'auto'
  const catalog = input?.catalog || null
  if (name.length > 100 || !MUSIC_PLUGIN_PROTOCOLS.includes(protocol) || (catalog && !MUSIC_PLUGIN_CATALOGS.includes(catalog))) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  networkUrl(scriptUrl)
  const variables = input?.variables
  if (variables !== undefined && (variables === null || typeof variables !== 'object' || Array.isArray(variables) || Object.keys(variables).length > 30 || Object.values(variables).some((v) => typeof v !== 'string') || JSON.stringify(variables).length > 16000)) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  const legacyPlatformKey = input?.legacyPlatformKey ? String(input.legacyPlatformKey).trim() : null
  if (legacyPlatformKey && !/^[\w\u4e00-\u9fa5-]{1,100}$/.test(legacyPlatformKey)) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  return { name, scriptUrl, protocol: protocol as PluginProtocol, catalog, variables, legacyPlatformKey }
}

function fallbackPluginName(scriptUrl: string) {
  try {
    const value = decodeURIComponent(new URL(scriptUrl).pathname.split('/').pop() || '').replace(/\.(?:m?js|cjs)$/i, '').trim()
    return value.slice(0, 100) || '插件音源'
  } catch {
    return '插件音源'
  }
}

type PluginSource = { source: string; hash: string }
type PreparedPlugin = { code: PluginSource; capability: PluginCapability; revision?: number }

const pickPluginName = (value: unknown) => {
  const name = typeof value === 'string' ? value.trim() : ''
  return name.length > 0 && name.length <= 100 ? name : ''
}

/**
 * 名称为空时从脚本自身读取：优先用沙箱初始化得到的插件名称，
 * 初始化失败则退到脚本注释里的 @name，仍无结果时使用直链文件名。
 * 下载或初始化失败不阻断保存，加载状态由刷新流程记录。
 */
async function resolvePluginName(data: ReturnType<typeof validatePluginInput>, id?: string): Promise<{ data: ReturnType<typeof validatePluginInput>; prepared: PreparedPlugin | null }> {
  if (data.name) return { data, prepared: null }
  let variables = data.variables
  if (variables === undefined && id) {
    const [row] = await db.select().from(plugins).where(and(eq(plugins.id, id), isNull(plugins.deletedAt)))
    if (row) {
      const [revision] = await db.select().from(revisions).where(and(eq(revisions.pluginId, id), eq(revisions.revision, row.desiredRevision))).limit(1)
      if (revision) { try { variables = unseal(revision.variables, 'variables') } catch { /* JWT_SECRET 变过，旧参数解不开时按无参数继续解析名称 */ } }
    }
  }
  const { downloadScript } = await import('./prepare')
  let code: PluginSource
  try {
    code = await downloadScript(data.scriptUrl)
  } catch {
    return { data: { ...data, name: fallbackPluginName(data.scriptUrl) }, prepared: null }
  }
  const commentName = pickPluginName(extractPluginName(code.source))
  try {
    const { capability } = await runPlugin({ source: code.source, protocol: data.protocol, prelude: await prelude(), variables })
    const name = pickPluginName(capability?.name) || commentName || fallbackPluginName(data.scriptUrl)
    return { data: { ...data, name }, prepared: { code, capability } }
  } catch {
    return { data: { ...data, name: commentName || fallbackPluginName(data.scriptUrl) }, prepared: null }
  }
}

async function mutate<T>(expected: number, action: (tx: any) => Promise<T>) {
  if (!Number.isInteger(expected) || expected < 0) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  return db.transaction(async (tx) => {
    await tx.insert(state).values({ id: 1, revision: 0 }).onConflictDoNothing()
    const [row] = await tx.update(state).set({ revision: sql`${state.revision} + 1` }).where(and(eq(state.id, 1), eq(state.revision, expected))).returning()
    if (!row) throw pluginError('PLUGIN_CONFIG_CONFLICT', 409)
    return action(tx)
  })
}

export async function savePlugin(input: any, expected: number, id?: string) {
  const { data, prepared } = await resolvePluginName(validatePluginInput(input), id)
  const pluginId = id || randomUUID()
  let revision = 1
  await mutate(expected, async (tx) => {
    const [old] = id ? await tx.select().from(plugins).where(and(eq(plugins.id, id), isNull(plugins.deletedAt))) : []
    if (id && !old) throw pluginError('PLUGIN_UNAVAILABLE', 404)
    const rows = await tx.select({ id: plugins.id }).from(plugins).where(isNull(plugins.deletedAt))
    if (!old && rows.length >= MUSIC_PLUGIN_LIMITS.count) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
    revision = old ? old.desiredRevision + 1 : 1
    // legacyPlatformKey 的唯一索引不排除软删行，提前校验避免直接抛数据库 23505
    if (data.legacyPlatformKey) {
      const [conflict] = await tx.select({ id: plugins.id }).from(plugins).where(and(eq(plugins.legacyPlatformKey, data.legacyPlatformKey), ne(plugins.id, pluginId))).limit(1)
      if (conflict) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
    }
    let variables = data.variables === undefined && old ? (await tx.select().from(revisions).where(and(eq(revisions.pluginId, id!), eq(revisions.revision, old.desiredRevision))))[0]?.variables : undefined
    variables ||= seal(data.variables || {}, 'variables')
    if (old) await tx.update(plugins).set({ name: data.name, legacyPlatformKey: data.legacyPlatformKey, desiredRevision: revision, lastError: null, updatedAt: getServerDate() }).where(eq(plugins.id, pluginId))
    else await tx.insert(plugins).values({ id: pluginId, name: data.name, legacyPlatformKey: data.legacyPlatformKey, priority: rows.length })
    await tx.insert(revisions).values({ pluginId, revision, scriptUrl: data.scriptUrl, protocol: data.protocol, catalog: data.catalog, variables })
  })
  // 名称来自脚本自动提取时已下载并初始化过一次，直接复用避免重复执行
  if (!snapshotMode()) await refreshPlugin(pluginId, prepared ? { ...prepared, revision } : undefined).catch(() => undefined)
  return pluginId
}

export async function setPluginEnabled(id: string, enabled: boolean, expected: number) {
  await mutate(expected, async (tx) => {
    // 重新启用时清掉旧的失败标记，否则 artifactFor 的失败闩会让它永远不重试
    const rows = await tx.update(plugins).set(enabled ? { enabled, lastError: null, updatedAt: getServerDate() } : { enabled, updatedAt: getServerDate() }).where(and(eq(plugins.id, id), isNull(plugins.deletedAt))).returning()
    if (!rows.length) throw pluginError('PLUGIN_UNAVAILABLE', 404)
  })
}
export async function removePlugin(id: string, expected: number) {
  await mutate(expected, async (tx) => {
    await tx.update(plugins).set({ deletedAt: getServerDate(), enabled: false }).where(eq(plugins.id, id))
  })
}
export async function orderPlugins(ids: string[], expected: number) {
  await mutate(expected, async (tx) => {
    const rows = await tx.select({ id: plugins.id }).from(plugins).where(isNull(plugins.deletedAt))
    if (!Array.isArray(ids) || ids.length !== rows.length || new Set(ids).size !== ids.length || rows.some((p: { id: string }) => !ids.includes(p.id))) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
    for (const [priority, id] of ids.entries()) await tx.update(plugins).set({ priority }).where(eq(plugins.id, id))
  })
}

async function storeArtifact(artifact: PluginArtifact) {
  await mkdir(artifactRoot, { recursive: true })
  const target = join(artifactRoot, `${artifact.id}-${artifact.revision}-${artifact.hash}.json`)
  const temporary = `${target}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(artifact), { mode: 0o600 })
  await rename(temporary, target)
}

export async function refreshPlugin(id: string, prepared?: PreparedPlugin): Promise<PluginArtifact> {
  if (snapshotMode()) throw pluginError('PLUGIN_UNAVAILABLE', 409)
  const [row] = await db.select().from(plugins).where(and(eq(plugins.id, id), isNull(plugins.deletedAt)))
  if (!row) throw pluginError('PLUGIN_UNAVAILABLE', 404)
  const key = `${id}:${row.desiredRevision}`
  const previous = inflight.get(key)
  if (previous) return previous
  const task = (async () => {
    try {
      const revision = await pluginRevision(id, row.desiredRevision)
      const reused = prepared && prepared.revision === revision.revision ? prepared : undefined
      const { downloadScript } = await import('./prepare')
      const code = reused?.code || await downloadScript(revision.scriptUrl)
      const capability = reused?.capability || (await runPlugin({ source: code.source, protocol: revision.protocol as PluginProtocol, prelude: await prelude(), variables: unseal(revision.variables, 'variables') })).capability
      const artifact: PluginArtifact = { id, revision: revision.revision, protocol: revision.protocol as PluginProtocol, ...code, capability }
      await storeArtifact(artifact)
      await db.update(plugins).set({ activeRevision: artifact.revision, activeHash: artifact.hash, lastError: null, updatedAt: getServerDate() }).where(and(eq(plugins.id, id), eq(plugins.desiredRevision, artifact.revision), isNull(plugins.deletedAt)))
      return artifact
    } catch (error) {
      const code = String((error as any)?.data?.code || (error as any)?.statusMessage || 'PLUGIN_LOAD_FAILED')
      console.error(`[插件音源] 插件 ${id} 第 ${row.desiredRevision} 版加载失败 ${code}:`, (error as Error)?.message || error)
      await db.update(plugins).set({ lastError: code }).where(and(eq(plugins.id, id), eq(plugins.desiredRevision, row.desiredRevision)))
      throw pluginError('PLUGIN_LOAD_FAILED')
    }
  })().finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}

export async function artifactFor(row: typeof plugins.$inferSelect): Promise<PluginArtifact | null> {
  if (!row.enabled || row.deletedAt) return null
  if (snapshotMode()) return pluginManifest.artifacts.find((p) => p.id === row.id) || null
  if (!row.activeHash || !row.activeRevision) {
    if (row.lastError) return null
    return refreshPlugin(row.id).catch(() => null)
  }
  try {
    if (!/^[a-f0-9]{64}$/.test(row.activeHash)) return null
    const value = JSON.parse(await readFile(join(artifactRoot, `${row.id}-${row.activeRevision}-${row.activeHash}.json`), 'utf8')) as PluginArtifact
    const { codeHash } = await import('./prepare')
    if (value.id !== row.id || value.revision !== row.activeRevision || codeHash(value.source) !== row.activeHash) return null
    return value
  } catch {
    const key = `recover:${row.id}:${row.activeHash}`
    const previous = inflight.get(key)
    if (previous) return previous.catch(() => null)
    const recovering = (async () => {
      const revision = await pluginRevision(row.id, row.activeRevision!)
      const { downloadScript } = await import('./prepare')
      const code = await downloadScript(revision.scriptUrl)
      if (code.hash !== row.activeHash) throw pluginError('PLUGIN_LOAD_FAILED')
      const { capability } = await runPlugin({ source: code.source, protocol: revision.protocol as PluginProtocol, prelude: await prelude(), variables: unseal(revision.variables, 'variables') })
      const artifact: PluginArtifact = { id: row.id, revision: revision.revision, protocol: revision.protocol as PluginProtocol, ...code, capability }
      await storeArtifact(artifact)
      return artifact
    })().finally(() => inflight.delete(key))
    inflight.set(key, recovering)
    return recovering.catch(() => null)
  }
}

export async function availablePlugins() {
  const result: { row: typeof plugins.$inferSelect; artifact: PluginArtifact }[] = []
  for (const row of await listPluginRows()) {
    const artifact = await artifactFor(row)
    if (artifact) result.push({ row, artifact })
  }
  return result
}

export async function pluginAdminView() {
  const data = []
  for (const row of await listPluginRows()) {
    // 期望版本行缺失（如恢复中断留下的孤儿数据）时退到现存最新版本，保证列表仍可访问、可删除
    const [desired] = await db.select().from(revisions).where(eq(revisions.pluginId, row.id)).orderBy(desc(revisions.revision)).limit(1)
    const artifact = snapshotMode() ? pluginManifest.artifacts.find((p) => p.id === row.id) : row.activeRevision ? await artifactFor({ ...row, enabled: true }) : null
    let variablesInvalid = false
    // 参数解密失败只说明 JWT_SECRET 变过，不代表产物加载失败，单独标记避免误报为更新失败
    if (desired) { try { unseal(desired.variables, 'variables') } catch { variablesInvalid = true } }
    data.push({ id: row.id, name: row.name, enabled: row.enabled, priority: row.priority, desiredRevision: row.desiredRevision, activeRevision: artifact?.revision || null, lastError: desired ? row.lastError : (row.lastError || 'PLUGIN_UNAVAILABLE'), variablesInvalid, legacyPlatformKey: row.legacyPlatformKey, protocol: desired?.protocol || null, catalog: desired?.catalog || null, scriptUrl: desired?.scriptUrl || '', capability: artifact?.capability || null })
  }
  return { data, revision: await configRevision(), mode: snapshotMode() ? 'snapshot' : 'hot', buildId: pluginManifest.buildId }
}
