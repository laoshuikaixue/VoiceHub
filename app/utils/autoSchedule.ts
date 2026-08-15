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

export function autoSchedule(
  direction: AutoScheduleDirection,
  targetMinutes: number,
  candidates: AutoScheduleCandidate[],
  preSelected: AutoScheduleCandidate[] = []
): AutoScheduleResult {
  const targetSeconds = Math.floor(targetMinutes * 60)

  // 计算固定歌曲的总时长，从候选池中排除固定歌曲
  const preSelectedIds = new Set(preSelected.map((s) => s.id))
  const preSelectedSeconds = preSelected.reduce(
    (sum, s) => sum + (typeof s.durationSeconds === 'number' ? s.durationSeconds : 0),
    0
  )

  // 可用候选（排除固定歌曲）
  const availableCandidates = candidates.filter(
    (s) => !preSelectedIds.has(s.id) && typeof s.durationSeconds === 'number' && s.durationSeconds > 0
  )

  if (availableCandidates.length === 0 && preSelected.length === 0) {
    return { songs: [], totalDuration: 0, diff: 0, absDiff: 0 }
  }

  if (availableCandidates.length === 0) {
    // 只有固定歌曲
    const fixedSongs = preSelected.map((s) => ({ ...s, isFixed: true }))
    const total = preSelectedSeconds
    const diff = total - targetSeconds
    return { songs: fixedSongs, totalDuration: total, diff, absDiff: Math.abs(diff) }
  }

  // 剩余目标时长
  const remainingTarget = Math.max(0, targetSeconds - preSelectedSeconds)

  // 建立 id → song 的 Map，避免随机路径中 O(n²) 查找
  const songMap = new Map(availableCandidates.map((s) => [s.id, s]))

  const runGreedy = (sorted: AutoScheduleCandidate[], dir: 'under' | 'over') => {
    const result: AutoScheduleCandidate[] = []
    let total = 0

    for (const song of sorted) {
      const newTotal = total + song.durationSeconds!
      if (dir === 'under') {
        if (newTotal <= remainingTarget) {
          result.push(song)
          total = newTotal
        }
      } else {
        result.push(song)
        total = newTotal
        if (total >= remainingTarget) break
      }
    }

    if (dir === 'under') {
      const ids = new Set(result.map((s) => s.id))
      for (const song of [...availableCandidates].sort(
        (a, b) => a.durationSeconds! - b.durationSeconds!
      )) {
        if (ids.has(song.id)) continue
        if (total + song.durationSeconds! <= remainingTarget) {
          result.push(song)
          total += song.durationSeconds!
          ids.add(song.id)
        }
      }
    } else {
      const selectedIds = new Set(result.map((s) => s.id))
      const remaining = availableCandidates.filter((s) => !selectedIds.has(s.id))
        .sort((a, b) => a.durationSeconds! - b.durationSeconds!)
      for (let ri = result.length - 1; ri >= 0; ri--) {
        const currentSong = result[ri]
        const currentDuration = currentSong.durationSeconds!
        const totalWithoutThis = total - currentDuration
        const minReplacement = remainingTarget - totalWithoutThis
        if (minReplacement >= currentDuration) continue
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
            break
          }
        }
      }
    }

    const diff = (total + preSelectedSeconds) - targetSeconds
    return { songs: result, totalDuration: total + preSelectedSeconds, diff, absDiff: Math.abs(diff) }
  }

  const sortedByDuration = [...availableCandidates].sort(
    (a, b) => b.durationSeconds! - a.durationSeconds!
  )

  const shuffled = availableCandidates.map((s) => s.id)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const shuffledSorted = shuffled.map((id) => songMap.get(id)).filter(Boolean)

  let r1, r2
  if (direction === 'middle') {
    // 中间方向：分别跑 under/over 两种策略，取 absDiff 更小的结果
    r1 = runGreedy(sortedByDuration, 'under')
    r2 = runGreedy(sortedByDuration, 'over')
  } else {
    r1 = runGreedy(sortedByDuration, direction)
    r2 = runGreedy(shuffledSorted, direction)
  }

  // tiebreaker：absDiff 相同时优先取歌曲数较多的结果
  const pick =
    r1.absDiff < r2.absDiff
      ? r1
      : r1.absDiff > r2.absDiff
        ? r2
        : r1.songs.length >= r2.songs.length
          ? r1
          : r2

  // 合并固定歌曲到最终结果（pick.totalDuration 已包含 preSelectedSeconds）
  const fixedSongs = preSelected.map((s) => ({ ...s, isFixed: true }))
  return { songs: [...fixedSongs, ...pick.songs], ...pick }
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
