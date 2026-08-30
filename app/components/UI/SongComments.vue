<template>
  <section class="song-comments" @click.stop>
    <header class="comments-header">
      <div>
        <p class="comments-eyebrow">{{ locale.eyebrow }}</p>
        <h2 class="comments-title">{{ locale.title }}</h2>
      </div>
      <div class="comments-sort" role="group">
        <button :class="{ active: commentSort === 'hot' }" @click="commentSort = 'hot'">{{ locale.hotSort }}</button>
        <button :class="{ active: commentSort === 'latest' }" @click="commentSort = 'latest'">{{ locale.latest }}</button>
      </div>
      <button
        class="refresh-button"
        :disabled="isLoading || !canFetchComments"
        :title="locale.refresh"
        @click="refreshComments"
      >
        <Icon name="refresh" size="18" />
      </button>
    </header>

    <div v-if="!canFetchComments" class="comments-state">
      <Icon name="message-circle" size="28" />
      <p>{{ locale.noSource }}</p>
    </div>

    <div v-else-if="isLoading && !commentItems.length" class="comments-state">
      <AppSpinner :size="24" />
      <p>{{ locale.loading }}</p>
    </div>

    <div v-else-if="error" class="comments-state">
      <Icon name="alert-circle" size="28" />
      <p>{{ error }}</p>
      <button class="state-action" @click="refreshComments">{{ locale.retry }}</button>
    </div>

    <template v-else>
      <div v-if="totalCount || hotComments.length" class="comments-summary">
        <span v-if="totalCount">{{ formatLocaleValue(locale.commentsCount, formatCount(totalCount)) }}</span>
        <span v-if="hotComments.length">{{ formatLocaleValue(locale.hotCount, hotComments.length) }}</span>
      </div>

      <div v-if="!commentItems.length" class="comments-state">
        <Icon name="message-circle" size="28" />
        <p>{{ locale.empty }}</p>
      </div>

      <div v-else class="comments-list">
        <article v-for="item in commentItems" :key="item.key" class="comment-item">
          <div class="avatar">
            <img
              v-if="item.user?.avatarUrl"
              :src="convertToHttps(item.user.avatarUrl)"
              :alt="item.user?.nickname || locale.userAvatar"
              referrerpolicy="no-referrer"
            >
            <Icon v-else name="user" size="18" />
          </div>

          <div class="comment-body">
            <div class="comment-meta">
              <span class="nickname">{{ item.user?.nickname || locale.neteaseUser }}</span>
              <span v-if="item.user?.ip" class="comment-ip">{{ locale.ipLabel }} {{ item.user.ip }}</span>
              <span class="comment-time">{{ formatCommentTime(item.time) }}</span>
            </div>
            <p class="comment-content" v-html="renderCommentContent(item.content)"></p>
            <div v-if="item.images?.length" class="comment-images">
              <img v-for="(image, imageIndex) in item.images" :key="`image-${imageIndex}`" :src="getCommentImageUrl(image)" :alt="locale.commentImage" loading="lazy" referrerpolicy="no-referrer">
            </div>
            <div v-if="item.beReplied?.length" class="reply-preview">
              {{ item.beReplied[0]?.user?.nickname || locale.originalComment }}：{{ item.beReplied[0]?.content }}
            </div>
            <div v-for="reply in item.replies" :key="`reply-${reply.commentId}`" class="reply-preview">
              <div class="reply-meta">{{ reply.user?.nickname || locale.neteaseUser }}<span v-if="reply.user?.ip"> · {{ locale.ipLabel }} {{ reply.user.ip }}</span></div>
              <div v-html="renderCommentContent(reply.content)"></div>
              <div v-if="reply.images?.length" class="comment-images reply-images">
                <img v-for="(image, imageIndex) in reply.images" :key="`reply-image-${imageIndex}`" :src="getCommentImageUrl(image)" :alt="locale.commentImage" loading="lazy" referrerpolicy="no-referrer">
              </div>
            </div>
            <div class="comment-actions">
              <button
                class="liked-count"
                :class="{ liked: item.liked }"
                :disabled="likeUpdatingKey === String(item.commentId)"
                :title="item.liked ? locale.unlike : locale.like"
                @click="toggleCommentLike(item)"
              >
                <Icon name="thumbs-up" size="13" />
                {{ formatCount(item.likedCount || 0) }}
              </button>
              <span v-if="item.isHot" class="hot-label">{{ locale.hot }}</span>
            </div>
          </div>
        </article>
      </div>

      <button
        v-if="hasMore"
        class="load-more-button"
        :disabled="isLoading"
        @click="loadMoreComments"
      >
        {{ isLoading ? locale.loadingMore : locale.loadMore }}
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { fetchNetease } from '~/utils/neteaseApi'
import { convertToHttps, getNeteaseCookie } from '~/utils/url'
import { useLocale } from '~/utils/locale'

interface NeteaseUser {
  avatarUrl?: string
  nickname?: string
  ip?: string
}

interface NeteaseComment {
  commentId?: number | string
  content?: string
  time?: number
  likedCount?: number
  liked?: boolean
  user?: NeteaseUser
  beReplied?: Array<{
    content?: string
    user?: NeteaseUser
  }>
  replies?: NeteaseComment[]
  images?: string[]
  isHot?: boolean
  key?: string
}

const props = defineProps<{
  song?: {
    musicId?: string | number | null
    musicPlatform?: string | null
  } | null
  visible?: boolean
}>()

const PAGE_SIZE = 20
const { ui } = useLocale()
const locale = computed(() => {
  const base = ui.value?.songComments || {}
  const emptyText = () => ''
  const qq = props.song?.musicPlatform === 'tencent'
  return useSafeLocale({
    ...base,
    eyebrow: qq ? (base.qqEyebrow || base.eyebrow) : base.eyebrow,
    noSource: qq ? (base.qqNoSource || base.noSource) : base.noSource,
    neteaseUser: qq ? (base.qqUser || base.neteaseUser) : base.neteaseUser,
    commentsCount: base.commentsCount || emptyText,
    hotCount: base.hotCount || emptyText,
    minutesAgo: base.minutesAgo || emptyText,
    hoursAgo: base.hoursAgo || emptyText
  })
})

const comments = ref<NeteaseComment[]>([])
const hotComments = ref<NeteaseComment[]>([])
const totalCount = ref(0)
const hasMore = ref(false)
const offset = ref(0)
const isLoading = ref(false)
const error = ref('')
const likeUpdatingKey = ref('')
const requestId = ref(0)
const hasLoaded = ref(false)
const commentSort = ref('hot')

const neteaseSongId = computed(() => {
  const song = props.song
  if (!song || song.musicPlatform !== 'netease') return null

  const id = String(song.musicId || '').trim()
  if (!/^\d+$/.test(id)) return null
  return id
})

const tencentSongId = computed(() => {
  const song = props.song
  if (!song || song.musicPlatform !== 'tencent') return null
  const id = String(song.musicId || '').trim()
  return id || null
})

const canFetchComments = computed(() => !!neteaseSongId.value || !!tencentSongId.value)
const isTencent = computed(() => !!tencentSongId.value)

const commentItems = computed(() => {
  const unique = (items: NeteaseComment[]) => {
    const seen = new Set<string>()
    return items.filter((item) => {
      const key = item.commentId != null ? `id:${item.commentId}` : `text:${item.user?.nickname || ''}|${item.time || 0}|${item.content || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const taggedHotComments = unique(hotComments.value).map((item) => ({ ...item, isHot: true }))
  const seenIds = new Set(
    taggedHotComments
      .map((item) => item.commentId)
      .filter((commentId) => commentId !== undefined && commentId !== null)
      .map((commentId) => String(commentId))
  )
  const regularComments = unique(comments.value).filter((item) => {
    if (item.commentId === undefined || item.commentId === null) return true
    const key = String(item.commentId)
    if (seenIds.has(key)) return false
    seenIds.add(key)
    return true
  })

  const latest = [...regularComments].sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
  const popular = [...taggedHotComments].sort((a, b) => Number(b.likedCount || 0) - Number(a.likedCount || 0))
  const ordered = commentSort.value === 'hot' ? [...popular, ...latest] : [...latest, ...popular]
  return ordered.map((item, index) => ({
    ...item,
    key: getCommentKey(item, index)
  }))
})

function getCommentKey(item: NeteaseComment, index: number) {
  const prefix = item.isHot ? 'hot' : 'comment'
  if (item.commentId !== undefined && item.commentId !== null) {
    return `${prefix}-${item.commentId}`
  }

  const fallback = [item.user?.nickname, item.time, item.content]
    .filter(Boolean)
    .join('-')
    .slice(0, 96)

  return `${prefix}-${fallback || `fallback-${index}`}`
}

const formatCount = (count: number) => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1)}${locale.value.tenThousand}`
  }
  return String(count)
}

const formatCommentTime = (time?: number) => {
  if (!time) return ''

  const date = new Date(time)
  const now = getSyncedDate()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return locale.value.justNow
  if (diffMinutes < 60) return formatLocaleValue(locale.value.minutesAgo, diffMinutes)
  if (diffMinutes < 1440) return formatLocaleValue(locale.value.hoursAgo, Math.floor(diffMinutes / 60))

  const isSameYear = date.getFullYear() === now.getFullYear()

  const formatted = date.toLocaleString(locale.value.dateLocale, {
    ...(isSameYear ? {} : { year: 'numeric' }),
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  return formatted.replace(/\//g, '-')
}

const updateCommentLikeState = (commentId: string | number, liked: boolean, likedCount: number) => {
  const applyState = (item: NeteaseComment) => {
    if (String(item.commentId) !== String(commentId)) return item
    return {
      ...item,
      liked,
      likedCount
    }
  }

  comments.value = comments.value.map(applyState)
  hotComments.value = hotComments.value.map(applyState)
}

const renderCommentContent = (content?: string) => {
  const source = String(content || '')
  const images: string[] = []
  const withPlaceholders = source.replace(/(?:<img\b[^>]*?src=["']([^"']+)["'][^>]*>|&lt;img\b[^>]*?src=(?:["']|&quot;)([^"'&]+)(?:["']|&quot;)[^&]*&gt;)/gi, (_tag, src, encodedSrc) => {
    images.push(getCommentImageUrl(src || encodedSrc))
    return `\u0000${images.length - 1}\u0000`
  })
  const escaped = withPlaceholders.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(/\[em\][^\[]*\[\/em\]/gi, '🙂')
    .replace(/\u0000(\d+)\u0000/g, (_match, index) => `<img src="${images[Number(index)].replace(/"/g, '&quot;')}" alt="" class="inline-comment-emoji">`)
}

const getCommentImageUrl = (url?: string) => {
  const value = String(url || '').trim()
  if (!value) return ''
  const absolute = value.startsWith('//') ? `https:${value}` : convertToHttps(value)
  return `/api/proxy/image?url=${encodeURIComponent(absolute)}`
}

const toggleCommentLike = async (comment: NeteaseComment) => {
  const songId = neteaseSongId.value || tencentSongId.value
  if (
    !songId ||
    comment.commentId === undefined ||
    comment.commentId === null ||
    likeUpdatingKey.value
  ) {
    return
  }

  const cookie = isTencent.value
    ? (typeof window !== 'undefined' ? localStorage.getItem('qq_music_cookie') || '' : '')
    : getNeteaseCookie()
  if (!cookie) {
    if (window.$showNotification) {
      window.$showNotification(isTencent.value ? locale.value.qqLoginRequiredToLike : locale.value.loginRequiredToLike, 'warning')
    }
    return
  }

  const commentId = comment.commentId
  const nextLiked = !comment.liked
  const currentLikedCount = Number(comment.likedCount || 0)
  const nextLikedCount = Math.max(0, currentLikedCount + (nextLiked ? 1 : -1))

  likeUpdatingKey.value = String(commentId)
  updateCommentLikeState(commentId, nextLiked, nextLikedCount)

  try {
    const response = isTencent.value
      ? await $fetch('/api/native-api/comment/tx-like', { method: 'POST', body: { musicId: tencentSongId.value, commentId, liked: nextLiked, cookie } })
      : await fetchNetease(
      '/comment/like',
      {
        id: songId,
        cid: commentId,
        t: nextLiked ? 1 : 0,
        type: 0
      },
      cookie
    )

    if (response.code !== 200) {
    throw new Error(response.message || locale.value.likeFailed)
    }
  } catch (err: any) {
    updateCommentLikeState(commentId, !!comment.liked, currentLikedCount)
    if (window.$showNotification) {
    window.$showNotification(err?.data?.message || err?.message || locale.value.likeFailed, 'error')
    }
  } finally {
    likeUpdatingKey.value = ''
  }
}

const fetchComments = async (append = false) => {
  const songId = neteaseSongId.value || tencentSongId.value
  if (!songId || isLoading.value) return

  const currentRequestId = append ? requestId.value : requestId.value + 1
  requestId.value = currentRequestId
  isLoading.value = true
  error.value = ''

  try {
    const nextOffset = append ? offset.value : 0
    const lastCommentTime = append ? comments.value[comments.value.length - 1]?.time : undefined
    const params: Record<string, string | number> = {
      id: songId,
      limit: PAGE_SIZE
    }

    if (append && nextOffset >= 5000 && lastCommentTime) {
      params.before = lastCommentTime
    } else {
      params.offset = nextOffset
    }

    const response = neteaseSongId.value
      ? await fetchNetease('/comment/music', params)
      : await $fetch('/api/native-api/comment/tx', { params: { musicId: tencentSongId.value, page: Math.floor(nextOffset / PAGE_SIZE), pageSize: PAGE_SIZE } })

    if (currentRequestId !== requestId.value) return

    if (response.code !== 200) {
    error.value = response.message || locale.value.loadFailed
      return
    }

    const body = response.body || response.data || {}
    const nextComments = Array.isArray(body.comments) ? body.comments : []

    hasLoaded.value = true
    comments.value = append ? [...comments.value, ...nextComments] : nextComments
    hotComments.value = append
      ? hotComments.value
      : Array.isArray(body.hotComments)
        ? body.hotComments.slice(0, 8)
        : []
    totalCount.value = Number(body.total || 0)
    hasMore.value =
      typeof body.more === 'boolean'
        ? body.more
        : comments.value.length + hotComments.value.length < totalCount.value
    offset.value = nextOffset + PAGE_SIZE
  } catch (err: any) {
    if (currentRequestId !== requestId.value) return
    error.value = err?.data?.message || err?.message || locale.value.loadFailed
  } finally {
    if (currentRequestId === requestId.value) {
      isLoading.value = false
    }
  }
}

const resetComments = () => {
  requestId.value += 1
  isLoading.value = false
  hasLoaded.value = false
  comments.value = []
  hotComments.value = []
  totalCount.value = 0
  hasMore.value = false
  offset.value = 0
  error.value = ''
}

const refreshComments = () => {
  resetComments()
  if (canFetchComments.value) {
    fetchComments(false)
  }
}

const loadMoreComments = () => {
  fetchComments(true)
}

watch(
  () => [neteaseSongId.value || tencentSongId.value, props.visible] as const,
  ([songId, visible], oldValue) => {
    const oldSongId = oldValue?.[0]

    if (songId !== oldSongId) {
      resetComments()
    }

    if (songId && visible && !hasLoaded.value && !isLoading.value) {
      fetchComments(false)
    }
  },
  { immediate: true }
)

defineExpose({ totalCount })
</script>

<style scoped>
.song-comments {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--lyrics-modal-text);
  overflow: hidden;
}

.comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.comments-eyebrow {
  margin: 0 0 0.25rem;
  color: var(--lyrics-modal-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.comments-title {
  margin: 0;
  color: var(--lyrics-modal-text);
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0;
}

.refresh-button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lyrics-modal-text-secondary);
  background: var(--lyrics-modal-surface);
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-button:hover:not(:disabled) {
  color: var(--lyrics-modal-text);
  background: var(--lyrics-modal-surface-strong);
}

.refresh-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.comments-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  padding-bottom: 1rem;
  color: var(--lyrics-modal-text-muted);
  font-size: 0.82rem;
  font-weight: 600;
}

.comments-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comments-list::-webkit-scrollbar {
  width: 6px;
}

.comments-list::-webkit-scrollbar-track {
  background: transparent;
}

.comments-list::-webkit-scrollbar-thumb {
  background: var(--lyrics-modal-surface-strong);
  border-radius: 999px;
}

.comment-item {
  display: flex;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--lyrics-modal-surface-border);
  border-radius: 8px;
  background: var(--lyrics-modal-surface);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lyrics-modal-surface);
  color: var(--lyrics-modal-text-muted);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comment-body {
  min-width: 0;
  flex: 1;
}

.comment-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.nickname {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lyrics-modal-text);
  font-size: 0.9rem;
  font-weight: 700;
}

.comment-time {
  flex-shrink: 0;
  color: var(--lyrics-modal-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.comment-content {
  margin: 0;
  color: var(--lyrics-modal-text-secondary);
  font-size: 0.95rem;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.comments-sort {
  display: inline-flex;
  gap: 0.2rem;
  margin-left: auto;
  padding: 0.2rem;
  border-radius: 6px;
  background: var(--lyrics-modal-surface);
}

.comments-sort button {
  border: 0;
  border-radius: 4px;
  padding: 0.35rem 0.55rem;
  color: var(--lyrics-modal-text-muted);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
}

.comments-sort button.active {
  color: var(--lyrics-modal-text);
  background: var(--lyrics-modal-surface-strong);
}

.comment-content :deep(.inline-comment-emoji),
.reply-preview :deep(.inline-comment-emoji) {
  width: 1.35em;
  height: 1.35em;
  display: inline-block;
  vertical-align: -0.3em;
  object-fit: contain;
}

.comment-images {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.7rem;
}

.comment-images img {
  width: 96px;
  height: 96px;
  border-radius: 6px;
  object-fit: cover;
  background: var(--lyrics-modal-surface-strong);
}

.comment-ip,
.reply-meta {
  color: var(--lyrics-modal-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.reply-meta {
  margin-bottom: 0.25rem;
}

.reply-preview {
  margin-top: 0.7rem;
  padding: 0.65rem 0.8rem;
  border-radius: 8px;
  color: var(--lyrics-modal-text-muted);
  background: var(--surface-card-bg-soft);
  font-size: 0.82rem;
  line-height: 1.55;
  word-break: break-word;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.65rem;
  color: var(--lyrics-modal-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.liked-count {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  font: inherit;
  transition: color 0.2s ease, transform 0.2s ease;
}

.liked-count:hover:not(:disabled),
.liked-count.liked {
  color: var(--lyrics-modal-text);
}

.liked-count:hover:not(:disabled) {
  transform: translateY(-1px);
}

.liked-count:disabled {
  cursor: wait;
  opacity: 0.6;
}

.hot-label {
  color: var(--lyrics-modal-text-secondary);
}

.comments-state {
  flex: 1;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--lyrics-modal-text-muted);
  text-align: center;
}

.comments-state p {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.state-action,
.load-more-button {
  border: 0;
  border-radius: 8px;
  color: var(--lyrics-modal-text);
  background: var(--lyrics-modal-surface);
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s ease;
}

.state-action {
  padding: 0.55rem 0.95rem;
}

.load-more-button {
  flex-shrink: 0;
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
}

.state-action:hover,
.load-more-button:hover:not(:disabled) {
  background: var(--lyrics-modal-surface-strong);
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

@media (max-width: 1024px) {
  .song-comments {
    padding-top: 0;
  }

  .comments-header {
    padding: 0 0 0.8rem 0;
    align-items: flex-start;
  }

  .comments-eyebrow {
    font-size: 0.68rem;
  }

  .comments-title {
    font-size: 1.08rem;
  }

  .refresh-button {
    margin-top: 44px;
  }

  .comments-list {
    padding-right: 0;
  }

  .comment-item {
    padding: 0.85rem;
  }
}
</style>
