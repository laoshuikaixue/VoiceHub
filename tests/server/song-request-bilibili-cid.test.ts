import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 真实运行 songRequestService 的投稿参数 schema。
 * 哔哩哔哩分P接口返回的 cid 为数字，schema 必须兼容数字并归一为字符串，
 * 否则分P投稿会被「expected string, received number」拒绝。
 */

const source = fileURLToPath(new URL('../../server/services/songRequestService.ts', import.meta.url))

const modules: Record<string, string> = {
  '~/drizzle/db': `export const db = {}; export const collaborationLogs = {}; export const playTimes = {};
    export const requestTimes = {}; export const schedules = {}; export const semesters = {};
    export const cardCodes = {}; export const songCollaborators = {}; export const songs = {}; export const users = {};`,
  'drizzle-orm': `export const and = () => {}; export const eq = () => {}; export const gte = () => {};
    export const gt = () => {}; export const inArray = () => {}; export const lt = () => {};
    export const lte = () => {}; export const or = () => {}; export const sql = () => {};`,
  h3: `export const createError = (opts) => Object.assign(new Error(opts.message), opts);`,
  '~~/server/services/durationValidationService': `export const reconcileSongDurationOnSubmit = async () => ({});`,
  '~~/server/utils/apiError': `export const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });`,
  '~~/server/services/notificationService': `export const createCollaborationInvitationNotification = async () => {};`,
  '~~/server/services/astrbotGroupService': `export const enqueueAstrbotGroupEvent = async () => 0;`,
  '~~/server/utils/submissionLimit': `export const findReachedGlobalSubmissionLimit = async () => null;
    export const getActiveGlobalSubmissionLimits = () => []; export const isCardCodeLimitBypassActive = () => false;
    export const isLimitReached = async () => false;`,
  '~~/server/utils/ip-utils': `export const getClientIP = () => 'unknown';`,
  '~/utils/timeUtils': `export const getBeijingTimeISOString = () => ''; export const getWeekdayLabel = () => '';`,
  '~~/server/utils/system-settings-helper': `export const getRolePermissionTemplatesCached = async () => ({});
    export const getSystemSettingsCached = async () => ({});`,
  '~~/app/utils/admin-permissions': `export const hasAdminPermission = () => false; export const resolveEffectivePermissions = () => [];`,
  '~~/server/utils/serverTime': `export const getServerDate = () => new Date();`,
  '~~/server/utils/play-slot': `export const getWeekdayOfDateString = () => 0; export const slotAppliesToWeekday = () => true;
    export const validatePlayDateString = () => ({ valid: true });`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES = {}; export const SONG_DURATION_MAX_SECONDS = 7200;
    export const SONG_DURATION_MIN_SECONDS = 0; export const SUBMISSION_NOTE_MAX_LENGTH = 300; export const SUBMISSION_NOTE_STATUS = { PENDING: 'PENDING' };`,
  '~~/server/utils/song-name-normalize': `export const normalizeForMatch = (value) => String(value);`,
  '~~/server/utils/submission-restriction-policy': `export const resolveSubmissionRestrictionPolicy = () => ({ mode: 'off' });`,
  '~~/server/utils/music-source-plugins/resolver': `export const readSelection = () => null;`
}

const compiled = await build({
  entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{
    name: 'song-request-schema-fixture',
    setup(b) {
      b.onResolve({ filter: /^(h3|drizzle-orm|~\/|~~\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
    }
  }]
})
const { songRequestBodySchema } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`
)

const base = { title: '测试歌曲', artist: '测试歌手' }

test('分P投稿的数字 cid 通过校验并归一为字符串', () => {
  const parsed = songRequestBodySchema.safeParse({
    ...base,
    musicPlatform: 'bilibili',
    musicId: 'BV1KxxC6vE1x',
    bilibiliCid: 1234567890,
    bilibiliPage: 2
  })
  assert.equal(parsed.success, true)
  assert.equal(parsed.data.bilibiliCid, '1234567890')
  assert.equal(parsed.data.bilibiliPage, 2)
})

test('字符串 cid 保持原有校验行为', () => {
  const parsed = songRequestBodySchema.safeParse({ ...base, bilibiliCid: ' 1234567890 ' })
  assert.equal(parsed.success, true)
  assert.equal(parsed.data.bilibiliCid, '1234567890')

  assert.equal(songRequestBodySchema.safeParse({ ...base, bilibiliCid: null }).success, true)
  assert.equal(songRequestBodySchema.safeParse(base).success, true)
  assert.equal(songRequestBodySchema.safeParse({ ...base, bilibiliCid: 'x'.repeat(101) }).success, false)
  assert.equal(songRequestBodySchema.safeParse({ ...base, bilibiliCid: {} }).success, false)
})