<template>
  <section class="song-comments" @click.stop>
    <header class="comments-header">
      <div>
        <p class="comments-eyebrow">{{ locale.eyebrow }}</p>
        <h2 class="comments-title">{{ locale.title }}</h2>
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
      <div class="loading-spinner" />
      <p>{{ locale.loading }}</p>
    </div>

    <div v-else-if="error" class="comments-state">
      <Icon name="alert-circle" size="28" />
      <p>{{ error }}</p>
      <button class="state-action" @click="refreshComments">{{ locale.retry }}</button>
    </div>

    <template v-else>
      <div v-if="totalCount || hotComments.length" class="comments-summary">
        <span v-if="totalCount">{{ locale.commentsCount(formatCount(totalCount)) }}</span>
        <span v-if="hotComments.length">{{ locale.hotCount(hotComments.length) }}</span>
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
              <span class="comment-time">{{ formatCommentTime(item.time) }}</span>
            </div>
            <p class="comment-content">{{ item.content }}</p>
            <div v-if="item.beReplied?.length" class="reply-preview">
              {{ item.beReplied[0]?.user?.nickname || locale.originalComment }}：{{ item.beReplied[0]?.content }}
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
import { fetchNetease } from '~/utils/neteaseApi'
import { convertToHttps, getNeteaseCookie } from '~/utils/url'
import { useLocale } from '~/composables/useLocale'

interface NeteaseUser {
  avatarUrl?: string
  nickname?: string
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
const locale = computed(() => ui.value.songComments)

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

const neteaseSongId = computed(() => {
  const song = props.song
  if (!song || song.musicPlatform !== 'netease') return null

  const id = String(song.musicId || '').trim()
  if (!/^\d+$/.test(id)) return null
  return id
})

const canFetchComments = computed(() => !!neteaseSongId.value)

const commentItems = computed(() => {
  const taggedHotComments = hotComments.value.map((item) => ({ ...item, isHot: true }))
  const seenIds = new Set(
    taggedHotComments
      .map((item) => item.commentId)
      .filter((commentId) => commentId !== undefined && commentId !== null)
      .map((commentId) => String(commentId))
  )
  const regularComments = comments.value.filter((item) => {
    if (item.commentId === undefined || item.commentId === null) return true
    const key = String(item.commentId)
    if (seenIds.has(key)) return false
    seenIds.add(key)
    return true
  })

  return [...taggedHotComments, ...regularComments].map((item, index) => ({
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
  if (diffMinutes < 60) return locale.value.minutesAgo(diffMinutes)
  if (diffMinutes < 1440) return locale.value.hoursAgo(Math.floor(diffMinutes / 60))

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

const toggleCommentLike = async (comment: NeteaseComment) => {
  const songId = neteaseSongId.value
  if (
    !songId ||
    comment.commentId === undefined ||
    comment.commentId === null ||
    likeUpdatingKey.value
  ) {
    return
  }

  const cookie = getNeteaseCookie()
  if (!cookie) {
    if (window.$showNotification) {
      window.$showNotification(locale.value.loginRequiredToLike, 'warning')
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
    const response = await fetchNetease(
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
  const songId = neteaseSongId.value
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

    const response = await fetchNetease('/comment/music', params)

    if (currentRequestId !== requestId.value) return

    if (response.code !== 200) {
    error.value = response.message || locale.value.loadFailed
      return
    }

    const body = response.body || {}
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
  if (neteaseSongId.value) {
    fetchComments(false)
  }
}

const loadMoreComments = () => {
  fetchComments(true)
}

watch(
  () => [neteaseSongId.value, props.visible] as const,
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
</script>

<style scoped>
.song-comments {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: #ffffff;
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
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.75rem;
  font-weight: 700;
}

.comments-title {
  margin: 0;
  color: #ffffff;
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
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-button:hover:not(:disabled) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
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
  color: rgba(255, 255, 255, 0.62);
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
  background: rgba(255, 255, 255, 0.22);
  border-radius: 999px;
}

.comment-item {
  display: flex;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
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
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
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
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.9rem;
  font-weight: 700;
}

.comment-time {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.42);
  font-size: 0.75rem;
  font-weight: 600;
}

.comment-content {
  margin: 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.95rem;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.reply-preview {
  margin-top: 0.7rem;
  padding: 0.65rem 0.8rem;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.58);
  background: rgba(0, 0, 0, 0.18);
  font-size: 0.82rem;
  line-height: 1.55;
  word-break: break-word;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.65rem;
  color: rgba(255, 255, 255, 0.52);
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
  color: rgba(255, 255, 255, 0.92);
}

.liked-count:hover:not(:disabled) {
  transform: translateY(-1px);
}

.liked-count:disabled {
  cursor: wait;
  opacity: 0.6;
}

.hot-label {
  color: rgba(255, 255, 255, 0.86);
}

.comments-state {
  flex: 1;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: rgba(255, 255, 255, 0.62);
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
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
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
  background: rgba(255, 255, 255, 0.22);
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
