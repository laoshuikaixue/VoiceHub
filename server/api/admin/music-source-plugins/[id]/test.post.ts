import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { artifactFor, listPluginRows, pluginRevision, prelude } from '~~/server/utils/music-source-plugins/store'
import { runPlugin } from '~~/server/utils/music-source-plugins/runtime'
import { unseal } from '~~/server/utils/music-source-plugins/tickets'
import { pluginError } from '~~/server/utils/music-source-plugins/errors'
import { getServerTimestamp } from '~~/server/utils/serverTime'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const row = (await listPluginRows()).find((p) => p.id === getRouterParam(event, 'id'))
  if (!row) throw pluginError('PLUGIN_UNAVAILABLE', 404)
  const artifact = await artifactFor({ ...row, enabled: true })
  if (!artifact) throw pluginError('PLUGIN_UNAVAILABLE')
  const revision = await pluginRevision(row.id, artifact.revision)
  const started = getServerTimestamp()
  const { capability } = await runPlugin({ source: artifact.source, protocol: artifact.protocol, prelude: await prelude(), variables: unseal(revision.variables, 'variables') })
  return { success: true, elapsed: getServerTimestamp() - started, protocol: capability.protocol, revision: artifact.revision }
})
