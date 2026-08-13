import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fingerprintQuotaAdjustment,
  fingerprintSongQuotaConsumption,
  getQuotaPeriodWindow,
  mergeAndValidateSongQuotaSettings,
  migrateLegacyQuotaSettings,
  resolveQuotaReturn,
  selectQuotaConsumption,
  validateSongQuotaSettings
} from '../../server/utils/song-quota-policy.ts'

test('点歌额度策略按北京时间计算日周期', () => {
  assert.deepEqual(getQuotaPeriodWindow('DAILY', new Date('2026-08-10T16:00:00.000Z')), {
    periodKey: '2026-08-11',
    nextRefreshAt: new Date('2026-08-11T16:00:00.000Z')
  })
})

test('点歌额度策略按北京时间计算周周期', () => {
  assert.deepEqual(getQuotaPeriodWindow('WEEKLY', new Date('2026-08-11T04:00:00.000Z')), {
    periodKey: '2026-W33',
    nextRefreshAt: new Date('2026-08-16T16:00:00.000Z')
  })
})

test('点歌额度策略按北京时间计算月周期', () => {
  assert.deepEqual(getQuotaPeriodWindow('MONTHLY', new Date('2026-08-31T15:59:59.999Z')), {
    periodKey: '2026-08',
    nextRefreshAt: new Date('2026-08-31T16:00:00.000Z')
  })
})

test('点歌额度策略优先消费周期额度并以永久额度兜底', () => {
  assert.deepEqual(selectQuotaConsumption({ periodicBalance: 1, permanentBalance: 3 }), {
    quotaType: 'PERIODIC',
    nextPeriodicBalance: 0,
    nextPermanentBalance: 3
  })
  assert.deepEqual(selectQuotaConsumption({ periodicBalance: 0, permanentBalance: 2 }), {
    quotaType: 'PERMANENT',
    nextPeriodicBalance: 0,
    nextPermanentBalance: 1
  })
  assert.equal(selectQuotaConsumption({ periodicBalance: 0, permanentBalance: 0 }), null)
})

test('点歌额度策略拒绝非法余额', () => {
  assert.throws(
    () => selectQuotaConsumption({ periodicBalance: -1, permanentBalance: 2 }),
    /额度余额必须是非负安全整数/
  )
  assert.throws(
    () => selectQuotaConsumption({ periodicBalance: 1.5, permanentBalance: 2 }),
    /额度余额必须是非负安全整数/
  )
})

test('点歌额度策略只返还当前周期额度且永久额度始终返还', () => {
  assert.equal(resolveQuotaReturn('PERIODIC', '2026-W33', '2026-W33'), 'RETURNED')
  assert.equal(resolveQuotaReturn('PERIODIC', '2026-W33', '2026-W34'), 'EXPIRED')
  assert.equal(resolveQuotaReturn('PERMANENT', null, '2026-W34'), 'RETURNED')
})

test('点歌额度策略迁移唯一启用的旧投稿限额', () => {
  assert.deepEqual(
    migrateLegacyQuotaSettings({
      enableSubmissionLimit: true,
      dailySubmissionLimit: null,
      weeklySubmissionLimit: 5,
      monthlySubmissionLimit: null
    }),
    {
      songQuotaEnabled: true,
      songQuotaPeriodType: 'WEEKLY',
      songQuotaPeriodAmount: 5,
      adminSongQuotaExempt: true,
      blockOnSongQuotaInsufficient: true
    }
  )
})

test('点歌额度策略遇到多个旧投稿限额时保持关闭', () => {
  assert.deepEqual(
    migrateLegacyQuotaSettings({
      enableSubmissionLimit: true,
      dailySubmissionLimit: 2,
      weeklySubmissionLimit: 5,
      monthlySubmissionLimit: null
    }),
    {
      songQuotaEnabled: false,
      songQuotaPeriodType: null,
      songQuotaPeriodAmount: null,
      adminSongQuotaExempt: true,
      blockOnSongQuotaInsufficient: true
    }
  )
})

test('配置迁移在旧投稿限额关闭时保持额度关闭', () => {
  assert.deepEqual(
    migrateLegacyQuotaSettings({
      enableSubmissionLimit: false,
      dailySubmissionLimit: 2,
      weeklySubmissionLimit: null,
      monthlySubmissionLimit: null
    }),
    {
      songQuotaEnabled: false,
      songQuotaPeriodType: null,
      songQuotaPeriodAmount: null,
      adminSongQuotaExempt: true,
      blockOnSongQuotaInsufficient: true
    }
  )
})

test('配置合并校验使用持久化周期和数量校验局部更新', () => {
  assert.deepEqual(
    mergeAndValidateSongQuotaSettings(
      {
        songQuotaEnabled: false,
        songQuotaPeriodType: 'WEEKLY',
        songQuotaPeriodAmount: 5
      },
      { songQuotaEnabled: true }
    ),
    {
      settings: {
        songQuotaEnabled: true,
        songQuotaPeriodType: 'WEEKLY',
        songQuotaPeriodAmount: 5
      },
      validation: { valid: true, reason: null }
    }
  )
})

test('配置合并校验拒绝局部更新形成的非法启用配置', () => {
  assert.deepEqual(
    mergeAndValidateSongQuotaSettings(
      {
        songQuotaEnabled: false,
        songQuotaPeriodType: 'DAILY',
        songQuotaPeriodAmount: 5
      },
      { songQuotaEnabled: true, songQuotaPeriodType: null }
    ).validation,
    { valid: false, reason: 'INVALID_PERIOD_TYPE' }
  )
})

test('点歌额度策略校验启用配置的周期与数量', () => {
  assert.deepEqual(
    validateSongQuotaSettings({
      songQuotaEnabled: true,
      songQuotaPeriodType: 'DAILY',
      songQuotaPeriodAmount: 3
    }),
    { valid: true, reason: null }
  )
  assert.deepEqual(
    validateSongQuotaSettings({
      songQuotaEnabled: true,
      songQuotaPeriodType: 'YEARLY',
      songQuotaPeriodAmount: 3
    }),
    { valid: false, reason: 'INVALID_PERIOD_TYPE' }
  )
  assert.deepEqual(
    validateSongQuotaSettings({
      songQuotaEnabled: true,
      songQuotaPeriodType: 'DAILY',
      songQuotaPeriodAmount: 0
    }),
    { valid: false, reason: 'INVALID_PERIOD_AMOUNT' }
  )
})

test('点歌额度策略生成稳定的消费指纹且包含 requestId', () => {
  const first = fingerprintSongQuotaConsumption({ userId: 7, requestId: 'request-1' })
  const second = fingerprintSongQuotaConsumption({ requestId: 'request-1', userId: 7 })
  const other = fingerprintSongQuotaConsumption({ userId: 7, requestId: 'request-2' })
  assert.equal(first, second)
  assert.notEqual(first, other)
  assert.match(first, /^[a-f0-9]{64}$/)
})

test('点歌额度策略生成稳定且覆盖审计字段的调整指纹', () => {
  const firstInput = {
    userId: 7,
    delta: 2,
    externalReference: 'order-1',
    publicDescription: '活动奖励',
    internalNote: '内部备注'
  }
  const reorderedInput = {
    internalNote: '内部备注',
    publicDescription: '活动奖励',
    externalReference: 'order-1',
    delta: 2,
    userId: 7
  }
  const changedAuditInput = {
    ...firstInput,
    internalNote: '另一条内部备注'
  }
  const first = fingerprintQuotaAdjustment(firstInput)
  const reordered = fingerprintQuotaAdjustment(reorderedInput)
  const changedAudit = fingerprintQuotaAdjustment(changedAuditInput)
  assert.equal(first, reordered)
  assert.notEqual(first, changedAudit)
  assert.match(first, /^[a-f0-9]{64}$/)
})
