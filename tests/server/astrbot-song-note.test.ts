import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (relative: string) => readFileSync(join(HERE, '../..', relative), 'utf8')

const SONG_REQUEST = read('server/api/bot/voicehub/song-request.post.ts')
const CONSTANTS = read('server/config/constants.ts')

// ----------------------------------------------------------------------
// 「未开启留言」不能静默丢字
// ----------------------------------------------------------------------

test('站点未开启留言功能时提交带留言的点歌必须报错，而不是静默丢弃', () => {
  // songRequestService 的 `enableSubmissionRemarks && rawSubmissionNote` 会让留言
  // 静默变 null；机器人端点若不前置校验，回复「点歌成功」而留言已丢。
  assert.match(
    SONG_REQUEST,
    /enableSubmissionRemarks/,
    '端点须读取 enableSubmissionRemarks 判定留言是否被站点接受'
  )
  assert.match(
    SONG_REQUEST,
    /ASTRBOT_SONG_NOTE_DISABLED/,
    '须用稳定的错误码拒绝，便于插件侧与站点侧文案对齐'
  )
})

test('留言长度上限是站点单一权威，三处共用同一数值', () => {
  assert.match(CONSTANTS, /export const SUBMISSION_NOTE_MAX_LENGTH = 300/)
  // 端点与投稿校验都引用该常量，而不是各写一份 300
  assert.match(SONG_REQUEST, /SUBMISSION_NOTE_MAX_LENGTH/)
  assert.match(read('server/services/songRequestService.ts'), /SUBMISSION_NOTE_MAX_LENGTH/)
})

test('留言错误码登记在站点集中错误码表', () => {
  assert.match(CONSTANTS, /ASTRBOT_SONG_NOTE_DISABLED: 'ASTRBOT_SONG_NOTE_DISABLED'/)
})

// ----------------------------------------------------------------------
// 留言随投稿下发
// ----------------------------------------------------------------------

test('端点把 note 映射为 submissionNote 并保持站点默认公开语义', () => {
  assert.match(SONG_REQUEST, /submissionNote: note/)
  // 站点 RequestForm 的 submissionNotePublic 默认 true；机器人侧不改变该默认
  assert.doesNotMatch(
    SONG_REQUEST,
    /submissionNotePublic:\s*false/,
    '不得把机器人投稿的留言默认改为不公开'
  )
})

// ----------------------------------------------------------------------
// 插件侧 JVM 风格参数契约
// ----------------------------------------------------------------------

const SONG_PY = readFileSync(
  join(HERE, '../../../astrbot_plugin_voicehub/lib/song.py'),
  'utf8'
)

test('插件解析器按 - 前缀识别参数并支持乱序', () => {
  assert.match(SONG_PY, /PICK_NOTE_KEYS/, '须定义留言参数键名')
  assert.match(SONG_PY, /def _parse_flag/, '须有 -键 值 的参数解析')
  assert.match(SONG_PY, /note=args\.note/, '投稿调用必须带上解析出的留言')
})

test('插件不再把 note 参数漏在请求体之外', () => {
  assert.match(SONG_PY, /payload\["note"\] = /)
})
