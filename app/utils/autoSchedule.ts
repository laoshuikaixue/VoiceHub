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
  // UI 标记：是否为固定歌曲
  isFixed?: boolean
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

function compareResults(
  a: AutoScheduleResult,
  b: AutoScheduleResult,
  targetSongCount: number | null,
  fixedCount: number
): number {
  if (targetSongCount !== null) {
    const aCountDiff = Math.abs(a.songs.length + fixedCount - targetSongCount)
    const bCountDiff = Math.abs(b.songs.length + fixedCount - targetSongCount)
    if (aCountDiff !== bCountDiff) return aCountDiff - bCountDiff
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
  plansCount: number
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

  const availableCandidates = candidates.filter(
    (s) => !preSelectedIds.has(s.id) && typeof s.durationSeconds === 'number' && s.durationSeconds > 0
  )
  const emptyResult: AutoScheduleResult = { songs: [], totalDuration: 0, diff: 0, absDiff: 0 }

  if (availableCandidates.length === 0 && preSelected.length === 0) {
    return { targetSeconds, preSelectedSeconds, availableCandidates, emptyResult, earlyReturn: plansCount === 1 ? emptyResult : [emptyResult] }
  }
  if (availableCandidates.length === 0) {
    const fixedSongs = preSelected.map((s) => ({ ...s, isFixed: true }))
    const total = preSelectedSeconds
    const diff = total - targetSeconds
    const result: AutoScheduleResult = { songs: fixedSongs, totalDuration: total, diff, absDiff: Math.abs(diff) }
    return { targetSeconds, preSelectedSeconds, availableCandidates, emptyResult, earlyReturn: plansCount === 1 ? result : [result] }
  }

  return { targetSeconds, preSelectedSeconds, availableCandidates, emptyResult }
}

export function autoSchedule(
  direction: AutoScheduleDirection,
  targetMinutes: number,
  candidates: AutoScheduleCandidate[],
  preSelected: AutoScheduleCandidate[] = [],
  plansCount: number = 1,
  targetSongCount?: number | null
): AutoScheduleResult | AutoScheduleResult[] {
  const input = prepareScheduleInput(targetMinutes, candidates, preSelected, plansCount)
  if (input.earlyReturn !== undefined) return input.earlyReturn
  const { targetSeconds, preSelectedSeconds, availableCandidates, emptyResult } = input
  const normalizedTargetSongCount = normalizeTargetSongCount(targetSongCount)
  const targetAdditionalCount = normalizedTargetSongCount === null
    ? null
    : Math.max(0, normalizedTargetSongCount - preSelected.length)

  const remainingTarget = Math.max(0, targetSeconds - preSelectedSeconds)
  const songMap = new Map(availableCandidates.map((s) => [s.id, s]))

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
      for (const song of [...availableCandidates].sort(
        (a, b) => a.durationSeconds! - b.durationSeconds!
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
  const sortedByDuration = normalizedTargetSongCount !== null && direction === 'under'
    ? sortedAscending
    : sortedDescending

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
    addUnique(runGreedy(normalizedTargetSongCount !== null ? sortedAscending : sortedDescending, 'under'))
    addUnique(runGreedy(sortedDescending, 'over'))
  } else {
    addUnique(runGreedy(sortedByDuration, direction))
  }

  // 随机路径：多次 shuffle 生成不同方案
  // 生成比 plansCount 多一些以保留筛选空间
  const maxIter = Math.max(50, plansCount * 5)
  for (let i = 0; i < maxIter && plans.length < plansCount * 3; i++) {
    const shuffled = availableCandidates.map((s) => s.id)
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1))
      ;[shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]
    }
    const shuffledSorted = shuffled.map((id) => songMap.get(id)).filter(Boolean)
    const dir = direction === 'middle' ? (i % 2 === 0 ? 'under' : 'over') : direction
    addUnique(runGreedy(shuffledSorted, dir))
  }

  // 按质量排序：设置期望首数时先比较首数偏差，再比较时长偏差
  plans.sort((a, b) => compareResults(a, b, normalizedTargetSongCount, preSelected.length))

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
  targetSongCount?: number | null
): AutoScheduleResult | AutoScheduleResult[] {
  const input = prepareScheduleInput(targetMinutes, candidates, preSelected, plansCount)
  if (input.earlyReturn !== undefined) return input.earlyReturn
  const { targetSeconds, preSelectedSeconds, availableCandidates, emptyResult } = input
  const normalizedTargetSongCount = normalizeTargetSongCount(targetSongCount)

  // 将时长收窄为 number 类型，消除后续的非空断言
  type DurationCandidate = Omit<AutoScheduleCandidate, 'durationSeconds'> & { durationSeconds: number }

  const remainingTarget = Math.max(0, targetSeconds - preSelectedSeconds)
  // 按时长降序排列，大歌曲优先，利于剪枝
  const sorted = [...availableCandidates as DurationCandidate[]].sort((a, b) => b.durationSeconds - a.durationSeconds)
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
    const canUseFixedOnly = normalizedTargetSongCount !== null && preSelected.length >= normalizedTargetSongCount
    if (currentSongs.length === 0 && !canUseFixedOnly) return
    const total = currentTotal + preSelectedSeconds
    const diff = total - targetSeconds
    if (direction === 'over' && total < targetSeconds) return
    if (direction === 'under' && total > targetSeconds) return
    const absDiff = Math.abs(diff)
    const key = currentSongs.map((s) => s.id).sort().join(',')
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    solutions.push({ songs: [...currentSongs], totalDuration: total, diff, absDiff })
    solutions.sort((a, b) => compareResults(a, b, normalizedTargetSongCount, preSelected.length))
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

  solutions.sort((a, b) => compareResults(a, b, normalizedTargetSongCount, preSelected.length))

  const fixedSongs = preSelected.map((s) => ({ ...s, isFixed: true }))
  const finalPlans = solutions.slice(0, plansCount).map((p) => ({
    ...p,
    songs: [...fixedSongs, ...p.songs]
  }))

  return plansCount === 1 ? (finalPlans[0] || emptyResult) : finalPlans
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
    createdAt: item.createdAt
  }
}
