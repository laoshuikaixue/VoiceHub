import { and, eq } from 'drizzle-orm'
import { musicSourcePlugins, musicSourcePluginRevisions, musicSourceConfigState } from '~/drizzle/schema'
import { getServerDate } from '../serverTime'
import { validatePluginInput } from './store'
import { pluginError } from './errors'

export const pluginBackupTables = { musicSourcePlugins, musicSourcePluginRevisions, musicSourceConfigState }
export async function restorePluginRecord(tx: any, tableName: string, record: any) {
  if (tableName === 'musicSourcePlugins') {
    if (!/^[a-f0-9-]{36}$/i.test(record.id) || !record.name || !Number.isInteger(record.desiredRevision)) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
    const data = { id: record.id, name: String(record.name).slice(0, 100), enabled: record.enabled === true, priority: Number(record.priority) || 0, desiredRevision: record.desiredRevision, activeRevision: null, activeHash: null, legacyPlatformKey: record.legacyPlatformKey || null, lastError: null, updatedAt: getServerDate(), deletedAt: record.deletedAt ? getServerDate() : null }
    await tx.insert(musicSourcePlugins).values(data).onConflictDoUpdate({ target: musicSourcePlugins.id, set: data })
  } else if (tableName === 'musicSourcePluginRevisions') {
    validatePluginInput({ name: '恢复插件', scriptUrl: record.scriptUrl, protocol: record.protocol, catalog: record.catalog })
    if (!Number.isInteger(record.revision) || record.revision < 1 || typeof record.variables !== 'string') throw pluginError('PLUGIN_INVALID_CONFIG', 400)
    const data: Record<string, any> = { pluginId: record.pluginId, revision: record.revision, scriptUrl: record.scriptUrl, protocol: record.protocol, catalog: record.catalog || null, variables: record.variables }
    const [existing] = await tx.select().from(musicSourcePluginRevisions).where(and(eq(musicSourcePluginRevisions.pluginId, record.pluginId), eq(musicSourcePluginRevisions.revision, record.revision)))
    if (existing && ['scriptUrl', 'protocol', 'catalog', 'variables'].some((key) => existing[key] !== data[key])) throw pluginError('PLUGIN_CONFIG_CONFLICT', 409)
    await tx.insert(musicSourcePluginRevisions).values(data).onConflictDoNothing()
  } else if (tableName === 'musicSourceConfigState') {
    await tx.insert(musicSourceConfigState).values({ id: 1, revision: (Number(record.revision) || 0) + 1 }).onConflictDoUpdate({ target: musicSourceConfigState.id, set: { revision: (Number(record.revision) || 0) + 1 } })
  }
}
