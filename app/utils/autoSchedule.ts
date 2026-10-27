/**
 * 自动排期算法
 * 在候选池中选取总时长最接近目标的歌曲组合
 *
 * 策略：主路径按降序贪心 + 'under' 二次升序回填；辅路径随机采样；取 absDiff 更小的结果
 *
 * @param direction 'under' 总时长不超过目标，'over' 总时长不低于目标，'middle' 相差最小（中间放）
 * @param targetMinutes 目标总时长（分钟）
 * @param candidates 候选歌曲列表（需含 id 和 durationSeconds）
 * @param preSelected 用户已固定的歌曲（总是保留，算法仅对剩余候选补齐剩余时长）
 * @param plansCount 返回方案数，按 absDiff 升序排列（默认 1，仅返回最优）
 * @param targetSongCount 期望的最终歌曲数量（可选；启用后优先匹配歌曲数量，再比较时长）
 * @param targetRequesterCount 期望的不同投稿人数量（可选；启用后优先覆盖不同投稿人，再比较时长）
 */
export type AutoScheduleDirection = 'under' | 'over' | 'middle'

export interface AutoScheduleCandidate {
  id: number
  songId: number
  title: string
  artist: string
  durationSeconds?: number | null
  replayRequestId?: number | null
  musicId?: string | null
  musicPlatform?: string | null
  requester?: string | null
  cover?: string | null
  createdAt?: string | null
  /** 热度（点赞/投票数），用于「热度加权随机」排期 */
  voteCount?: number | null
  // UI 标记：是否为固定歌曲
  isFixed?: boolean
  /** 投稿时显式选择的期望播出日期（YYYY-MM-DD）：命中当天时优先安排，不作为排除条件 */
  preferredPlayDate?: string | null
  /** 投稿时选择的期望播出时段 ID：硬约束，只能排到该时段 */
  preferredPlayTimeId?: number | null
}

/** 自动排期约束。 */
export interface AutoScheduleOptions {
  /** 目标播出日期；命中候选优先安排。 */
  targetDate?: string | null
  /** 目标播出时段 ID；传入时启用硬约束。 */
  targetPlayTimeId?: number | null
}

/** 期望落位过滤结果。 */
export interface AutoSchedulePlacementFilter {
  /** 通过硬约束校验、可参与本次排期的候选 */
  eligible: AutoScheduleCandidate[]
  /** 因期望时段与本次排期时段不符而被排除的数量 */
  excludedByPlayTime: number
}

/**
 * 归一化期望播出日期：仅保留 YYYY-MM-DD 部分，无法解析时返回 null
 */
export function normalizePreferredPlayDate(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (!str) return null
  const matched = str.match(/^(\d{4}-\d{2}-\d{2})/)
  return matched ? matched[1] : null
}

/**
 * 归一化期望播出时段 ID：非正整数视为「未指定时段」
 */
export function normalizePreferredPlayTimeId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isInteger(num) && num > 0 ? num : null
}

/** 按期望时段硬约束过滤候选，并返回排除数量。 */
export function filterByExpectedPlacement(
  candidates: AutoScheduleCandidate[],
  options?: AutoScheduleOptions
): AutoSchedulePlacementFilter {
  const hasSlotConstraint = !!options && options.targetPlayTimeId !== undefined
  const targetPlayTimeId = hasSlotConstraint ? options!.targetPlayTimeId ?? null : null

  const eligible: AutoScheduleCandidate[] = []
  let excludedByPlayTime = 0

  for (const song of candidates) {
    const preferredPlayTimeId = normalizePreferredPlayTimeId(song.preferredPlayTimeId)

    // 期望时段硬约束
    if (hasSlotConstraint) {
      if (targetPlayTimeId === null) {
        // 未指定时段视图：整批落位到「未指定时段」，无法保证落到指定时段
        if (preferredPlayTimeId !== null) {
          excludedByPlayTime++
          continue
        }
      } else if (preferredPlayTimeId !== null && preferredPlayTimeId !== targetPlayTimeId) {
        excludedByPlayTime++
        continue
      }
    }

    eligible.push(song)
  }

  return { eligible, excludedByPlayTime }
}

/** 将命中目标日期的候选移到前面。 */
export function preferExpectedDate<T extends AutoScheduleCandidate>(
  list: T[],
  targetDate?: string | null
): T[] {
  const date = normalizePreferredPlayDate(targetDate)
  if (!date) return [...list]
  const matched: T[] = []
  const rest: T[] = []
  for (const song of list) {
    if (normalizePreferredPlayDate(song.preferredPlayDate) === date) matched.push(song)
    else rest.push(song)
  }
  return [...matched, ...rest]
}

/** 统计方案命中目标日期的数量。 */
export function countExpectedDateHits(
  songs: AutoScheduleCandidate[],
  targetDate?: string | null
): number {
  const date = normalizePreferredPlayDate(targetDate)
  if (!date) return 0
  let count = 0
  for (const song of songs) {
    if (normalizePreferredPlayDate(song.preferredPlayDate) === date) count++
  }
  return count
}

export interface AutoScheduleResult {
  songs: AutoScheduleCandidate[]
  totalDuration: number
  diff: number
  absDiff: number
}

function normalizeTargetSongCount(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.floor(value)
}

/**
 * 按投稿人分散排序：每个投稿人的首首歌排前，其余排后（组内保持原时长顺序）
 * 用于贪心选曲时优先覆盖不同投稿人
 */
function diversifyOrder(
  list: AutoScheduleCandidate[],
  targetRequesterCount: number | null
): AutoScheduleCandidate[] {
  if (targetRequesterCount === null || targetRequesterCount <= 0) return list
  const seen = new Set<string>()
  const firstOfRequester: AutoScheduleCandidate[] = []
  const rest: AutoScheduleCandidate[] = []
  for (const song of list) {
    const key = song.requester || ''
    if (key && !seen.has(key)) {
      seen.add(key)
      firstOfRequester.push(song)
    } else {
      rest.push(song)
    }
  }
  return [...firstOfRequester, ...rest]
}

interface ResultCompareContext {
  targetSongCount: number | null
  fixedCount: number
  targetRequesterCount: number | null
  fixedRequesterSet: Set<string>
  /** 目标播出日期（YYYY-MM-DD），用于优先选择命中期望日期的方案 */
  targetDate: string | null
}

function distinctRequesterCount(
  songs: AutoScheduleCandidate[],
  ctx: ResultCompareContext
): number {
  const set = new Set(ctx.fixedRequesterSet)
  for (const s of songs) {
    if (s.requester) set.add(s.requester)
  }
  return set.size
}

function compareResults(a: AutoScheduleResult, b: AutoScheduleResult, ctx: ResultCompareContext): number {
  if (ctx.targetSongCount !== null) {
    const aCountDiff = Math.abs(a.songs.length + ctx.fixedCount - ctx.targetSongCount)
    const bCountDiff = Math.abs(b.songs.length + ctx.fixedCount - ctx.targetSongCount)
    if (aCountDiff !== bCountDiff) return aCountDiff - bCountDiff
  }
  if (ctx.targetRequesterCount !== null) {
    const aReqDiff = Math.abs(distinctRequesterCount(a.songs, ctx) - ctx.targetRequesterCount)
    const bReqDiff = Math.abs(distinctRequesterCount(b.songs, ctx) - ctx.targetRequesterCount)
    if (aReqDiff !== bReqDiff) return aReqDiff - bReqDiff
  }
  if (a.absDiff !== b.absDiff) return a.absDiff - b.absDiff
  // 同等时长方案优先命中期望日期。
  if (ctx.targetDate) {
    const aHits = countExpectedDateHits(a.songs, ctx.targetDate)
    const bHits = countExpectedDateHits(b.songs, ctx.targetDate)
    if (aHits !== bHits) return bHits - aHits
  }
  return a.absDiff - b.absDiff || b.songs.length - a.songs.length
}

/**
 * 公共前置处理：计算目标秒数、排除固定歌曲、准备候选池
 * 若无可用的候选歌曲，直接返回 earlyReturn 供调用方提前结束
 */
function prepareScheduleInput(
  targetMinutes: number,
  candidates: AutoScheduleCandidate[],
  preSelected: AutoScheduleCandidate[],
  plansCount: number,
  options?: AutoScheduleOptions
): {
  targetSeconds: number
  preSelectedSeconds: number
  availableCandidates: AutoScheduleCandidate[]
  emptyResult: AutoScheduleResult
  earlyReturn?: AutoScheduleResult | AutoScheduleResult[]
} {
  const targetSeconds = Math.floor(targetMinutes * 60)
  const preSelectedIds = new Set(preSelected.map((s) => s.id))
  const preSelectedSeconds = preSelected.reduce(
    (sum, s) => sum + (typeof s.durationSeconds === 'number' ? s.durationSeconds : 0),
    0
  )

  // 期望落位硬约束：期望时段不符的候选不参与本次排期
  const placement = filterByExpectedPlacement(candidates, options)

  const availableCandidates = placement.eligible.filter(
    (s) => !preSelectedIds.has(s.id) && typeof s.durationSeconds === 'number' && s.durationSeconds > 0
  )
  const emptyResult: AutoScheduleResult = { songs: [], totalDuration: 0, diff: 0, absDiff: 0 }

  if (availableCandidates.length === 0 && preSelected.length === 0) {
    return {
      targetSeconds,
      preSelectedSeconds,
      availableCandidates,
      emptyResult,
      earlyReturn: plansCount === 1 ? emptyResult : [emptyResult]
    }
  }
  if (availableCandidates.length === 0) {
    const fixedSongs = preSelected.map((s) => ({ ...s, isFixed: true }))
    const total = preSelectedSeconds
    const diff = total - targetSeconds
    const result: AutoScheduleResult = { songs: fixedSongs, totalDuration: total, diff, absDiff: Math.abs(diff) }
    return {
      targetSeconds,
      preSelectedSeconds,
      availableCandidates,
      emptyResult,
      earlyReturn: plansCount === 1 ? result : [result]
    }
  }

  return {
    targetSeconds,
    preSelectedSeconds,
    availableCandidates,
    emptyResult
  }
}

/** 默认热度权重：0.8 = 排序权重里 80% 来自热度、20% 来自随机（站长实测对比后定稿：80% 偏向明显又不失随机） */
export const DEFAULT_HEAT_WEIGHT = 0.8

/**
 * 热度加权随机排序。
 *
 * 做法：把票数做**秩归一化**（最低票=0，最高票=1，同票同权），再对每首歌取
 *   score = 热度权重 × 热度 + (1 - 热度权重) × 随机数
 * 按 score 降序排列。这样高热度歌曲**更容易排在前面**，但相邻名次之间会经常互换，
 * 不会退化成"严格按热度排序"；权重调低则更随机，调高则更贴近票数排序。
 */
export function heatWeightedOrder<T extends AutoScheduleCandidate>(
  list: T[],
  heatWeight: number = DEFAULT_HEAT_WEIGHT
): T[] {
  const n = list.length
  if (n <= 1) return [...list]

  const weight = Math.min(1, Math.max(0, Number.isFinite(heatWeight) ? heatWeight : DEFAULT_HEAT_WEIGHT))

  const heat = buildHeatMap(list)

  return [...list]
    .map((item) => ({
      item,
      score: weight * (heat.get(item.id) ?? 0.5) + (1 - weight) * Math.random()
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}

/** 秩归一化热度表：最低票=0，最高票=1，同票同权（避免个别超高票通吃） */
export function buildHeatMap(list: AutoScheduleCandidate[]): Map<number, number> {
  const map = new Map<number, number>()
  const n = list.length
  if (n === 0) return map
  if (n === 1) {
    map.set(list[0].id, 0.5)
    return map
  }
  const sorted = [...list].sort(
    (a, b) => (Number(a.voteCount) || 0) - (Number(b.voteCount) || 0)
  )
  let i = 0
  while (i < n) {
    const votes = Number(sorted[i].voteCount) || 0
    let j = i
    while (j + 1 < n && (Number(sorted[j + 1].voteCount) || 0) === votes) j++
    const value = ((i + j) / 2) / (n - 1)
    for (let k = i; k <= j; k++) map.set(sorted[k].id, value)
    i = j + 1
  }
  return map
}

/** 普通随机打乱（作为兜底方案，保证方案之间有差异） */
function shuffleList<T>(list: T[]): T[] {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 方案热度分：选中歌曲热度之和（用于同样优秀方案之间"更热"的优先） */
function planHeatScore(songs: AutoScheduleCandidate[], heatMap: Map<number, number>): number {
  return songs.reduce((sum, song) => sum + (heatMap.get(song.id) ?? 0), 0)
}

export function autoSchedule(
  direction: AutoScheduleDirection,
  targetMinutes: number,
  candidates: AutoScheduleCandidate[],
  preSelected: AutoScheduleCandidate[] = [],
  plansCount: number = 1,
  targetSongCount?: number | null,
  targetRequesterCount?: number | null,
  heatWeight: number = DEFAULT_HEAT_WEIGHT,
  options?: AutoScheduleOptions
): AutoScheduleResult | AutoScheduleResult[] {
  const input = prepareScheduleInput(targetMinutes, candidates, preSelected, plansCount, options)
  if (input.earlyReturn !== undefined) return input.earlyReturn
  const { targetSeconds, preSelectedSeconds, availableCandidates, emptyResult } = input
  // 热度秩归一化表（用于生成顺序与方案比较）
  const heatMap = buildHeatMap(availableCandidates)
  const normalizedTargetSongCount = normalizeTargetSongCount(targetSongCount)
  const normalizedTargetRequesterCount = normalizeTargetSongCount(targetRequesterCount)
  const targetDate = normalizePreferredPlayDate(options?.targetDate)
  const compareCtx: ResultCompareContext = {
    targetSongCount: normalizedTargetSongCount,
    fixedCount: preSelected.length,
    targetRequesterCount: normalizedTargetRequesterCount,
    fixedRequesterSet: new Set(preSelected.map((s) => s.requester).filter(Boolean)),
    targetDate
  }
  const targetAdditionalCount = normalizedTargetSongCount === null
    ? null
    : Math.max(0, normalizedTargetSongCount - preSelected.length)

  const remainingTarget = Math.max(0, targetSeconds - preSelectedSeconds)

  const runGreedy = (sorted: AutoScheduleCandidate[], dir: 'under' | 'over') => {
    const result: AutoScheduleCandidate[] = []
    let total = 0

    for (const song of sorted) {
      if (targetAdditionalCount !== null && result.length >= targetAdditionalCount) break
      const newTotal = total + song.durationSeconds!
      if (dir === 'under') {
        if (newTotal <= remainingTarget) {
          result.push(song)
          total = newTotal
        }
      } else {
        if (remainingTarget <= 0) {
          // 已选歌曲时长已超过目标，无需再追加
        } else {
          result.push(song)
          total = newTotal
          if (
            total >= remainingTarget &&
            (targetAdditionalCount === null || result.length >= targetAdditionalCount)
          ) break
        }
      }
    }

    if (dir === 'under') {
      const ids = new Set(result.map((s) => s.id))
      for (const song of diversifyOrder(
        [...availableCandidates].sort((a, b) => a.durationSeconds! - b.durationSeconds!),
        normalizedTargetRequesterCount
      )) {
        if (targetAdditionalCount !== null && result.length >= targetAdditionalCount) break
        if (ids.has(song.id)) continue
        if (total + song.durationSeconds! <= remainingTarget) {
          result.push(song)
          total += song.durationSeconds!
          ids.add(song.id)
        }
      }
    } else {
      const selectedIds = new Set(result.map((s) => s.id))
      let remaining = availableCandidates.filter((s) => !selectedIds.has(s.id))
        .sort((a, b) => a.durationSeconds! - b.durationSeconds!)
      let ri = result.length - 1
      search: while (ri >= 0) {
        const currentSong = result[ri]
        const currentDuration = currentSong.durationSeconds!
        const totalWithoutThis = total - currentDuration
        // 移除当前歌后仍满足约束，直接移除（更优解）
        if (
          totalWithoutThis >= remainingTarget &&
          (targetAdditionalCount === null || result.length > targetAdditionalCount)
        ) {
          result.splice(ri, 1)
          total = totalWithoutThis
          selectedIds.delete(currentSong.id)
          remaining = availableCandidates.filter((s) => !selectedIds.has(s.id))
            .sort((a, b) => a.durationSeconds! - b.durationSeconds!)
          ri = result.length - 1
          continue
        }
        const minReplacement = remainingTarget - totalWithoutThis
        if (minReplacement >= currentDuration) {
          ri--
          continue
        }
        for (let ii = 0; ii < remaining.length; ii++) {
          const candidate = remaining[ii]
          if (
            candidate.durationSeconds! >= minReplacement &&
            candidate.durationSeconds! < currentDuration
          ) {
            result[ri] = candidate
            total = totalWithoutThis + candidate.durationSeconds!
            selectedIds.delete(currentSong.id)
            selectedIds.add(candidate.id)
            remaining.splice(ii, 1)
            break search
          }
        }
        ri--
      }
    }

    const diff = (total + preSelectedSeconds) - targetSeconds
    return { songs: result, totalDuration: total + preSelectedSeconds, diff, absDiff: Math.abs(diff) }
  }

  const sortedDescending = [...availableCandidates].sort(
    (a, b) => b.durationSeconds! - a.durationSeconds!
  )
  const sortedAscending = [...availableCandidates].sort(
    (a, b) => a.durationSeconds! - b.durationSeconds!
  )
  // 设置投稿人目标时分散排序，优先覆盖不同投稿人
  const diversifiedDescending = diversifyOrder(sortedDescending, normalizedTargetRequesterCount)
  const diversifiedAscending = diversifyOrder(sortedAscending, normalizedTargetRequesterCount)
  // 期望日期优先：命中目标日期的歌曲排在最前，保证「可能的情况下」优先安排到当天
  const preferredDescending = preferExpectedDate(diversifiedDescending, targetDate)
  const preferredAscending = preferExpectedDate(diversifiedAscending, targetDate)
  const sortedByDuration = normalizedTargetSongCount !== null && direction === 'under'
    ? preferredAscending
    : preferredDescending

  // 生成方案
  const plans: AutoScheduleResult[] = []
  const seenSets = new Set<string>()

  const addUnique = (result: AutoScheduleResult) => {
    const key = result.songs.map((s) => s.id).sort().join(',')
    if (!seenSets.has(key)) {
      seenSets.add(key)
      plans.push(result)
    }
  }

  // 确定性路径
  if (direction === 'middle') {
    addUnique(runGreedy(normalizedTargetSongCount !== null ? preferredAscending : preferredDescending, 'under'))
    addUnique(runGreedy(preferredDescending, 'over'))
  } else {
    addUnique(runGreedy(sortedByDuration, direction))
  }

  // 随机路径：每次用「热度加权随机」生成不同方案
  //   score = 热度权重 × 热度 + (1-热度权重) × 随机 → 高热度更容易靠前，但相邻名次经常互换
  // 生成比 plansCount 多一些以保留筛选空间
  const maxIter = Math.max(50, plansCount * 5)
  for (let i = 0; i < maxIter && plans.length < plansCount * 3; i++) {
    // 第一个随机方案用纯随机兜底，保证方案之间有足够差异；其余按热度加权
    const ordered =
      i === 0
        ? shuffleList(availableCandidates)
        : heatWeightedOrder(availableCandidates, heatWeight)
    const dir = direction === 'middle' ? (i % 2 === 0 ? 'under' : 'over') : direction
    // 期望日期命中的歌曲始终前置，保证随机方案也优先安排到当天
    const diversified = diversifyOrder(ordered, normalizedTargetRequesterCount)
    addUnique(runGreedy(preferExpectedDate(diversified, targetDate), dir))
  }

  // 按质量排序：首数偏差 → 投稿人偏差 → 时长偏差 → 歌曲数 → 热度（同等优秀时更热的优先）
  plans.sort((a, b) => {
    const base = compareResults(a, b, compareCtx)
    if (base !== 0) return base
    return planHeatScore(b.songs, heatMap) - planHeatScore(a.songs, heatMap)
  })

  // 合并固定歌曲并截取
  const fixedSongs = preSelected.map((s) => ({ ...s, isFixed: true }))
  const finalPlans = plans
    .slice(0, plansCount)
    .map((p) => ({ ...p, songs: [...fixedSongs, ...p.songs] }))

  if (plansCount === 1) {
    return finalPlans[0] || emptyResult
  }
  return finalPlans
}

/**
 * 穷举排期算法（DFS + 剪枝）
 * 系统遍历候选歌曲的子集组合，按 absDiff 收集最优方案
 *
 * 复杂度：最坏 O(2^n)，通过剪枝大幅缩减实际搜索空间
 * - 方向约束剪枝：'under' 超过目标立即终止；'over' 无法达到目标终止
 * - 最优解剪枝：当前分支最差情况已超过已有最优解则终止
 * - 节点上限：限制总访问节点数，防止超大候选池卡死
 */
export function autoScheduleExhaustive(
  direction: AutoScheduleDirection,
  targetMinutes: number,
  candidates: AutoScheduleCandidate[],
  preSelected: AutoScheduleCandidate[] = [],
  plansCount: number = 1,
  targetSongCount?: number | null,
  targetRequesterCount?: number | null,
  heatWeight: number = DEFAULT_HEAT_WEIGHT,
  options?: AutoScheduleOptions
): AutoScheduleResult | AutoScheduleResult[] {
  const input = prepareScheduleInput(targetMinutes, candidates, preSelected, plansCount, options)
  if (input.earlyReturn !== undefined) return input.earlyReturn
  const { targetSeconds, preSelectedSeconds, availableCandidates, emptyResult } = input
  const normalizedTargetSongCount = normalizeTargetSongCount(targetSongCount)
  const normalizedTargetRequesterCount = normalizeTargetSongCount(targetRequesterCount)
  const targetDate = normalizePreferredPlayDate(options?.targetDate)
  const heatMap = buildHeatMap(availableCandidates)
  // 热度权重：0 时穷举完全不参考热度（与滑杆 0% = 不看热度 一致）；>0 时热度仅作同分方案的末位比较
  const normalizedHeatWeight = Math.min(1, Math.max(0, Number.isFinite(heatWeight) ? heatWeight : DEFAULT_HEAT_WEIGHT))
  const heatEnabled = normalizedHeatWeight > 0
  const heatTiebreak = (a: AutoScheduleResult, b: AutoScheduleResult): number =>
    heatEnabled ? planHeatScore(b.songs, heatMap) - planHeatScore(a.songs, heatMap) : 0
  const compareCtx: ResultCompareContext = {
    targetSongCount: normalizedTargetSongCount,
    fixedCount: preSelected.length,
    targetRequesterCount: normalizedTargetRequesterCount,
    fixedRequesterSet: new Set(preSelected.map((s) => s.requester).filter(Boolean)),
    targetDate
  }

  // 将时长收窄为 number 类型，消除后续的非空断言
  type DurationCandidate = Omit<AutoScheduleCandidate, 'durationSeconds'> & { durationSeconds: number }

  const remainingTarget = Math.max(0, targetSeconds - preSelectedSeconds)
  // 按时长降序排列，大歌曲优先，利于剪枝；启用热度时同长度热度高者在前；设置投稿人目标时分散排序
  // 期望日期命中的歌曲前置：DFS 优先探索包含它们的分支，更容易产出「安排到当天」的方案
  const sorted = preferExpectedDate(
    diversifyOrder(
      [...(availableCandidates as DurationCandidate[])].sort(
        (a, b) =>
          b.durationSeconds - a.durationSeconds ||
          (heatEnabled ? (b.voteCount || 0) - (a.voteCount || 0) : 0)
      ),
      normalizedTargetRequesterCount
    ),
    targetDate
  )
  const n = sorted.length

  // 后缀和：suffixSum[i] = sorted[i..n-1] 的时长之和，用于判定能否达到目标
  const suffixSum = new Array(n + 1).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    suffixSum[i] = suffixSum[i + 1] + sorted[i].durationSeconds
  }

  const solutions: AutoScheduleResult[] = []
  const seenKeys = new Set<string>()
  let nodeCount = 0
  const maxNodes = 100000
  const maxSolutions = plansCount * 3
  // worstAbs 记录当前已收录方案中最差的 absDiff，作为剪枝阈值
  // 初始值 Infinity 确保首个方案能被正确记录并更新该值（0 会导致找到完美解后后续方案被全部过滤）
  let worstAbs = Infinity
  const currentSongs: AutoScheduleCandidate[] = []

  const record = (currentTotal: number) => {
    // 固定歌曲自身即构成合法方案：固定时长已达目标时不应再为凑时长追加候选
    if (currentSongs.length === 0 && preSelected.length === 0) return
    const total = currentTotal + preSelectedSeconds
    const diff = total - targetSeconds
    if (direction === 'over' && total < targetSeconds) return
    if (direction === 'under' && total > targetSeconds) return
    const absDiff = Math.abs(diff)
    const key = currentSongs.map((s) => s.id).sort().join(',')
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    solutions.push({ songs: [...currentSongs], totalDuration: total, diff, absDiff })
    solutions.sort((a, b) => {
      const base = compareResults(a, b, compareCtx)
      return base !== 0 ? base : heatTiebreak(a, b)
    })
    if (solutions.length > maxSolutions) {
      solutions.splice(maxSolutions)
      worstAbs = solutions[solutions.length - 1].absDiff
    }
  }

  const canPrune = (idx: number, currentTotal: number): boolean => {
    if (nodeCount > maxNodes) return true

    if (direction === 'under') {
      // 已超过目标，无效
      if (currentTotal > remainingTarget) return true
      // 即使加上所有剩余歌曲也到不了目标，且当前差距已大于已有最优
      if (normalizedTargetSongCount === null && currentTotal + suffixSum[idx] < remainingTarget && remainingTarget - currentTotal > worstAbs) {
        return true
      }
    } else if (direction === 'over') {
      // 即使加上所有剩余歌曲也达不到目标
      if (currentTotal + suffixSum[idx] < remainingTarget) return true
      // 当前已远超目标且超出量已大于已有最优
      if (normalizedTargetSongCount === null && currentTotal >= remainingTarget && currentTotal - remainingTarget > worstAbs) {
        return true
      }
    } else {
      // middle：判断从当前状态能达到的最好 absDiff
      const minDiff = currentTotal - remainingTarget
      const maxDiff = currentTotal + suffixSum[idx] - remainingTarget
      if (normalizedTargetSongCount === null) {
        if (minDiff >= 0 && minDiff > worstAbs) return true
        if (maxDiff <= 0 && -maxDiff > worstAbs) return true
      }
    }

    return false
  }

  const dfs = (idx: number, currentTotal: number) => {
    nodeCount++
    if (nodeCount > maxNodes) return

    record(currentTotal)
    if (idx >= n) return
    if (canPrune(idx, currentTotal)) return

    // 尝试包含 sorted[idx]
    if (direction === 'under') {
      if (currentTotal + sorted[idx].durationSeconds <= remainingTarget) {
        currentSongs.push(sorted[idx])
        dfs(idx + 1, currentTotal + sorted[idx].durationSeconds)
        currentSongs.pop()
      }
    } else {
      currentSongs.push(sorted[idx])
      dfs(idx + 1, currentTotal + sorted[idx].durationSeconds)
      currentSongs.pop()
    }

    // 尝试不包含 sorted[idx]
    dfs(idx + 1, currentTotal)
  }

  dfs(0, 0)

  // 没有任何合法方案时，至少返回「仅固定歌曲」的方案，避免固定歌曲全部丢失
  // （固定歌曲总时长已不小于目标、或方向约束凑不出解时会走到这里）
  if (solutions.length === 0 && preSelected.length > 0) {
    const total = preSelectedSeconds
    const diff = total - targetSeconds
    solutions.push({ songs: [], totalDuration: total, diff, absDiff: Math.abs(diff) })
  }

  solutions.sort((a, b) => {
    const base = compareResults(a, b, compareCtx)
    return base !== 0 ? base : heatTiebreak(a, b)
  })

  const fixedSongs = preSelected.map((s) => ({ ...s, isFixed: true }))
  const finalPlans = solutions.slice(0, plansCount).map((p) => ({
    ...p,
    songs: [...fixedSongs, ...p.songs]
  }))

  return plansCount === 1 ? (finalPlans[0] || emptyResult) : finalPlans
}

/** 排期列表中固定所需的字段 */
export interface ScheduledEntryForFix {
  song?: {
    id?: number | null
    title?: string
    artist?: string
    durationSeconds?: number | null
    musicId?: string | null
    musicPlatform?: string | null
    requester?: string | null
    cover?: string | null
    createdAt?: string | null
    preferredPlayDate?: string | null
    preferredPlayTimeId?: number | null
  } | null
  replayRequestId?: number | null
}

/**
 * 将已排期条目转换为固定候选歌曲
 * 时长未知的歌曲仍保留（按 0 计入），避免固定时被静默丢弃
 */
export function fixedCandidatesFromScheduled(entries: ScheduledEntryForFix[]): AutoScheduleCandidate[] {
  const result: AutoScheduleCandidate[] = []
  const seen = new Set<number>()
  for (const entry of entries) {
    const song = entry?.song
    if (!song || song.id == null) continue
    const id = Number(song.id)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    const duration = Number(song.durationSeconds)
    result.push({
      id,
      songId: id,
      title: song.title || '',
      artist: song.artist || '',
      durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 0,
      replayRequestId: entry.replayRequestId || null,
      musicId: song.musicId || null,
      musicPlatform: song.musicPlatform || null,
      requester: song.requester || null,
      cover: song.cover || null,
      createdAt: song.createdAt || null,
      preferredPlayDate: song.preferredPlayDate || null,
      preferredPlayTimeId: song.preferredPlayTimeId || null
    })
  }
  return result
}

/**
 * 将备选池条目规范化为统一的候选歌曲对象
 */
export function poolCandidateFromItem(item: any): AutoScheduleCandidate {
  return {
    id: item.songId,
    songId: item.songId,
    title: item.title,
    artist: item.artist,
    durationSeconds: item.durationSeconds,
    replayRequestId: item.replayRequestId || null,
    musicId: item.musicId,
    musicPlatform: item.musicPlatform,
    requester: item.requester,
    cover: item.cover,
    createdAt: item.createdAt,
    // 热度：备选池条目带 voteCount；缺失按 0 处理
    voteCount: Number.isFinite(Number(item.voteCount)) ? Number(item.voteCount) : 0,
    // 期望落位信息：期望时段是硬约束，期望日期是软约束
    preferredPlayDate: normalizePreferredPlayDate(item.preferredPlayDate),
    preferredPlayTimeId: normalizePreferredPlayTimeId(item.preferredPlayTimeId)
  }
}
