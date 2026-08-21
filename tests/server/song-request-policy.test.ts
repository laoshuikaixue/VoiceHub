import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { serverErrors as enServerErrors, songs as enSongs } from '../../app/utils/locale/en-US.ts'
import { serverErrors as zhServerErrors, songs as zhSongs } from '../../app/utils/locale/zh-CN.ts'
import { SERVER_ERROR_CODES } from '../../server/config/constants.ts'
import {
  executeIdempotentSongRequest,
  createImportSongRequestId,
  fingerprintSongRequest,
  isSongAdministrator,
  validateAdminSongAddBody
} from '../../server/utils/song-request-policy.ts'

function createStore() {
  const songs = []
  const calls = []
  return {
    songs,
    calls,
    async lockRequestIdentity(requestId) {
      calls.push(['lock', requestId])
    },
    async findSongByRequestId(requestId) {
      calls.push(['findRequestId', requestId])
      return songs.find((song) => song.requestId === requestId) ?? null
    }
  }
}

const request = {
  userId: 7,
  semester: '2026-2027-1',
  title: 'Song',
  artist: 'Artist',
  cover: 'https://example.com/cover.jpg',
  musicPlatform: 'bilibili',
  musicId: 'BV1:123:2',
  playUrl: 'https://example.com/play',
  submissionNote: '午间播放',
  submissionNotePublic: true,
  preferredPlayTimeId: 3,
  hitRequestId: 5,
  collaboratorIds: [9, 8, 9]
}

test('点歌请求完整指纹覆盖所有持久化业务字段并规范联合投稿人顺序', () => {
  const fingerprint = fingerprintSongRequest(request)
  assert.match(fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(fingerprintSongRequest({ ...request, collaboratorIds: [8, 9] }), fingerprint)

  for (const changed of [
    { userId: 8 },
    { semester: '2026-2027-2' },
    { title: 'Other Song' },
    { artist: 'Other Artist' },
    { cover: null },
    { musicPlatform: 'netease' },
    { musicId: '123' },
    { playUrl: null },
    { submissionNote: null },
    { submissionNotePublic: false },
    { preferredPlayTimeId: null },
    { hitRequestId: null },
    { collaboratorIds: [8] }
  ]) {
    assert.notEqual(fingerprintSongRequest({ ...request, ...changed }), fingerprint)
  }
})

test('点歌请求相同 requestId 和指纹复用既有歌曲', async () => {
  const store = createStore()
  store.songs.push({ id: 10, requestId: 'request-1', fingerprint: 'fingerprint-1' })
  let inserts = 0
  const result = await executeIdempotentSongRequest(store, {
    requestId: ' request-1 ',
    fingerprint: 'fingerprint-1',
    insertSong: async () => {
      inserts += 1
      return { id: 11 }
    }
  })
  assert.equal(result.id, 10)
  assert.equal(inserts, 0)
  assert.deepEqual(store.calls, [
    ['lock', 'request-1'],
    ['findRequestId', 'request-1']
  ])
})

test('点歌服务在读取可变配置前按 requestId 命中并校验原始载荷指纹', () => {
  const source = readFileSync(new URL('../../server/services/songRequestService.ts', import.meta.url), 'utf8')
  const idempotencyLookup = source.indexOf('findExistingSongRequest')
  assert.ok(idempotencyLookup > source.indexOf('const requestBody = parsedBody.data'))
  assert.ok(idempotencyLookup < source.indexOf('getCurrentSemesterName()'))
  assert.ok(idempotencyLookup < source.indexOf('getSystemSettingsCached()'))
  assert.ok(source.indexOf('fingerprintSongRequestPayload', idempotencyLookup) < source.indexOf('getCurrentSemesterName()'))
})

test('点歌服务事务内仍锁定 requestId 并复核载荷冲突', () => {
  const source = readFileSync(new URL('../../server/services/songRequestService.ts', import.meta.url), 'utf8')
  const transactionStart = source.indexOf('const song = await db.transaction')
  const transactionEnd = source.indexOf('return newSong', transactionStart)
  const transactionBlock = source.slice(transactionStart, transactionEnd)
  assert.match(transactionBlock, /executeIdempotentSongRequest/)
  assert.match(transactionBlock, /fingerprint:\s*requestFingerprint/)
})

test('点歌请求相同 requestId 但完整指纹不同时报冲突', async () => {
  const store = createStore()
  store.songs.push({ id: 10, requestId: 'request-1', fingerprint: 'fingerprint-1' })
  await assert.rejects(
    executeIdempotentSongRequest(store, {
      requestId: 'request-1',
      fingerprint: 'fingerprint-2',
      insertSong: async () => ({ id: 11 })
    }),
    (error) => error?.statusCode === 409 && error?.data?.code === 'SONG_REQUEST_IDEMPOTENCY_CONFLICT'
  )
})

test('点歌请求仅以 requestId 判定幂等，相同指纹的新 requestId 仍创建新歌曲', async () => {
  const store = createStore()
  store.songs.push({ id: 10, requestId: 'request-1', fingerprint: 'fingerprint-1' })
  const result = await executeIdempotentSongRequest(store, {
    requestId: 'request-2',
    fingerprint: 'fingerprint-1',
    insertSong: async () => ({ id: 11, requestId: 'request-2', fingerprint: 'fingerprint-1' })
  })
  assert.equal(result.id, 11)
  assert.deepEqual(store.calls, [
    ['lock', 'request-2'],
    ['findRequestId', 'request-2']
  ])
})

test('点歌管理员权限包含 SONG_ADMIN', () => {
  assert.equal(isSongAdministrator('USER'), false)
  assert.equal(isSongAdministrator('SONG_ADMIN'), true)
  assert.equal(isSongAdministrator('ADMIN'), true)
  assert.equal(isSongAdministrator('SUPER_ADMIN'), true)
})

test('导入子请求 ID 由意图批次、原始索引和源歌曲标识稳定派生', () => {
  assert.equal(
    createImportSongRequestId(' batch-1 ', 2, 35),
    'song-import:batch-1:2:35'
  )
  assert.throws(() => createImportSongRequestId('', 0, 35), /批次 ID/)
  assert.throws(() => createImportSongRequestId('batch-1', -1, 35), /索引/)
  assert.throws(() => createImportSongRequestId('batch-1', 0, 0), /源歌曲标识/)
})

test('导入意图批次在请求失败时复用并在请求完成后轮换', () => {
  const client = readFileSync(new URL('../../app/components/Songs/ImportSongsModal.vue', import.meta.url), 'utf8')
  const handlerStart = client.indexOf('const handleImport = async () =>')
  const requestBlock = client.slice(handlerStart, client.indexOf('} catch (e)', handlerStart))
  const catchBlock = client.slice(client.indexOf('} catch (e)', handlerStart), client.indexOf('} finally', handlerStart))
  assert.match(client, /const importBatchId = ref\(null\)/)
  assert.match(requestBlock, /importBatchId\.value \|\|= crypto\.randomUUID\(\)/)
  assert.match(requestBlock, /importBatchId:\s*importBatchId\.value/)
  assert.match(requestBlock, /importBatchId\.value = null/)
  assert.doesNotMatch(catchBlock, /importBatchId\.value = null/)
})

test('导入接口只使用意图批次派生子请求 ID', () => {
  const source = readFileSync(new URL('../../server/api/songs/import.post.ts', import.meta.url), 'utf8')
  assert.match(source, /const \{ songIds, importBatchId \} = body \|\| \{\}/)
  assert.match(source, /createImportSongRequestId\(importBatchId, index, song\.id\)/)
  assert.doesNotMatch(source, /event\.context\.requestId}:import/)
})

test('普通点歌与 open 点歌均显式使用幂等头', () => {
  const ordinary = readFileSync(new URL('../../server/api/songs/request.post.ts', import.meta.url), 'utf8')
  const open = readFileSync(new URL('../../server/api/open/songs/request.post.ts', import.meta.url), 'utf8')
  assert.match(ordinary, /requestSongForUser\(event, user, body, \{ requestId: idempotencyKey \}\)/)
  assert.match(open, /requestSongForUser\(event, user, payload, \{ requestId: idempotencyKey \}\)/)
})

test('useSongs 同载荷失败重试复用幂等键且成功后轮换', () => {
  const source = readFileSync(new URL('../../app/composables/useSongs.ts', import.meta.url), 'utf8')
  const requestStart = source.indexOf('const requestSong = async')
  const requestEnd = source.indexOf('// 投票', requestStart)
  const requestBlock = source.slice(requestStart, requestEnd)
  assert.match(requestBlock, /JSON\.stringify\(songData\)/)
  assert.match(requestBlock, /crypto\.randomUUID\(\)/)
  assert.match(requestBlock, /['"]Idempotency-Key['"]:\s*requestIdentity\.key/)
  assert.match(requestBlock, /pendingSongRequestIdentity\s*===\s*requestIdentity/)
  assert.match(requestBlock, /pendingSongRequestIdentity\s*=\s*null/)
  const catchBlock = requestBlock.slice(requestBlock.indexOf('catch'))
  assert.doesNotMatch(catchBlock, /pendingSongRequestIdentity\s*=\s*null/)
})

test('普通点歌接口读取 Idempotency-Key 并显式传给统一服务', () => {
  const source = readFileSync(new URL('../../server/api/songs/request.post.ts', import.meta.url), 'utf8')
  assert.match(source, /getHeader\(event, 'idempotency-key'\)/)
  assert.match(source, /requestId:\s*idempotencyKey/)
})

test('open 点歌强制要求 Idempotency-Key 请求头', () => {
  const source = readFileSync(new URL('../../server/api/open/songs/request.post.ts', import.meta.url), 'utf8')
  assert.match(source, /getHeader\(event,\s*['"]idempotency-key['"]\)/)
  assert.match(source, /if\s*\(!idempotencyKey\)/)
  assert.match(source, /requestId:\s*idempotencyKey/)
})

test('后台 add 从幂等头读取 requestId 且不自行生成 UUID', () => {
  const source = readFileSync(new URL('../../server/api/songs/add.post.ts', import.meta.url), 'utf8')
  assert.match(source, /getHeader\(event,\s*['"]idempotency-key['"]\)/)
  assert.match(source, /if\s*\(!idempotencyKey\)/)
  assert.match(source, /requestId:\s*idempotencyKey/)
  assert.doesNotMatch(source, /createIndependentSongRequestId/)
})

test('admin 前端生成幂等头并在失败后复用且成功后轮换', () => {
  const source = readFileSync(new URL('../../app/composables/useAdmin.ts', import.meta.url), 'utf8')
  const addStart = source.indexOf('const addSong = async')
  const addEnd = source.indexOf('return {', addStart)
  const addBlock = source.slice(addStart, addEnd)
  assert.match(addBlock, /JSON\.stringify\(songData\)/)
  assert.match(addBlock, /crypto\.randomUUID\(\)/)
  assert.match(addBlock, /['"]Idempotency-Key['"]:\s*requestIdentity\.key/)
  assert.match(addBlock, /pendingAddSongIdentity\s*===\s*requestIdentity/)
  assert.match(addBlock, /pendingAddSongIdentity\s*=\s*null/)
  const catchBlock = addBlock.slice(addBlock.indexOf('catch'))
  assert.doesNotMatch(catchBlock, /pendingAddSongIdentity\s*=\s*null/)
})

test('后台 add 接口禁止提交 requester 并始终使用当前用户', () => {
  assert.deepEqual(validateAdminSongAddBody({ title: 'Song', artist: 'Artist' }, 7), {
    title: 'Song',
    artist: 'Artist',
    requesterId: 7
  })
  assert.throws(
    () => validateAdminSongAddBody({ title: 'Song', artist: 'Artist', requester: 8 }, 7),
    (error) => error?.statusCode === 400 && error?.data?.code === 'COMMON_INVALID_PARAMS'
  )
})

test('协作者数据库写入失败会抛错并触发整笔事务回滚', () => {
  const source = readFileSync(new URL('../../server/services/songRequestService.ts', import.meta.url), 'utf8')
  const collaboratorBlock = source.slice(
    source.indexOf('for (const collaboratorId of uniqueCollaboratorIds)'),
    source.indexOf('return newSong')
  )
  assert.doesNotMatch(collaboratorBlock, /catch\s*\(err\)/)
})

test('投稿状态将 SONG_ADMIN 视为点歌管理员', () => {
  const source = readFileSync(new URL('../../server/api/songs/submission-status.get.ts', import.meta.url), 'utf8')
  assert.match(source, /isSongAdministrator\(user\.role\)/)
})

test('后台 add 接口复用 requestSongForUser', () => {
  const source = readFileSync(new URL('../../server/api/songs/add.post.ts', import.meta.url), 'utf8')
  assert.match(source, /requestSongForUser\(event, user, body(?:,|\))/)
  assert.doesNotMatch(source, /\.insert\(songs\)/)
})

test('后台添加歌曲表单不再提交统一点歌契约之外的旧字段', () => {
  const source = readFileSync(new URL('../../app/components/Admin/SongManagement.vue', import.meta.url), 'utf8')
  const payloadStart = source.indexOf('await addSong({')
  const addPayload = source.slice(payloadStart, source.indexOf('await refreshSongs()', payloadStart))
  assert.doesNotMatch(addPayload, /requester:/)
  assert.doesNotMatch(addPayload, /semester:/)
})

test('协作者站内通知与邀请同事务且外部通知仅在提交后发送', () => {
  const source = readFileSync(new URL('../../server/services/songRequestService.ts', import.meta.url), 'utf8')
  const transactionStart = source.indexOf('const song = await db.transaction')
  const transactionEnd = source.indexOf('for (const notification of notificationsToSend)')
  const transactionBlock = source.slice(transactionStart, transactionEnd)
  assert.ok(transactionEnd > transactionStart)
  assert.match(source, /if \(inserted && uniqueCollaboratorIds\.length > 0\)/)
  assert.match(transactionBlock, /await createCollaborationInvitationNotification\(\s*tx,/)
  assert.ok(source.indexOf('await sendCollaborationInvitationExternalNotification', transactionEnd) > transactionEnd)
})

test('事务内锁定投稿时段并按当前时间和容量重验', () => {
  const source = readFileSync(new URL('../../server/services/songRequestService.ts', import.meta.url), 'utf8')
  const transactionBlock = source.slice(source.indexOf('const song = await db.transaction'), source.indexOf('return newSong'))
  assert.match(transactionBlock, /getBeijingTimeISOString\(\)/)
  assert.match(transactionBlock, /\.for\(['"]update['"]\)/)
  assert.match(transactionBlock, /lte\(requestTimes\.startTime, transactionCurrentTime\)/)
  assert.match(transactionBlock, /gt\(requestTimes\.endTime, transactionCurrentTime\)/)
  assert.match(transactionBlock, /latestRequestTime\.accepted\s*>=\s*latestRequestTime\.expected/)
})

test('歌曲表仅约束 requestId 唯一，指纹只用于同 requestId 冲突校验', () => {
  const source = readFileSync(new URL('../../app/drizzle/schema.ts', import.meta.url), 'utf8')
  const songIndexes = source.slice(source.indexOf("export const songs = pgTable"), source.indexOf("export const songCollaborators"))
  assert.match(songIndexes, /uniqueIndex\(['"]song_request_id_unique['"]\)\.on\(table\.requestId\)/)
  assert.doesNotMatch(songIndexes, /uniqueIndex\(['"]song_fingerprint_unique['"]\)/)
})

test('点歌请求幂等冲突错误码在常量和双语词典中同步', () => {
  const code = 'SONG_REQUEST_IDEMPOTENCY_CONFLICT'
  assert.equal(SERVER_ERROR_CODES[code], code)
  assert.equal(typeof zhServerErrors[code], 'string')
  assert.equal(typeof enServerErrors[code], 'string')
})


test('投稿表单状态区读取统一额度并显示总、周期和永久额度', () => {
  const formSource = readFileSync(new URL('../../app/components/Songs/RequestForm.vue', import.meta.url), 'utf8')
  const displaySource = readFileSync(new URL('../../app/components/Songs/SongQuotaDisplay.vue', import.meta.url), 'utf8')

  // RequestForm 通过 SongQuotaDisplay 组件传递额度数据
  assert.match(formSource, /submissionStatus\.quota\?\.enabled/)
  assert.match(formSource, /<SongQuotaDisplay[\s\S]*?submissionStatus\.quota/)

  // SongQuotaDisplay 渲染额度文案和数值
  assert.match(displaySource, /locale\.totalQuota/)
  assert.match(displaySource, /quota\.totalBalance/)
  assert.match(displaySource, /locale\.periodicQuota/)
  assert.match(displaySource, /quota\.periodicBalance/)
  assert.match(displaySource, /locale\.permanentQuota/)
  assert.match(displaySource, /quota\.permanentBalance/)

  // RequestForm 不再使用旧的投稿限额字段
  assert.doesNotMatch(formSource, /submissionStatus\.(?:limitEnabled|dailyLimit|weeklyLimit|monthlyLimit|dailyUsed|weeklyUsed|monthlyUsed)/)
})

test('投稿表单仅在统一额度启用、余额为零且配置阻断时禁止投稿', () => {
  const source = readFileSync(new URL('../../app/components/Songs/RequestForm.vue', import.meta.url), 'utf8')
  const start = source.indexOf('const checkSubmissionLimit = () =>')
  const block = source.slice(start, source.indexOf('// URL验证函数', start))
  assert.match(block, /const quota = submissionStatus\.value\.quota/)
  assert.match(block, /quota\?\.enabled/)
  assert.match(block, /quota\.insufficientBlocked/)
  assert.match(block, /quota\.totalBalance\s*<=\s*0/)
  assert.match(block, /notifications\.quotaInsufficient/)
  assert.doesNotMatch(block, /limitEnabled|dailyLimit|weeklyLimit|monthlyLimit|dailyUsed|weeklyUsed|monthlyUsed/)
})

test('投稿表单统一额度文案保持双语结构一致', () => {
  for (const locale of [zhSongs.requestForm, enSongs.requestForm]) {
    assert.equal(typeof locale.totalQuota, 'string')
    assert.equal(typeof locale.periodicQuota, 'string')
    assert.equal(typeof locale.permanentQuota, 'string')
    assert.equal(typeof locale.notifications.quotaInsufficient, 'string')
  }
})
