import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 网易云时长取数只允许在 songDurationFetcher 里实现一次，避免接口与后台任务两处各自拼参数
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const FETCHER = read('../../server/utils/songDurationFetcher.ts')
const DURATION_API = read('../../server/api/admin/songs/duration.post.ts')

test('网易云时长取数函数由 fetcher 统一导出', () => {
  for (const name of ['fetchNeteaseSongSeconds', 'fetchNeteasePodcastSeconds']) {
    assert.match(FETCHER, new RegExp(`export async function ${name}\\(`), `${name} 未导出`)
    assert.match(DURATION_API, new RegExp(`await ${name}\\(`), `时长接口未复用 ${name}`)
  }
})

test('网易云端点只在 fetcher 中出现', () => {
  assert.equal(
    (DURATION_API.match(/api-enhanced\/netease\/song\//g) || []).length,
    0,
    '时长接口不应重复拼网易云端点'
  )
  assert.equal(
    (FETCHER.match(/api-enhanced\/netease\/song\/detail/g) || []).length,
    1,
    'song/detail 只应有一处调用'
  )
  assert.equal(
    (FETCHER.match(/api-enhanced\/netease\/song\/url\/v1/g) || []).length,
    1,
    'song/url/v1 只应有一处调用'
  )
})

test('时长合理区间与试听片段阈值共用同一份常量', () => {
  assert.match(FETCHER, /export const MIN_PLAUSIBLE_SONG_SECONDS = 30/)
  assert.match(FETCHER, /export const MAX_PLAUSIBLE_SONG_SECONDS = 3600/)
  assert.match(DURATION_API, /MIN_PLAUSIBLE_SONG_SECONDS/)
  assert.match(DURATION_API, /MAX_PLAUSIBLE_SONG_SECONDS/)
  assert.match(DURATION_API, /isNeteasePreviewLength/)
})
