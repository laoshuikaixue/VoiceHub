import { maskStudentName } from './siteUtils'

/**
 * 可脱敏的用户/参与者接口
 */
export interface MaskableUser {
  id?: number | string
  name?: string
  displayName?: string
  grade?: string | null
  class?: string | null
  /** 重播申请人本人即匿名投稿人时置 true，由前端本地化展示 */
  isAnonymous?: boolean
  [key: string]: any
}

/**
 * 可脱敏的歌曲信息接口
 */
export interface MaskableSong {
  /** 逐条投稿的匿名标记（Song.submissionAnonymous） */
  submissionAnonymous?: boolean
  /** 当前查看者是否应看到「匿名」（服务端标志驱动，由前端本地化展示文案） */
  isAnonymous?: boolean
  requester?: string
  requesterGrade?: string | null
  requesterClass?: string | null
  collaborators?: MaskableUser[]
  replayRequesters?: MaskableUser[]
  [key: string]: any
}

/**
 * 对单个参与者（联合投稿人、重播申请人）进行脱敏
 * @param user 参与者对象
 */
export function maskUserInfo(user: MaskableUser) {
  if (user.name) user.name = maskStudentName(user.name)
  if (user.displayName) user.displayName = maskStudentName(user.displayName)
  user.grade = null
  user.class = null
}

/**
 * 对单首歌曲的投稿相关信息进行脱敏
 * @param song 歌曲对象
 */
export function maskSongInfo(song: MaskableSong) {
  // 脱敏主投稿人姓名
  if (song.requester) {
    song.requester = maskStudentName(song.requester)
  }

  // 隐藏主投稿人年级和班级
  if (song.requesterGrade !== undefined) song.requesterGrade = null
  if (song.requesterClass !== undefined) song.requesterClass = null

  // 批量脱敏联合投稿人
  if (song.collaborators && Array.isArray(song.collaborators)) {
    song.collaborators.forEach(maskUserInfo)
  }

  // 批量脱敏重播申请人
  if (song.replayRequesters && Array.isArray(song.replayRequesters)) {
    song.replayRequesters.forEach(maskUserInfo)
  }
}

/**
 * 批量脱敏歌曲列表（通常用于 index.get.ts）
 * @param songs 歌曲列表
 */
export function maskSongsInfo(songs: MaskableSong[]) {
  songs.forEach(maskSongInfo)
}

/**
 * 公共排期项接口
 */
export interface PublicScheduleItem {
  song?: MaskableSong
  [key: string]: any
}

/**
 * 批量脱敏公共排期数据（通常用于 public.get.ts）
 * @param data 排期数据列表
 */
export function maskPublicScheduleData(data: PublicScheduleItem[]) {
  data.forEach((item) => {
    if (item.song) {
      maskSongInfo(item.song)
    }
  })
}

/**
 * 批量脱敏「扁平排期项」：机器人本周歌单把投稿人直接放在 `requester` 上，
 * 而不是公共排期的 `{ song: {...} }` 嵌套结构。
 *
 * @param items 含 `requester` / `requesterGrade` / `requesterClass` 的排期项
 */
export function maskScheduleItemsInfo(items: MaskableSong[]) {
  items.forEach(maskSongInfo)
}

/** 移除匿名响应中的内部用户和点歌券标识，避免通过 ID 关联被脱敏的数据。 */
export function stripAnonymousSongIdentifiers(song: MaskableSong) {
  delete song.requesterId
  delete song.cardCodeId

  song.collaborators?.forEach((user) => delete user.id)
  song.replayRequesters?.forEach((user) => delete user.id)
}

export function stripAnonymousSongIdentifiersFromSchedules(data: PublicScheduleItem[]) {
  data.forEach((item) => {
    if (item.song) stripAnonymousSongIdentifiers(item.song)
  })
}

export interface AnonymityViewer {
  id?: number | null
  /** 管理员视角：不做匿名处理（后台始终可以看到真实投稿人） */
  isAdmin?: boolean
}

/**
 * 按「逐条投稿的匿名标记」脱敏。
 *
 * 只有 submissionAnonymous === true 的投稿会被处理：
 *   - 管理员：完全跳过（后台始终能看到真实投稿人，便于管理追溯）
 *   - 投稿人本人：跳过（自己的投稿自己可见，便于在列表里辨认）
 *   - 其他登录用户 / 游客：置 isAnonymous=true 且清空 requester，并移除年级班级、
 *     联合投稿人以及 requesterId / cardCodeId 等可被交叉关联的内部标识；
 *     「匿名」文案由前端按 locale 渲染，避免中文串泄漏到英文界面
 *
 * 注意：本函数必须在 maskSongsInfo 之后调用，否则匿名效果会被姓名脱敏规则覆盖。
 */
export function applySubmissionAnonymity(songs: MaskableSong[], viewer?: AnonymityViewer | null) {
  if (viewer?.isAdmin) return

  songs.forEach((song) => {
    if (song.submissionAnonymous !== true) return

    const viewerId = viewer?.id ?? null
    const requesterId = song.requesterId ?? null
    if (viewerId !== null && requesterId !== null && Number(requesterId) === Number(viewerId)) {
      return
    }

    song.isAnonymous = true
    song.requester = undefined
    song.requesterGrade = null
    song.requesterClass = null
    // 投稿人自己申请的重播也会出现在重播申请人里，同样以匿名展示，避免自曝
    if (requesterId !== null && song.replayRequesters?.length) {
      for (const replayRequester of song.replayRequesters) {
        if (replayRequester.id != null && Number(replayRequester.id) === Number(requesterId)) {
          replayRequester.isAnonymous = true
          delete replayRequester.name
          delete replayRequester.displayName
        }
      }
    }
    // 联合投稿人一旦公开，等价于泄露匿名投稿的圈子
    if (song.collaborators) song.collaborators = []
    // 复用既有的标识剥离逻辑，避免通过内部 ID 交叉关联
    stripAnonymousSongIdentifiers(song)
  })
}

/** 批量处理公共排期（`{ song: {...} }` 嵌套结构）。 */
export function applySubmissionAnonymityToSchedules(
  data: PublicScheduleItem[],
  viewer?: AnonymityViewer | null
) {
  if (viewer?.isAdmin) return
  applySubmissionAnonymity(
    data.map((item) => item.song).filter(Boolean) as MaskableSong[],
    viewer
  )
}
