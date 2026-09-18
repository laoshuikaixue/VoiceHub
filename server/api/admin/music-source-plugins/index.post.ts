import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { savePlugin } from '~~/server/utils/music-source-plugins/store'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const body = await readBody(event)
  return { id: await savePlugin(body, Number(body.revision)) }
})
