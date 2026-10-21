import type { H3Event } from 'h3'
import { getCookie } from 'h3'
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
  /** 重播申请人本人即匿名投稿人时置 true */
  isAnonymous?: boolean
  [key: string]: any
}

/**
 * 可脱敏的歌曲信息接口
 */
export interface MaskableSong {
  /** 逐条投稿的匿名标记（Song.submissionAnonymous） */
  submissionAnonymous?: boolean
  /** 当前查看者视角下该投稿为匿名投稿（requester 已被替换为匿名文案） */
  isAnonymous?: boolean
  requester?: string
  requesterGrade?: string | null
  requesterClass?: string | null
  collaborators?: MaskableUser[]
  replayRequesters?: MaskableUser[]
  [key: string]: any
}

/**
 * 候选人选择场景的姓名脱敏：保留首字，其余字符以星号代替。
 * 用于联合投稿邀请等必须区分同名候选人的接口，不能返回完整姓名。
 */
export function maskStudentNameForPicker(name: string): string {
  if (!name) return name
  return name.length <= 1 ? name : name[0] + '*'.repeat(name.length - 1)
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
  /** 匿名文案的展示语言来源；缺省（开放 API、脚本调用等）按中文兜底 */
  event?: H3Event | null
}

/** 匿名投稿对外展示的投稿人文案，与词典 pages.songs.songList.anonymousRequester 保持一致 */
export const ANONYMOUS_REQUESTER_LABELS = {
  'zh-CN': '匿名投稿',
  'en-US': 'Anonymous'
} as const

/**
 * 解析匿名投稿文案的语言。
 * 语言 cookie 由 app/plugins/locale.ts 在 SSR 渲染时写入，因此页面内的接口请求总能取到；
 * 无 cookie 时（开放 API、机器人等外部调用）按中文兜底。
 */
export function resolveAnonymousRequesterLabel(event?: H3Event | null): string {
  const locale = event ? getCookie(event, 'voicehub.locale') : undefined
  return locale === 'en-US' ? ANONYMOUS_REQUESTER_LABELS['en-US'] : ANONYMOUS_REQUESTER_LABELS['zh-CN']
}

/**
 * 按「逐条投稿的匿名标记」脱敏。
 *
 * 只有 submissionAnonymous === true 的投稿会被处理：
 *   - 管理员：完全跳过（后台始终能看到真实投稿人，便于管理追溯）
 *   - 投稿人本人：跳过（自己的投稿自己可见，便于在列表里辨认）
 *   - 其他登录用户 / 游客：置 isAnonymous=true，并把 requester 直接替换为「匿名投稿」文案；
 *     站内与外部消费方都按 requester 渲染投稿人，清空会显示为空，因此必须回填占位文案；
 *     同时移除年级班级、联合投稿人以及 requesterId / cardCodeId 等可被交叉关联的内部标识
 *
 * 前端仍保留 isAnonymous 判断，按当前界面语言渲染 locale.anonymousRequester。
 *
 * 注意：本函数必须在 maskSongsInfo 之后调用，否则匿名效果会被姓名脱敏规则覆盖。
 */
export function applySubmissionAnonymity(songs: MaskableSong[], viewer?: AnonymityViewer | null) {
  if (viewer?.isAdmin) return

  const anonymousLabel = resolveAnonymousRequesterLabel(viewer?.event)

  songs.forEach((song) => {
    if (song.submissionAnonymous !== true) return

    const viewerId = viewer?.id ?? null
    const requesterId = song.requesterId ?? null
    if (viewerId !== null && requesterId !== null && Number(requesterId) === Number(viewerId)) {
      return
    }

    song.isAnonymous = true
    song.requester = anonymousLabel
    song.requesterGrade = null
    song.requesterClass = null
    // 投稿人自己申请的重播也会出现在重播申请人里，同样以匿名展示，避免自曝
    if (requesterId !== null && song.replayRequesters?.length) {
      for (const replayRequester of song.replayRequesters) {
        if (replayRequester.id != null && Number(replayRequester.id) === Number(requesterId)) {
          replayRequester.isAnonymous = true
          replayRequester.name = anonymousLabel
          replayRequester.displayName = anonymousLabel
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
