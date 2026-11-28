import { and, eq, gt } from 'drizzle-orm'
import type { db } from '~/drizzle/db'
import { astrbotBindTickets, astrbotBindings, systemSettings } from '~/drizzle/schema'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { createApiError } from './apiError'
import { ASTRBOT_PLATFORMS, isAstrbotPlatformEnabled } from './astrbot-platforms'
import { getServerDate } from './serverTime'

type TicketReader = Pick<typeof db, 'select'>

export function loadAstrbotBindSettings(executor: TicketReader, lock = false) {
  const query = executor.select({
    token: systemSettings.astrbotToken,
    enabled: systemSettings.astrbotEnabled,
    platforms: systemSettings.astrbotPlatforms
  }).from(systemSettings).limit(1)
  return lock ? query.for('share') : query
}

export function isAstrbotBindingConfigChange(
  before: typeof systemSettings.$inferSelect,
  after: typeof systemSettings.$inferSelect
) {
  return before.astrbotToken !== after.astrbotToken ||
    before.astrbotEnabled !== after.astrbotEnabled ||
    ASTRBOT_PLATFORMS.some(platform =>
      isAstrbotPlatformEnabled(before.astrbotPlatforms, platform) !==
      isAstrbotPlatformEnabled(after.astrbotPlatforms, platform)
    )
}

export function invalidAstrbotBindTicket() {
  return createApiError(400, SERVER_ERROR_CODES.ASTRBOT_BIND_TICKET_INVALID, '绑定链接无效、已过期或已使用')
}

export function loadAstrbotBindTicket(executor: TicketReader, tokenHash: string) {
  return executor.select().from(astrbotBindTickets).where(and(
    eq(astrbotBindTickets.tokenHash, tokenHash),
    gt(astrbotBindTickets.expiresAt, getServerDate())
  )).limit(1)
}

export function loadOwnAstrbotBinding(executor: TicketReader, userId: number, platform: string) {
  return executor.select().from(astrbotBindings).where(and(
    eq(astrbotBindings.userId, userId),
    eq(astrbotBindings.platform, platform)
  )).limit(1)
}

export function isSameAstrbotBinding(
  binding: { adapter: string; umo: string } | undefined,
  target: { adapter: string; umo: string }
) {
  return binding?.umo === target.umo && binding.adapter === target.adapter
}

export function describeAstrbotBindChat(target: { adapter: string; umo: string }) {
  const [instance, , chatId] = target.umo.split(':')
  return { adapter: target.adapter, instance, chatId }
}
