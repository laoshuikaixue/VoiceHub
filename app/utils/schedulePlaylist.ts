import type { PlayableSong } from '../composables/useAudioPlayer'

export interface SchedulePlaylistSource {
  date: string
  playTimeId: number | null | 'all'
  includeDrafts: boolean
  pending?: boolean
}

export interface SchedulePlaylistChange {
  dates?: string[]
  playTimeId?: number | null | 'all'
}

export function isScheduleScopeSaved(source: SchedulePlaylistSource, change: SchedulePlaylistChange) {
  return Boolean(change.dates?.includes(source.date) &&
    (change.playTimeId === 'all' || change.playTimeId === source.playTimeId))
}

export interface SchedulePlaylistItem {
  id?: number | string
  playDate?: string
  playTimeId?: number | null
  replayRequestId?: number | null
  sequence?: number
  song: PlayableSong
}

export interface SchedulePlaybackState {
  source: SchedulePlaylistSource
  current: SchedulePlaylistItem
  before: SchedulePlaylistItem[]
  after: SchedulePlaylistItem[]
  refill: boolean
  finished: boolean
  waiting: boolean
  autoContinue: boolean
}

export function sameScheduleSource(a: SchedulePlaylistSource, b: SchedulePlaylistSource) {
  return a.date === b.date && a.playTimeId === b.playTimeId && a.includeDrafts === b.includeDrafts
}

// 批量保存会重建排期 ID；回退匹配只接受唯一候选。
export function findScheduleItem(item: SchedulePlaylistItem, items: SchedulePlaylistItem[]) {
  const candidates = items.map((value, index) => ({ value, index })).filter(({ value }) =>
    String(value.song.id) === String(item.song.id) &&
    (value.playDate || '').slice(0, 10) === (item.playDate || '').slice(0, 10) &&
    (value.playTimeId ?? null) === (item.playTimeId ?? null)
  )
  const exact = candidates.filter(({ value }) => item.id != null && String(value.id) === String(item.id))
  if (exact.length === 1) return exact[0].index
  if (item.replayRequestId != null) {
    const replay = candidates.filter(({ value }) => value.replayRequestId === item.replayRequestId)
    if (replay.length === 1) return replay[0].index
  }
  return candidates.length === 1 ? candidates[0].index : -1
}

export function createSchedulePlaybackState(
  source: SchedulePlaylistSource, items: SchedulePlaylistItem[], index: number
): SchedulePlaybackState {
  return {
    source: { ...source }, current: items[index],
    before: items.slice(0, index).reverse(), after: items.slice(index + 1),
    refill: false, finished: false, waiting: false, autoContinue: true
  }
}

export function reconcileSchedulePlayback(state: SchedulePlaybackState, items: SchedulePlaylistItem[]) {
  if (items.length === 0) state.refill = true
  const index = state.refill ? -1 : findScheduleItem(state.current, items)
  if (index >= 0) {
    state.current = items[index]
    state.before = items.slice(0, index).reverse()
    state.after = items.slice(index + 1)
  } else if (!state.refill) {
    const surviving = (previous: SchedulePlaylistItem[]) => previous.flatMap((item) => {
      const match = findScheduleItem(item, items)
      return match >= 0 ? [items[match]] : []
    })
    state.before = surviving(state.before)
    state.after = surviving(state.after)
  }
  return index
}

export function scheduleNeighborIndex(
  state: SchedulePlaybackState, items: SchedulePlaylistItem[], direction: 1 | -1
) {
  if (state.refill) return direction === 1 && items.length ? 0 : -1
  const index = findScheduleItem(state.current, items)
  if (index >= 0) {
    const target = index + direction
    return target >= 0 && target < items.length ? target : -1
  }
  for (const candidate of direction === 1 ? state.after : state.before) {
    const match = findScheduleItem(candidate, items)
    if (match >= 0) return match
  }
  return -1
}

export function selectScheduleItem(state: SchedulePlaybackState, items: SchedulePlaylistItem[], index: number) {
  state.current = items[index]
  state.before = items.slice(0, index).reverse()
  state.after = items.slice(index + 1)
  state.refill = false
  state.finished = false
  state.waiting = false
  state.autoContinue = true
}

export function samePlaybackSource(a: SchedulePlaylistItem['song'], b: SchedulePlaylistItem['song']) {
  return String(a.id) === String(b.id) && a.musicPlatform === b.musicPlatform &&
    a.musicId === b.musicId && (a.playUrl || '') === (b.playUrl || '')
}
