import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  autoSchedule,
  autoScheduleExhaustive,
  fixedCandidatesFromScheduled,
  type AutoScheduleCandidate,
  type AutoScheduleDirection,
  type AutoScheduleResult,
  type ScheduledEntryForFix
} from '../../app/utils/autoSchedule.ts'

// 真实歌曲（歌名、歌手、时长均为真实值）
const REAL_SONGS = [
  { title: '晴天', artist: '周杰伦', durationSeconds: 269 },
  { title: '稻香', artist: '周杰伦', durationSeconds: 223 },
  { title: '七里香', artist: '周杰伦', durationSeconds: 299 },
  { title: '小幸运', artist: '田馥甄', durationSeconds: 262 },
  { title: '起风了', artist: '买辣椒也用券', durationSeconds: 325 },
  { title: '光年之外', artist: '邓紫棋', durationSeconds: 235 },
  { title: '孤勇者', artist: '陈奕迅', durationSeconds: 257 },
  { title: '夜空中最亮的星', artist: '逃跑计划', durationSeconds: 252 },
  { title: '平凡之路', artist: '朴树', durationSeconds: 302 },
  { title: '当你', artist: '林俊杰', durationSeconds: 268 },
  { title: '演员', artist: '薛之谦', durationSeconds: 261 },
  { title: '年少有为', artist: '李荣浩', durationSeconds: 269 },
  { title: '说散就散', artist: '袁娅维', durationSeconds: 231 },
  { title: '追光者', artist: '岑宁儿', durationSeconds: 255 },
  { title: '体面', artist: '于文文', durationSeconds: 259 }
]

type Song = {
  id: number
  songId: number
  title: string
  artist: string
  durationSeconds: number | null
  musicId: string
  musicPlatform: string
  requester: string
}

const makeSongs = (noDurationTitles: string[] = []): Song[] =>
  REAL_SONGS.map((song, i) => ({
    id: i + 1,
    songId: i + 1,
    ...song,
    // 模拟接口未获取到时长：full.get.ts 用 `durationSeconds: songDurationSeconds || null`
    durationSeconds: noDurationTitles.includes(song.title) ? null : song.durationSeconds,
    musicId: `m${i + 1}`,
    musicPlatform: 'netease',
    requester: `同学${(i % 5) + 1}`
  }))

const toEntries = (songs: Song[]): ScheduledEntryForFix[] =>
  songs.map((song) => ({ song, replayRequestId: null }))

const toPlans = (result: AutoScheduleResult | AutoScheduleResult[]): AutoScheduleResult[] =>
  Array.isArray(result) ? result : [result]

const fixedIdSets = (result: AutoScheduleResult | AutoScheduleResult[]): Set<number>[] =>
  toPlans(result).map(
    (plan) => new Set(plan.songs.filter((song) => song.isFixed).map((song) => song.id))
  )

const scheduleFns = [autoSchedule, autoScheduleExhaustive]

test('已排期歌曲时长未知时仍全部固定（不再被静默丢弃）', () => {
  const songs = makeSongs(['起风了', '小幸运'])
  const fixed = fixedCandidatesFromScheduled(toEntries(songs.slice(0, 5)))

  assert.equal(fixed.length, 5, '5 首已排期歌曲都应进入固定列表')
  assert.deepEqual(
    fixed.map((song) => song.title),
    ['晴天', '稻香', '七里香', '小幸运', '起风了']
  )
  assert.equal(fixed.find((song) => song.title === '小幸运')?.durationSeconds, 0, '时长未知按 0 计入')
  assert.equal(fixed.find((song) => song.title === '晴天')?.durationSeconds, 269)
})

test('固定候选规范化：异常时长按 0、无效条目跳过、同歌去重', () => {
  const fixed = fixedCandidatesFromScheduled([
    { song: { id: 1, title: '晴天', artist: '周杰伦', durationSeconds: 269 } },
    { song: { id: 2, title: '稻香', artist: '周杰伦', durationSeconds: 0 } },
    { song: { id: 3, title: '七里香', artist: '周杰伦', durationSeconds: null } },
    // 后端返回字符串时长时也要转成数字
    { song: { id: 4, title: '小幸运', artist: '田馥甄', durationSeconds: '262' as unknown as number } },
    // 同一首歌既已发布又在草稿中：只固定一次
    { song: { id: 1, title: '晴天', artist: '周杰伦', durationSeconds: 269 } },
    { song: null },
    {}
  ])

  assert.deepEqual(fixed.map((song) => song.id), [1, 2, 3, 4])
  assert.equal(fixed[1].durationSeconds, 0)
  assert.equal(fixed[2].durationSeconds, 0)
  assert.equal(fixed[3].durationSeconds, 262, '字符串时长应转成数字')
})

test('各方向与算法下固定歌曲都完整出现在方案里（含时长未知歌曲）', () => {
  const allSongs = makeSongs(['起风了', '小幸运'])
  const fixed: AutoScheduleCandidate[] = fixedCandidatesFromScheduled(toEntries(allSongs.slice(0, 5)))
  const fixedIds = fixed.map((song) => song.id)
  const candidates = allSongs.slice(5)

  const cases: Array<[AutoScheduleDirection, number]> = [
    ['under', 30],
    ['under', 5],
    ['under', 200],
    ['middle', 30],
    ['middle', 5],
    ['over', 30],
    ['over', 5],
    ['over', 200]
  ]

  for (const fn of scheduleFns) {
    for (const [direction, minutes] of cases) {
      const planSets = fixedIdSets(fn(direction, minutes, candidates, fixed, 10, null, null, 0.8))
      assert.ok(planSets.length > 0, `${fn.name}/${direction}/${minutes} 应至少返回一个方案`)
      for (const idSet of planSets) {
        for (const id of fixedIds) {
          assert.ok(idSet.has(id), `${fn.name}/${direction}/${minutes} 缺少固定歌曲 id=${id}`)
        }
      }
    }
  }
})

test('目标歌曲数小于固定歌曲数时固定歌曲仍全部保留', () => {
  const allSongs = makeSongs()
  const fixed = fixedCandidatesFromScheduled(toEntries(allSongs.slice(0, 5)))
  const candidates = allSongs.slice(5)

  for (const fn of scheduleFns) {
    const plans = toPlans(fn('under', 30, candidates, fixed, 1, 3, null, 0.8))
    const ids = new Set(plans[0].songs.map((song) => song.id))
    for (const song of fixed) {
      assert.ok(ids.has(song.id), `${fn.name} 目标 3 首时不应丢掉固定歌曲 ${song.title}`)
    }
  }
})

test('固定时长已覆盖目标时两种算法都只保留固定歌曲', () => {
  // 起风了 5:25 已覆盖 5 分钟目标，任何候选都只会让偏差更大
  const allSongs = makeSongs()
  const fixed = fixedCandidatesFromScheduled(toEntries([allSongs[4]]))
  const candidates = allSongs.filter((song) => !fixed.some((s) => s.id === song.id))

  for (const fn of scheduleFns) {
    for (const direction of ['under', 'middle', 'over']) {
      const plans = toPlans(fn(direction, 5, candidates, fixed, 1))
      assert.equal(plans.length > 0, true, `${fn.name}/${direction} 应给出方案`)
      assert.deepEqual(
        plans[0].songs.map((song) => song.id),
        fixed.map((song) => song.id),
        `${fn.name}/${direction} 不应为凑时长追加候选`
      )
    }
  }
})
