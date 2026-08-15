/**
 * 自动排期算法
 * 在候选池中选取总时长最接近目标的歌曲组合
 *
 * 策略：主路径按降序贪心 + 'under' 二次升序回填；辅路径随机采样；取 absDiff 更小的结果
 * @param direction 'under' 总时长不超过目标，'over' 总时长不低于目标
 * @param targetMinutes 目标总时长（分钟）
 * @param candidates 候选歌曲列表（需含 id 和 durationSeconds）
 */
export type AutoScheduleDirection = 'under' | 'over'

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
  candidates: AutoScheduleCandidate[]
): AutoScheduleResult {
  const targetSeconds = Math.floor(targetMinutes * 60)
  const filteredCandidates = candidates.filter(
    (s) => typeof s.durationSeconds === 'number' && s.durationSeconds > 0
  )

  if (filteredCandidates.length === 0) {
    return { songs: [], totalDuration: 0, diff: 0, absDiff: 0 }
  }

  // 建立 id → song 的 Map，避免随机路径中 O(n²) 查找
  const songMap = new Map(filteredCandidates.map((s) => [s.id, s]))

  const runGreedy = (sorted: AutoScheduleCandidate[]) => {
    const result: AutoScheduleCandidate[] = []
    let total = 0

    for (const song of sorted) {
      const newTotal = total + song.durationSeconds!
      if (direction === 'under') {
        if (newTotal <= targetSeconds) {
          result.push(song)
          total = newTotal
        }
      } else {
        result.push(song)
        total = newTotal
        if (total >= targetSeconds) break
      }
    }

    if (direction === 'under') {
      const ids = new Set(result.map((s) => s.id))
      for (const song of [...filteredCandidates].sort(
        (a, b) => a.durationSeconds! - b.durationSeconds!
      )) {
        if (ids.has(song.id)) continue
        if (total + song.durationSeconds! <= targetSeconds) {
          result.push(song)
          total += song.durationSeconds!
          ids.add(song.id)
        }
      }
    } else {
      const selectedIds = new Set(result.map((s) => s.id))
      const remaining = filteredCandidates.filter((s) => !selectedIds.has(s.id))
        .sort((a, b) => a.durationSeconds! - b.durationSeconds!)
      // 从最短的已选歌曲开始尝试替换，保持总时长 >= 目标的前提下尽量逼近
      for (let ri = result.length - 1; ri >= 0; ri--) {
        const currentSong = result[ri]
        const currentDuration = currentSong.durationSeconds!
        const totalWithoutThis = total - currentDuration
        const minReplacement = targetSeconds - totalWithoutThis
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

    const diff = total - targetSeconds
    return { songs: result, totalDuration: total, diff, absDiff: Math.abs(diff) }
  }

  const r1 = runGreedy(
    [...filteredCandidates].sort(
      (a, b) => b.durationSeconds! - a.durationSeconds!
    )
  )

  const shuffled = filteredCandidates.map((s) => s.id)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const r2 = runGreedy(shuffled.map((id) => songMap.get(id)).filter(Boolean))

  // tiebreaker：absDiff 相同时优先取歌曲数较多的结果
  const pick =
    r1.absDiff < r2.absDiff
      ? r1
      : r1.absDiff > r2.absDiff
        ? r2
        : r1.songs.length >= r2.songs.length
          ? r1
          : r2
  return pick
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
