<template>
  <section class="song-comments" @click.stop>
    <header class="comments-header">
      <div>
        <p class="comments-eyebrow">{{ locale.eyebrow }}</p>
        <h2 class="comments-title">{{ locale.title }}</h2>
      </div>
      <div class="comments-sort" role="group">
        <button :class="{ active: commentSort === 'hot' }" @click="selectCommentSort('hot')">
          {{ locale.hotSort }} ({{ formatCount(sortTotals.hot) }})
        </button>
        <button :class="{ active: commentSort === 'latest' }" @click="selectCommentSort('latest')">
          {{ locale.latest }} ({{ formatCount(sortTotals.latest) }})
        </button>
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

    <div v-else-if="error && !commentItems.length" class="comments-state">
      <Icon name="alert-circle" size="28" />
      <p>{{ error }}</p>
      <button class="state-action" @click="refreshComments">{{ locale.retry }}</button>
    </div>

    <template v-else>
      <div v-if="totalCount" class="comments-summary">
        <span v-if="totalCount">{{
          formatLocaleValue(locale.commentsCount, String(totalCount))
        }}</span>
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
              <div class="comment-user">
                <span class="nickname">{{ item.user?.nickname || locale.neteaseUser }}</span>
                <span v-if="item.user?.location" class="comment-location">
                  {{ locale.locationLabel }} {{ item.user.location }}
                </span>
              </div>
              <span class="comment-time">{{ formatCommentTime(item.time) }}</span>
            </div>
            <div class="comment-content">
              <span>{{ item.content }}</span>
              <img
                v-for="(emoji, emojiIndex) in item.emojis"
                :key="`emoji-${emojiIndex}`"
                :src="getCommentImageUrl(emoji)"
                alt=""
                class="inline-comment-emoji"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="handleCommentImageError($event, emoji)"
              >
            </div>
            <div v-if="item.images?.length" class="comment-images">
              <img
                v-for="(image, imageIndex) in item.images"
                :key="`image-${imageIndex}`"
                :src="getCommentImageUrl(image)"
                :alt="locale.commentImage"
                loading="lazy"
                referrerpolicy="no-referrer"
                class="comment-image-previewable"
                role="button"
                tabindex="0"
                :aria-label="locale.openImagePreview"
                @click="openCommentImagePreview($event, image)"
                @error="handleCommentImageError($event, image)"
                @keydown.enter.prevent="openCommentImagePreview($event, image)"
              >
            </div>
            <div v-if="item.beReplied?.length" class="reply-preview">
              <div class="reply-meta">
                {{ item.beReplied[0]?.user?.nickname || locale.originalComment
                }}<span v-if="item.beReplied[0]?.user?.location">
                  · {{ locale.locationLabel }} {{ item.beReplied[0].user.location }}</span
                >
              </div>
              <div>{{ item.beReplied[0]?.content }}</div>
            </div>
            <div
              v-for="reply in getVisibleReplies(item)"
              :key="reply.displayKey"
              class="reply-preview"
              :style="{ '--reply-depth': reply.displayDepth }"
            >
              <div class="reply-meta">
                <div class="reply-user">
                  <div v-if="!isTencent" class="reply-avatar">
                    <img
                      v-if="reply.user?.avatarUrl"
                      :src="convertToHttps(reply.user.avatarUrl)"
                      :alt="reply.user?.nickname || locale.userAvatar"
                      referrerpolicy="no-referrer"
                      @error="handleCommentImageError($event, reply.user.avatarUrl)"
                    >
                    <Icon v-else name="user" size="12" />
                  </div>
                  <span>{{ reply.user?.nickname || locale.neteaseUser }}</span>
                  <span v-if="reply.user?.location">
                    · {{ locale.locationLabel }} {{ reply.user.location }}</span
                  >
                </div>
              </div>
              <div class="reply-content">
                <span>{{ reply.content }}</span>
                <img
                  v-for="(emoji, emojiIndex) in reply.emojis || []"
                  :key="`reply-emoji-${emojiIndex}`"
                  :src="getCommentImageUrl(emoji)"
                  alt=""
                  class="inline-comment-emoji"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  @error="handleCommentImageError($event, emoji)"
                >
              </div>
              <div v-if="reply.images?.length" class="comment-images reply-images">
                <img
                  v-for="(image, imageIndex) in reply.images"
                  :key="`reply-image-${imageIndex}`"
                  :src="getCommentImageUrl(image)"
                  :alt="locale.commentImage"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="comment-image-previewable"
                  role="button"
                  tabindex="0"
                  :aria-label="locale.openImagePreview"
                  @click="openCommentImagePreview($event, image)"
                  @error="handleCommentImageError($event, image)"
                  @keydown.enter.prevent="openCommentImagePreview($event, image)"
                >
              </div>
              <div v-if="!isTencent" class="reply-actions">
                <span class="qq-liked-count">
                  <Icon name="thumbs-up" size="13" />
                  {{ formatCount(reply.likedCount || 0) }}
                </span>
              </div>
            </div>
            <button
              v-if="!isTencent && item.displayReplies.length > 1"
              class="replies-toggle"
              type="button"
              @click="toggleReplies(item.key)"
            >
              {{ isRepliesExpanded(item.key) ? locale.hideReplies : locale.showMoreReplies }}
              ({{ item.displayReplies.length }})
            </button>
            <div class="comment-actions">
              <button
                v-if="!isTencent"
                class="liked-count"
                :class="{ liked: item.liked }"
                :disabled="likeUpdatingKey === String(item.commentId)"
                :title="item.liked ? locale.unlike : locale.like"
                @click="toggleCommentLike(item)"
              >
                <Icon :name="item.liked ? 'thumbs-up-filled' : 'thumbs-up'" size="13" />
                {{ formatCount(item.likedCount || 0) }}
              </button>
              <span v-else class="qq-liked-count">
                <Icon name="thumbs-up" size="13" />
                {{ formatCount(item.likedCount || 0) }}
              </span>
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

  <Teleport to="body">
    <div
      v-if="previewImageUrl"
      class="comment-image-preview"
      role="dialog"
      aria-modal="true"
      :aria-label="locale.commentImage"
      @click.self="closeCommentImagePreview"
    >
      <button
        class="comment-image-preview-close"
        :title="locale.closeImagePreview"
        :aria-label="locale.closeImagePreview"
        @click="closeCommentImagePreview"
      >
        <Icon name="x" size="24" />
      </button>
      <img :src="previewImageUrl" :alt="locale.commentImage">
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { fetchNetease } from '~/utils/neteaseApi'
import { convertToHttps, getNeteaseCookie } from '~/utils/url'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'

const props = defineProps({
  song: {
    type: Object,
    default: null
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const PAGE_SIZE = 20
const { ui } = useLocale()
const { localize: localizeServerError } = useServerErrors()
const locale = computed(() => {
  const base = ui.value?.songComments || {}
  const emptyText = () => ''
  const qq = props.song?.musicPlatform === 'tencent'
  return useSafeLocale({
    ...base,
    eyebrow: qq ? base.qqEyebrow || base.eyebrow : base.eyebrow,
    noSource: qq ? base.qqNoSource || base.noSource : base.noSource,
    neteaseUser: qq ? base.qqUser || base.neteaseUser : base.neteaseUser,
    commentsCount: base.commentsCount || emptyText,
    minutesAgo: base.minutesAgo || emptyText,
    hoursAgo: base.hoursAgo || emptyText
  })
})

const comments = ref([])
const hotComments = ref([])
const sortTotals = ref({ hot: 0, latest: 0 })
const sortHasMore = ref({ hot: false, latest: false })
const sortOffsets = ref({ hot: 0, latest: 0 })
const sortCursors = ref({ hot: '', latest: '' })
const sortLoaded = ref({ hot: false, latest: false })
const sortErrors = ref({ hot: '', latest: '' })
const sortLoading = ref({ hot: false, latest: false })
const loadingCount = ref(0)
const likeUpdatingKey = ref('')
const previewImageUrl = ref('')
const requestId = ref(0)
const commentSort = ref('hot')
const expandedReplyKeys = ref(new Set())
const pendingQqReplies = ref([])
const isLoading = computed(() => loadingCount.value > 0)
const error = computed(() => sortErrors.value[commentSort.value] || '')
const totalCount = computed(() => sortTotals.value.latest || sortTotals.value.hot || 0)
const hasMore = computed(() => {
  if (props.song?.musicPlatform === 'tencent' && commentSort.value === 'hot') {
    return Boolean(sortHasMore.value.hot || sortHasMore.value.latest)
  }
  return Boolean(sortHasMore.value[commentSort.value])
})

const selectCommentSort = (value) => {
  if (commentSort.value === value) return
  commentSort.value = value
  if (props.visible && !sortLoaded.value[value]) {
    fetchComments(false, value)
  }
}

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

const tencentOriginalSongId = computed(() => {
  const song = props.song
  if (!song || song.musicPlatform !== 'tencent') return null
  const id = String(song.sourceInfo?.originalSongId || song.originalSongId || '').trim()
  return /^\d+$/.test(id) ? id : null
})

const canFetchComments = computed(() => !!neteaseSongId.value || !!tencentSongId.value)
const isTencent = computed(() => !!tencentSongId.value)
const commentSourceKey = computed(() => {
  if (neteaseSongId.value) return `netease:${neteaseSongId.value}`
  if (tencentSongId.value) {
    return `tencent:${tencentSongId.value}:${tencentOriginalSongId.value || ''}`
  }
  return ''
})

const flattenCommentReplies = (replies) => {
  const flattened = []

  const visit = (items, depth, path, ancestorIds) => {
    if (!Array.isArray(items) || depth > 8) return

    items.forEach((reply, index) => {
      if (!reply || typeof reply !== 'object') return
      const commentId = String(reply.commentId ?? `${depth}-${index}`)
      if (ancestorIds.has(commentId)) return

      const displayKey = `${path}-${commentId}-${index}`
      flattened.push({
        ...reply,
        displayDepth: Math.min(depth, 3),
        displayKey
      })

      const nextAncestorIds = new Set(ancestorIds)
      nextAncestorIds.add(commentId)
      visit(reply.replies, depth + 1, displayKey, nextAncestorIds)
    })
  }

  visit(replies, 0, 'reply', new Set())
  return flattened
}

const getCommentIdentity = (item) =>
  item.commentId != null
    ? `id:${item.commentId}`
    : `text:${item.user?.nickname || ''}|${item.time || 0}|${item.content || ''}`

const uniqueComments = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = getCommentIdentity(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const isPopularByLikes = (item) => Number(item.likedCount || 0) >= 10

const normalizeNeteaseLocation = (item) => {
  const source = item?.ipLocation
  const fallback = String(item?.user?.location || '').trim()
  if (typeof source === 'string') return source.trim()
  if (!source || typeof source !== 'object') return fallback
  return String(source.location || source.province || source.city || source.country || '').trim() || fallback
}

const normalizeNeteaseComment = (item) => {
  if (!item || typeof item !== 'object') return item
  const user = item.user && typeof item.user === 'object' ? item.user : {}
  return {
    ...item,
    user: {
      ...user,
      location: normalizeNeteaseLocation(item)
    },
    beReplied: Array.isArray(item.beReplied)
      ? item.beReplied.map(normalizeNeteaseComment)
      : item.beReplied,
    replies: Array.isArray(item.replies) ? item.replies.map(normalizeNeteaseComment) : item.replies
  }
}

const mergeHotComments = (...groups) =>
  uniqueComments(groups.flat()).sort(
    (left, right) => Number(right.likedCount || 0) - Number(left.likedCount || 0)
  )

const commentItems = computed(() => {
  const source = commentSort.value === 'hot' ? hotComments.value : comments.value
  return uniqueComments(source).map((item, index) => ({
    ...item,
    displayReplies: flattenCommentReplies(item.replies),
    key: getCommentKey(item, index)
  }))
})

const isRepliesExpanded = (commentKey) => expandedReplyKeys.value.has(commentKey)

const getVisibleReplies = (item) => {
  if (isTencent.value || isRepliesExpanded(item.key)) return item.displayReplies
  return item.displayReplies.slice(0, 1)
}

const toggleReplies = (commentKey) => {
  const next = new Set(expandedReplyKeys.value)
  if (next.has(commentKey)) next.delete(commentKey)
  else next.add(commentKey)
  expandedReplyKeys.value = next
}

function getCommentKey(item, index) {
  const prefix = commentSort.value === 'hot' ? 'hot' : 'comment'
  if (item.commentId !== undefined && item.commentId !== null) {
    return `${prefix}-${item.commentId}`
  }

  const fallback = [item.user?.nickname, item.time, item.content]
    .filter(Boolean)
    .join('-')
    .slice(0, 96)

  return `${prefix}-${fallback || `fallback-${index}`}`
}

const formatCount = (count) => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1)}${locale.value.tenThousand}`
  }
  return String(count)
}

const formatCommentTime = (time) => {
  if (!time) return ''

  const date = new Date(time)
  const now = getSyncedDate()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return locale.value.justNow
  if (diffMinutes < 60) return formatLocaleValue(locale.value.minutesAgo, diffMinutes)
  if (diffMinutes < 1440)
    return formatLocaleValue(locale.value.hoursAgo, Math.floor(diffMinutes / 60))

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

const updateCommentLikeState = (commentId, liked, likedCount) => {
  const applyState = (item) => {
    if (String(item.commentId) !== String(commentId)) return item
    return {
      ...item,
      liked,
      likedCount
    }
  }

  comments.value = comments.value.map(applyState)
  hotComments.value = mergeHotComments(
    hotComments.value.map(applyState),
    comments.value.filter(isPopularByLikes)
  )
  sortTotals.value = { ...sortTotals.value, hot: hotComments.value.length }
}

const attachPendingQqReplies = () => {
  if (!pendingQqReplies.value.length) return

  const pendingByRoot = new Map()
  pendingQqReplies.value.forEach((reply) => {
    const rootId = String(reply.rootCommentId || '')
    if (!rootId || !reply.commentId) return
    const replies = pendingByRoot.get(rootId) || []
    replies.push(reply)
    pendingByRoot.set(rootId, replies)
  })

  const resolvedRootIds = new Set()
  const attachToList = (items) =>
    items.map((item) => {
      const additions = pendingByRoot.get(String(item.commentId))
      if (!additions?.length) return item

      resolvedRootIds.add(String(item.commentId))

      const existingIds = new Set(flattenCommentReplies(item.replies).map((reply) => String(reply.commentId)))
      const nextReplies = additions.filter((reply) => {
        const replyId = String(reply.commentId)
        if (existingIds.has(replyId)) return false
        existingIds.add(replyId)
        return true
      })
      if (!nextReplies.length) return item

      return {
        ...item,
        replies: [...(Array.isArray(item.replies) ? item.replies : []), ...nextReplies],
        replyCount: Math.max(Number(item.replyCount || 0), (item.replies?.length || 0) + nextReplies.length)
      }
    })

  comments.value = attachToList(comments.value)
  hotComments.value = attachToList(hotComments.value)

  if (resolvedRootIds.size) {
    pendingQqReplies.value = pendingQqReplies.value.filter(
      (reply) => !resolvedRootIds.has(String(reply.rootCommentId))
    )
  }
}

const getCommentImageUrl = (url) => {
  const value = String(url || '').trim()
  if (!value) return ''
  const absolute = value.startsWith('//') ? `https:${value}` : convertToHttps(value)
  return absolute
}

const getCommentProxyImageUrl = (url) => {
  const value = String(url || '').trim()
  if (!value) return ''
  const absolute = value.startsWith('//') ? `https:${value}` : convertToHttps(value)
  return `/api/proxy/image?url=${encodeURIComponent(absolute)}`
}

const handleCommentImageError = (event, originalUrl) => {
  const image = event.target
  if (!image || image.dataset.fallback === '1') return
  image.dataset.fallback = '1'
  image.src = getCommentProxyImageUrl(originalUrl)
}

const handlePreviewKeydown = (event) => {
  if (event.key === 'Escape') closeCommentImagePreview()
}

const openCommentImagePreview = (event, originalUrl) => {
  const image = event.currentTarget
  previewImageUrl.value = image?.currentSrc || image?.src || getCommentImageUrl(originalUrl)
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handlePreviewKeydown)
    window.addEventListener('keydown', handlePreviewKeydown)
  }
}

const closeCommentImagePreview = () => {
  previewImageUrl.value = ''
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handlePreviewKeydown)
  }
}

const toggleCommentLike = async (comment) => {
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
      throw new Error(locale.value.likeFailed)
    }
  } catch (err) {
    updateCommentLikeState(commentId, !!comment.liked, currentLikedCount)
    if (window.$showNotification) {
      window.$showNotification(localizeServerError(err, locale.value.likeFailed), 'error')
    }
  } finally {
    likeUpdatingKey.value = ''
  }
}

const fetchTencentComments = async (append, sort, currentRequestId) => {
  if (!tencentSongId.value || sortLoading.value[sort]) return

  const nextOffset = append ? sortOffsets.value[sort] : 0
  sortLoading.value = { ...sortLoading.value, [sort]: true }
  sortErrors.value = { ...sortErrors.value, [sort]: '' }
  loadingCount.value += 1

  try {
    const cursor = append ? sortCursors.value[sort] : ''
    const response = await $fetch('/api/native-api/comment/tx', {
      params: {
        musicId: tencentSongId.value,
        songId: tencentOriginalSongId.value || undefined,
        page: Math.floor(nextOffset / PAGE_SIZE),
        pageSize: PAGE_SIZE,
        type: sort,
        cursor
      }
    })
    if (currentRequestId !== requestId.value) return
    if (response.code !== 200) throw new Error(locale.value.loadFailed)

    const body = response.data || {}
    const nextComments = Array.isArray(body.comments) ? body.comments : []
    const orphanReplies = Array.isArray(body.orphanReplies) ? body.orphanReplies : []
    if (orphanReplies.length) {
      const existingPending = new Set(
        pendingQqReplies.value.map((reply) => `${reply.rootCommentId}:${reply.commentId}`)
      )
      pendingQqReplies.value = [
        ...pendingQqReplies.value,
        ...orphanReplies.filter((reply) => {
          const key = `${reply.rootCommentId}:${reply.commentId}`
          if (!reply.rootCommentId || !reply.commentId || existingPending.has(key)) return false
          existingPending.add(key)
          return true
        })
      ]
    }
    const nextCursor = String(body.nextCursor || '')
    if (sort === 'hot') {
      const promoted = hotComments.value.filter(isPopularByLikes)
      const previous = append ? hotComments.value : promoted
      hotComments.value = mergeHotComments(previous, nextComments)
    } else {
      const previous = append ? comments.value : []
      comments.value = uniqueComments([...previous, ...nextComments])
      hotComments.value = mergeHotComments(
        hotComments.value,
        nextComments.filter(isPopularByLikes)
      )
    }
    sortTotals.value = {
      ...sortTotals.value,
      [sort]: sort === 'hot' ? hotComments.value.length : Number(body.total) || nextComments.length,
      hot: hotComments.value.length
    }
    sortHasMore.value = {
      ...sortHasMore.value,
      [sort]: Boolean(body.more) && Boolean(nextCursor)
    }
    attachPendingQqReplies()
    sortOffsets.value = { ...sortOffsets.value, [sort]: nextOffset + PAGE_SIZE }
    sortCursors.value = { ...sortCursors.value, [sort]: nextCursor }
    sortLoaded.value = { ...sortLoaded.value, [sort]: true }
  } catch (err) {
    if (currentRequestId !== requestId.value) return
    sortErrors.value = {
      ...sortErrors.value,
      [sort]: localizeServerError(err, locale.value.loadFailed)
    }
  } finally {
    if (currentRequestId === requestId.value) {
      sortLoading.value = { ...sortLoading.value, [sort]: false }
      loadingCount.value = Math.max(0, loadingCount.value - 1)
    }
  }
}

const fetchNeteaseComments = async (append, currentRequestId) => {
  if (!neteaseSongId.value || sortLoading.value.latest) return

  const nextOffset = append ? sortOffsets.value.latest : 0
  const lastCommentTime = append ? comments.value[comments.value.length - 1]?.time : undefined
  const params = { id: neteaseSongId.value, limit: PAGE_SIZE }
  if (append && nextOffset >= 5000 && lastCommentTime) params.before = lastCommentTime
  else params.offset = nextOffset

  sortLoading.value = { hot: !append, latest: true }
  sortErrors.value = { hot: '', latest: '' }
  loadingCount.value += 1

  try {
    const response = await fetchNetease('/comment/music', params)
    if (currentRequestId !== requestId.value) return
    if (response.code !== 200) throw new Error(locale.value.loadFailed)

    const body = response.body || response.data || {}
    const nextComments = Array.isArray(body.comments)
      ? body.comments.map(normalizeNeteaseComment)
      : []
    comments.value = uniqueComments(append ? [...comments.value, ...nextComments] : nextComments)
    if (!append) {
      hotComments.value = Array.isArray(body.hotComments)
        ? body.hotComments.map(normalizeNeteaseComment)
        : []
    }
    hotComments.value = mergeHotComments(
      hotComments.value,
      nextComments.filter(isPopularByLikes)
    )

    const latestTotal = Number(body.total) || comments.value.length
    sortTotals.value = {
      hot: hotComments.value.length,
      latest: latestTotal
    }
    sortHasMore.value = {
      hot: typeof body.more === 'boolean' ? body.more : comments.value.length < latestTotal,
      latest: typeof body.more === 'boolean' ? body.more : comments.value.length < latestTotal
    }
    sortOffsets.value = { ...sortOffsets.value, latest: nextOffset + PAGE_SIZE }
    sortLoaded.value = { hot: true, latest: true }
  } catch (err) {
    if (currentRequestId !== requestId.value) return
    const message = localizeServerError(err, locale.value.loadFailed)
    sortErrors.value = append
      ? { ...sortErrors.value, latest: message }
      : { hot: message, latest: message }
  } finally {
    if (currentRequestId === requestId.value) {
      sortLoading.value = { hot: false, latest: false }
      loadingCount.value = Math.max(0, loadingCount.value - 1)
    }
  }
}

const fetchComments = async (append = false, sort = commentSort.value) => {
  if (!canFetchComments.value) return
  const currentRequestId = requestId.value
  if (isTencent.value) {
    await fetchTencentComments(append, sort, currentRequestId)
  } else {
    await fetchNeteaseComments(append, currentRequestId)
  }
}

const loadInitialComments = async () => {
  const currentRequestId = requestId.value
  if (isTencent.value) {
    await Promise.all([
      fetchTencentComments(false, 'hot', currentRequestId),
      fetchTencentComments(false, 'latest', currentRequestId)
    ])
  } else {
    await fetchNeteaseComments(false, currentRequestId)
  }
}

const resetComments = (resetSort = false) => {
  requestId.value += 1
  loadingCount.value = 0
  comments.value = []
  hotComments.value = []
  pendingQqReplies.value = []
  sortTotals.value = { hot: 0, latest: 0 }
  sortHasMore.value = { hot: false, latest: false }
  sortOffsets.value = { hot: 0, latest: 0 }
  sortCursors.value = { hot: '', latest: '' }
  sortLoaded.value = { hot: false, latest: false }
  sortErrors.value = { hot: '', latest: '' }
  sortLoading.value = { hot: false, latest: false }
  expandedReplyKeys.value = new Set()
  if (resetSort) commentSort.value = 'hot'
}

const refreshComments = () => {
  resetComments()
  if (canFetchComments.value) loadInitialComments()
}

const loadMoreComments = () => {
  if (isTencent.value && commentSort.value === 'hot') {
    if (sortHasMore.value.hot) fetchTencentComments(true, 'hot', requestId.value)
    else if (sortHasMore.value.latest) fetchTencentComments(true, 'latest', requestId.value)
    return
  }
  fetchComments(true, commentSort.value)
}

watch(
  () => [commentSourceKey.value, props.visible],
  ([sourceKey, visible], oldValue) => {
    const oldSourceKey = oldValue?.[0]

    if (sourceKey !== oldSourceKey) resetComments(true)
    if (!visible) closeCommentImagePreview()
    if (sourceKey && visible && !sortLoaded.value.hot && loadingCount.value === 0) {
      loadInitialComments()
    }
  },
  { immediate: true }
)

onBeforeUnmount(closeCommentImagePreview)

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

.comment-user {
  display: flex;
  align-items: baseline;
  min-width: 0;
  gap: 0.4rem;
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

.comment-image-previewable {
  cursor: zoom-in;
}

.comment-image-previewable:focus-visible {
  outline: 2px solid var(--lyrics-modal-text);
  outline-offset: 2px;
}

.comment-image-preview {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 88%);
  backdrop-filter: blur(6px);
}

.comment-image-preview > img {
  display: block;
  max-width: calc(100vw - 2rem);
  max-height: calc(100dvh - 2rem);
  border-radius: 6px;
  object-fit: contain;
  box-shadow: 0 20px 60px rgb(0 0 0 / 45%);
}

.comment-image-preview-close {
  position: fixed;
  top: max(1rem, env(safe-area-inset-top));
  right: max(1rem, env(safe-area-inset-right));
  z-index: 1;
  width: 44px;
  height: 44px;
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 50%;
  display: grid;
  place-items: center;
  padding: 0;
  color: #fff;
  background: rgb(20 20 20 / 76%);
  cursor: pointer;
}

.comment-image-preview-close:hover,
.comment-image-preview-close:focus-visible {
  background: rgb(45 45 45 / 92%);
}

.comment-location,
.reply-meta {
  flex-shrink: 0;
  color: var(--lyrics-modal-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.reply-meta {
  margin-bottom: 0.25rem;
}

.reply-user {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.reply-avatar {
  width: 1.25rem;
  height: 1.25rem;
  flex: 0 0 1.25rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: var(--lyrics-modal-text-muted);
  background: var(--lyrics-modal-surface-strong);
}

.reply-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reply-preview {
  margin-left: calc(var(--reply-depth, 0) * 0.75rem);
  margin-top: 0.7rem;
  padding: 0.65rem 0.8rem;
  border-radius: 8px;
  color: var(--lyrics-modal-text-muted);
  background: var(--surface-card-bg-soft);
  font-size: 0.82rem;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}

.replies-toggle {
  margin-top: 0.55rem;
  margin-left: calc(var(--reply-depth, 0) * 0.75rem);
  border: 0;
  padding: 0;
  color: var(--lyrics-modal-text-secondary);
  background: transparent;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 700;
}

.replies-toggle:hover {
  color: var(--lyrics-modal-text);
}

.reply-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 0.35rem;
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
  transition:
    color 0.2s ease,
    transform 0.2s ease;
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

.qq-liked-count {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: inherit;
  cursor: default;
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
