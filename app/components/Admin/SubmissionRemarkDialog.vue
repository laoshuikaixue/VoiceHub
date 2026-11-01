<template>
  <AppModal
    :description="songTitle"
    :show="show"
    :title="locale.title"
    size="lg"
    @close="close"
  >
    <div class="space-y-4">

          <div class="flex items-center gap-3">
            <span
              v-if="noteStatus === 'pending'"
              class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border bg-warning-10 text-warning border-warning-20"
            >
              {{ locale.statusPending }}
            </span>
            <span
              v-else-if="noteStatus === 'rejected'"
              class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border bg-error-10 text-error border-error-20"
            >
              {{ locale.statusRejected }}
            </span>
            <label
              v-else
              for="is-public-checkbox"
              class="flex items-center gap-2 cursor-pointer group"
              :class="{ 'opacity-50': isUpdatingPublic }"
            >
              <input
                id="is-public-checkbox"
                type="checkbox"
                :checked="isPublic"
                :disabled="isUpdatingPublic"
                @change="$emit('update:isPublic', $event.target.checked)"
                class="w-4 h-4 rounded border-border-secondary bg-bg-primary cursor-pointer disabled:cursor-not-allowed"
              />
              <span
                :class="[
                  'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border transition-colors',
                  isPublic
                    ? 'bg-primary-10 text-primary border-primary-20 group-hover:bg-primary-20'
                    : 'bg-warning-10 text-warning border-warning-20 group-hover:bg-warning-20'
                ]"
              >
                {{ isPublic ? locale.publicRemark : locale.adminOnly }}
              </span>
              <span v-if="isUpdatingPublic" class="text-xs text-text-tertiary animate-pulse">{{ locale.updating }}</span>
            </label>
          </div>
          <div class="bg-bg-primary-50 border border-border-secondary-50 rounded-xl p-4">
            <p class="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {{ content }}
            </p>
          </div>

          <!-- 审核操作：待审可通过/拒绝；已拒绝可重新通过 -->
          <div v-if="noteStatus === 'pending' || noteStatus === 'rejected'" class="flex justify-end gap-2 pt-2">
            <button
              v-if="noteStatus === 'pending'"
              type="button"
              :disabled="isUpdatingPublic"
              class="px-4 py-2 rounded-lg bg-error-10 text-error border border-error-20 hover:bg-error-20 transition-colors text-xs font-bold uppercase tracking-wider disabled:opacity-40"
              @click="$emit('reject')"
            >
              {{ locale.rejectButton }}
            </button>
            <button
              type="button"
              :disabled="isUpdatingPublic"
              class="px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90 transition-opacity text-xs font-bold uppercase tracking-wider disabled:opacity-40"
              @click="$emit('approve')"
            >
              {{ locale.approveButton }}
            </button>
          </div>
    </div>
  </AppModal>
</template>

<script setup>
import { computed } from 'vue'
import AppModal from '~/components/UI/Common/AppModal.vue'
import { useLocale } from '~/utils/locale'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  songTitle: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isUpdatingPublic: {
    type: Boolean,
    default: false
  },
  noteStatus: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'update:isPublic', 'approve', 'reject'])
const { admin } = useLocale()
const locale = computed(() => admin.value?.scheduleManager?.remarkDialog || {})

const close = () => {
  emit('close')
}
</script>
