<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="notification"
        class="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-panel-bg-darkest-80 p-4 backdrop-blur-sm"
        @keydown="handleKeydown"
      >
        <section
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="contentId"
          tabindex="-1"
          class="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-panel-bg-dark bg-panel-bg-deepest shadow-2xl"
        >
          <header class="relative border-b border-panel-bg-dark-50 px-5 py-5 sm:px-8 sm:py-6">
            <div
              class="absolute right-5 top-5 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold sm:right-8 sm:top-6"
              :class="
                notification.read
                  ? 'border-success-30 bg-success-10 text-success-light'
                  : 'border-warning-20 bg-warning-20 text-warning-light'
              "
            >
              <span
                class="h-2 w-2 rounded-full"
                :class="notification.read ? 'bg-success-light' : 'bg-warning-light'"
              />
              {{ notification.read ? locale.read : locale.unread }}
            </div>

            <div class="flex items-start gap-4 pr-20 sm:pr-24">
              <div
                class="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-warning-20 bg-warning-20 text-warning-light"
                aria-hidden="true"
              >
                <Icon name="bell-ring" :size="22" />
              </div>
              <div class="min-w-0 flex-1">
                <span class="text-xs font-bold text-warning-light">{{ locale.label }}</span>
                <h2
                  :id="titleId"
                  class="mt-1 break-words text-xl font-black text-text-primary-lighter sm:text-2xl"
                >
                  {{ notification.title || locale.label }}
                </h2>
                <time
                  v-if="formattedCreatedAt"
                  :datetime="notification.createdAt"
                  class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-tertiary"
                >
                  <span class="inline-flex items-center gap-1 font-semibold text-text-muted">
                    <Icon name="clock" :size="13" class="shrink-0" aria-hidden="true" />
                    {{ relativeCreatedAt }}
                  </span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{{ formattedCreatedAt }}</span>
                </time>
                <p class="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                  <Icon name="user" :size="13" class="shrink-0" aria-hidden="true" />
                  <span>{{ locale.sender }}：{{ senderDisplayName }}</span>
                </p>
              </div>
            </div>
          </header>

          <div
            :id="contentId"
            class="important-notification-content markdown-body min-h-0 flex-1 overflow-y-auto px-5 py-6 text-sm text-text-secondary sm:p-8 sm:text-base"
            v-html="renderedMessage"
          />

          <footer
            class="flex flex-col items-end gap-3 border-t border-panel-bg-dark-50 bg-panel-bg-deepest-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8 sm:py-6"
          >
            <p
              v-if="error"
              class="w-full min-w-0 flex-1 break-words text-xs font-medium text-error"
              role="alert"
            >
              {{ error }}
            </p>

            <button
              ref="closeButtonRef"
              type="button"
              :disabled="closing"
              class="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-xs font-black text-white transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-panel-bg-deepest disabled:cursor-wait disabled:opacity-60"
              @click="markAsReadAndClose"
            >
              <Icon v-if="closing" name="loader" :size="17" class="animate-spin" />
              <Icon v-else name="check" :size="17" />
              {{ closing ? locale.closing : locale.close }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import { useImportantNotification } from '~/composables/useImportantNotification'
import { useLocale } from '~/utils/locale'
import { renderMarkdown } from '~/utils/markdown'

const { notification, closing, error, markAsReadAndClose } = useImportantNotification()
const { importantNotification, currentLocale } = useLocale()
const locale = computed(() => importantNotification.value)
const dialogRef = ref(null)
const closeButtonRef = ref(null)
const nowTimestamp = ref(Date.now())
const titleId = 'important-notification-title'
const contentId = 'important-notification-content'
let previousFocusedElement = null
let previousBodyOverflow = ''
let relativeTimeTimer = null

const renderedMessage = computed(() => renderMarkdown(notification.value?.message || ''))
const senderDisplayName = computed(
  () =>
    notification.value?.sender?.name?.trim() ||
    notification.value?.sender?.username?.trim() ||
    locale.value.systemSender
)
const formattedCreatedAt = computed(() => {
  if (!notification.value?.createdAt) return ''

  const date = new Date(notification.value.createdAt)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(currentLocale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
})

const relativeCreatedAt = computed(() => {
  if (!notification.value?.createdAt) return ''

  const date = new Date(notification.value.createdAt)
  if (Number.isNaN(date.getTime())) return ''

  const elapsedSeconds = Math.max(0, Math.floor((nowTimestamp.value - date.getTime()) / 1000))
  if (elapsedSeconds < 60) return locale.value.justNow

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return locale.value.minutesAgo(elapsedMinutes)

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return locale.value.hoursAgo(elapsedHours)

  return locale.value.daysAgo(Math.floor(elapsedHours / 24))
})

const stopRelativeTimeClock = () => {
  if (relativeTimeTimer) {
    clearInterval(relativeTimeTimer)
    relativeTimeTimer = null
  }
}

const startRelativeTimeClock = () => {
  if (!import.meta.client) return

  stopRelativeTimeClock()
  nowTimestamp.value = Date.now()
  relativeTimeTimer = window.setInterval(() => {
    nowTimestamp.value = Date.now()
  }, 30_000)
}

const restorePageState = () => {
  if (!import.meta.client) return

  document.body.style.overflow = previousBodyOverflow
  if (previousFocusedElement instanceof HTMLElement) {
    previousFocusedElement.focus()
  }
  previousFocusedElement = null
}

watch(
  () => notification.value?.id,
  async (notificationId, previousId) => {
    if (notificationId) {
      startRelativeTimeClock()
      if (!previousId) {
        previousFocusedElement = document.activeElement
        previousBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      await nextTick()
      closeButtonRef.value?.focus()
    } else if (previousId) {
      stopRelativeTimeClock()
      restorePageState()
    }
  },
  { immediate: true, flush: 'post' }
)

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    markAsReadAndClose()
    return
  }

  if (event.key !== 'Tab' || !dialogRef.value) return

  const focusableElements = dialogRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
  if (!focusableElements.length) {
    event.preventDefault()
    dialogRef.value.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

onBeforeUnmount(() => {
  stopRelativeTimeClock()
  restorePageState()
})
</script>

<style scoped>
.important-notification-content :deep(:first-child) {
  margin-top: 0;
}

.important-notification-content :deep(:last-child) {
  margin-bottom: 0;
}
</style>
