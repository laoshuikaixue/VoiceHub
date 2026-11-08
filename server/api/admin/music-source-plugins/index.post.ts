import { pluginAccess } from '~~/server/utils/music-source-plugins/access'
import { savePlugin } from '~~/server/utils/music-source-plugins/store'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  await pluginAccess(event, true)
  const body = await readBody(event)
  const id = await savePlugin(body, Number(body.revision))
  // 插件变量是加密存储的凭据，审计只记录脚本来源与协议
  await recordAdminAudit(event, 'plugin.create', {
    targetType: 'plugin',
    targetId: id,
    summary: { name: body?.name, scriptUrl: body?.scriptUrl, protocol: body?.protocol }
  })
  return { id }
})
