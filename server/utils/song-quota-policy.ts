import { createHash } from 'node:crypto'
import {
  SONG_QUOTA_PERIODS,
  type SongQuotaPeriod,
  type SongQuotaType
} from '../config/constants.ts'

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function toBeijingDate(now: Date): Date {
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
}

function toUtcFromBeijing(date: Date): Date {
  return new Date(date.getTime() - BEIJING_OFFSET_MS)
}

function getIsoWeek(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const year = target.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return { year, week }
}

export function getQuotaPeriodWindow(periodType: SongQuotaPeriod, now: Date) {
  const beijingNow = toBeijingDate(now)
  const year = beijingNow.getUTCFullYear()
  const month = beijingNow.getUTCMonth()
  const date = beijingNow.getUTCDate()

  if (periodType === 'DAILY') {
    const next = new Date(Date.UTC(year, month, date + 1))
    return {
      periodKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`,
      nextRefreshAt: toUtcFromBeijing(next)
    }
  }

  if (periodType === 'WEEKLY') {
    const { year: weekYear, week } = getIsoWeek(beijingNow)
    const weekday = beijingNow.getUTCDay() || 7
    const next = new Date(Date.UTC(year, month, date + (8 - weekday)))
    return {
      periodKey: `${weekYear}-W${String(week).padStart(2, '0')}`,
      nextRefreshAt: toUtcFromBeijing(next)
    }
  }

  const next = new Date(Date.UTC(year, month + 1, 1))
  return {
    periodKey: `${year}-${String(month + 1).padStart(2, '0')}`,
    nextRefreshAt: toUtcFromBeijing(next)
  }
}

export function selectQuotaConsumption(balance: {
  periodicBalance: number
  permanentBalance: number
}) {
  if (
    !Number.isSafeInteger(balance.periodicBalance) ||
    balance.periodicBalance < 0 ||
    !Number.isSafeInteger(balance.permanentBalance) ||
    balance.permanentBalance < 0
  ) {
    throw new RangeError('额度余额必须是非负安全整数')
  }

  if (balance.periodicBalance > 0) {
    return {
      quotaType: 'PERIODIC' as const,
      nextPeriodicBalance: balance.periodicBalance - 1,
      nextPermanentBalance: balance.permanentBalance
    }
  }

  if (balance.permanentBalance > 0) {
    return {
      quotaType: 'PERMANENT' as const,
      nextPeriodicBalance: balance.periodicBalance,
      nextPermanentBalance: balance.permanentBalance - 1
    }
  }

  return null
}

export function resolveQuotaReturn(
  quotaType: SongQuotaType,
  consumedPeriodKey: string | null,
  currentPeriodKey: string
) {
  if (quotaType === 'PERMANENT' || consumedPeriodKey === currentPeriodKey) {
    return 'RETURNED' as const
  }
  return 'EXPIRED' as const
}

export function validateSongQuotaSettings(settings: {
  songQuotaEnabled: boolean
  songQuotaPeriodType: unknown
  songQuotaPeriodAmount: unknown
}) {
  if (!settings.songQuotaEnabled) {
    return { valid: true as const, reason: null }
  }
  if (
    typeof settings.songQuotaPeriodType !== 'string' ||
    !SONG_QUOTA_PERIODS.includes(settings.songQuotaPeriodType as SongQuotaPeriod)
  ) {
    return { valid: false as const, reason: 'INVALID_PERIOD_TYPE' as const }
  }
  if (
    typeof settings.songQuotaPeriodAmount !== 'number' ||
    !Number.isInteger(settings.songQuotaPeriodAmount) ||
    settings.songQuotaPeriodAmount <= 0
  ) {
    return { valid: false as const, reason: 'INVALID_PERIOD_AMOUNT' as const }
  }
  return { valid: true as const, reason: null }
}

export function mergeAndValidateSongQuotaSettings(
  current: {
    songQuotaEnabled: boolean | null
    songQuotaPeriodType: unknown
    songQuotaPeriodAmount: unknown
  },
  patch: Partial<{
    songQuotaEnabled: boolean
    songQuotaPeriodType: unknown
    songQuotaPeriodAmount: unknown
  }>
) {
  const settings = {
    songQuotaEnabled: patch.songQuotaEnabled ?? current.songQuotaEnabled ?? false,
    songQuotaPeriodType: Object.prototype.hasOwnProperty.call(patch, 'songQuotaPeriodType')
      ? patch.songQuotaPeriodType
      : current.songQuotaPeriodType,
    songQuotaPeriodAmount: Object.prototype.hasOwnProperty.call(patch, 'songQuotaPeriodAmount')
      ? patch.songQuotaPeriodAmount
      : current.songQuotaPeriodAmount
  }
  return {
    settings,
    validation: validateSongQuotaSettings(settings)
  }
}

export function migrateLegacyQuotaSettings(settings: {
  enableSubmissionLimit: boolean
  dailySubmissionLimit: number | null
  weeklySubmissionLimit: number | null
  monthlySubmissionLimit: number | null
  enableCardCodeRequests: boolean
  requireCardCodeForRequests: boolean
}) {
  const candidates = [
    ['DAILY', settings.dailySubmissionLimit],
    ['WEEKLY', settings.weeklySubmissionLimit],
    ['MONTHLY', settings.monthlySubmissionLimit]
  ].filter((entry): entry is [SongQuotaPeriod, number] =>
    typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] > 0
  )
  const canMigrate = settings.enableSubmissionLimit && candidates.length === 1
  const selected = canMigrate ? candidates[0] : null

  return {
    songQuotaEnabled: Boolean(selected),
    songQuotaPeriodType: selected?.[0] ?? null,
    songQuotaPeriodAmount: selected?.[1] ?? null,
    adminSongQuotaExempt: true,
    blockOnSongQuotaInsufficient: true,
    legacyCardConversionEnabled:
      settings.enableCardCodeRequests || settings.requireCardCodeForRequests
  }
}

export function fingerprintSongQuotaConsumption(input: {
  userId: number
  requestId: string
}) {
  return createHash('sha256')
    .update(JSON.stringify({ userId: input.userId, requestId: input.requestId }))
    .digest('hex')
}

export function fingerprintQuotaAdjustment(input: {
  userId: number
  delta: number
  externalReference?: string | null
  publicDescription?: string | null
  operation?: string | null
  internalNote?: string | null
  administratorId?: number | null
}) {
  const payload = JSON.stringify({
    userId: input.userId,
    delta: input.delta,
    externalReference: input.externalReference ?? null,
    publicDescription: input.publicDescription ?? null,
    operation: input.operation ?? null,
    internalNote: input.internalNote ?? null,
    administratorId: input.administratorId ?? null
  })
  return createHash('sha256').update(payload).digest('hex')
}
