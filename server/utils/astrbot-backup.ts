
import { astrbotBindings } from '~/drizzle/schema'
import { adapterToAstrbotPlatform, parseAstrbotPlatform } from './astrbot-platforms'
import { isAstrbotPrivateUmoShape } from './astrbot-notification'

// 老备份只有 User 上的单条绑定；新备份包含四个平台的独立记录。
export async function restoreAstrbotBindings(tx: any, userId: number, record: any) {
  if (!userId) return
  const bindings = Array.isArray(record.astrbotBindings) ? record.astrbotBindings :
    record.astrbotUmo ? [{ umo: record.astrbotUmo, adapter: record.astrbotPlatform,
      boundAt: record.astrbotBoundAt }] : []
  for (const binding of bindings) {
    const platform = adapterToAstrbotPlatform(binding.adapter)
    if (!platform || (binding.platform != null && parseAstrbotPlatform(binding.platform) !== platform) ||
      !isAstrbotPrivateUmoShape(binding.umo)) continue
    // boundAt 列非空：缺失时插入走 defaultNow，更新时保留库内既有值，禁止写 null
    const boundAt = binding.boundAt ? new Date(binding.boundAt) : null
    await tx.insert(astrbotBindings).values({ userId, platform, adapter: binding.adapter,
      umo: binding.umo, ...(boundAt ? { boundAt } : {}) })
      .onConflictDoUpdate({ target: [astrbotBindings.userId, astrbotBindings.platform],
        set: { adapter: binding.adapter, umo: binding.umo,
          ...(boundAt ? { boundAt } : {}) } })
  }
}
