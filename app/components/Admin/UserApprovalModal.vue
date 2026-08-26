<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" @click.self="closeModal">
        <div class="w-full max-w-md max-h-[90vh] overflow-y-auto bg-bg-primary rounded-2xl border border-border-secondary shadow-2xl">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-border-secondary">
            <h3 class="text-lg font-black text-text-primary flex items-center gap-2">
              <ClipboardCheck :size="18" />
              {{ locale.approval.title }}
            </h3>
            <button type="button" class="p-1.5 text-text-tertiary hover:text-text-primary transition-colors" @click="closeModal">
              <X :size="18" />
            </button>
          </div>

          <div class="px-6 py-5 space-y-4">
            <!-- 注册基本信息 -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-bg-secondary-40 rounded-xl px-4 py-3">
                <p class="text-[11px] font-black uppercase tracking-widest text-text-tertiary">{{ locale.approval.username }}</p>
                <p class="text-sm font-bold text-text-primary mt-1 break-all">@{{ user?.username || '-' }}</p>
              </div>
              <div class="bg-bg-secondary-40 rounded-xl px-4 py-3">
                <p class="text-[11px] font-black uppercase tracking-widest text-text-tertiary">{{ locale.approval.registeredAt }}</p>
                <p class="text-sm font-bold text-text-primary mt-1">{{ formatDate(user?.createdAt) }}</p>
              </div>
            </div>

            <!-- 注册备注（只读展示） -->
            <div class="bg-bg-secondary-40 rounded-xl px-4 py-3">
              <p class="text-[11px] font-black uppercase tracking-widest text-text-tertiary">{{ locale.approval.remark }}</p>
              <p class="text-sm font-bold text-text-primary mt-1 whitespace-pre-wrap break-all">{{ user?.remark || locale.approval.emptyRemark }}</p>
            </div>

            <!-- 可编辑字段 -->
            <div class="space-y-3">
              <p class="text-xs text-text-secondary">{{ locale.approval.editHint }}</p>

              <div class="form-group">
                <label class="block text-xs font-bold text-text-secondary mb-1.5" for="approval-name">{{ locale.approval.name }}</label>
                <input
                  id="approval-name"
                  v-model="form.name"
                  class="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border-secondary text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                  type="text"
                >
              </div>

              <div class="grid grid-cols-2 gap-3">
                <CustomSelect v-model="form.grade" :options="gradeSelectOptions" :label="locale.approval.grade" @change="handleGradeChange" />
                <CustomSelect
                  v-model="form.class"
                  :options="classSelectOptions"
                  :label="locale.approval.class"
                  :disabled="!form.grade"
                />
              </div>

              <div class="form-group">
                <label class="block text-xs font-bold text-text-secondary mb-1.5" for="approval-remark">{{ locale.approval.remark }}</label>
                <input
                  id="approval-remark"
                  v-model="form.remark"
                  class="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border-secondary text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                  type="text"
                  maxlength="200"
                >
              </div>
            </div>

            <!-- 拒绝理由（可选） -->
            <div class="form-group">
              <label class="block text-xs font-bold text-text-secondary mb-1.5" for="approval-reason">{{ locale.approval.rejectReason }}</label>
              <input
                id="approval-reason"
                v-model="rejectReason"
                class="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border-secondary text-text-primary text-sm focus:outline-none focus:border-primary transition-colors"
                type="text"
                :placeholder="locale.approval.rejectReasonPlaceholder"
                maxlength="200"
              >
            </div>

            <div v-if="error" class="text-xs text-error font-bold">{{ error }}</div>
          </div>

          <!-- 底部操作 -->
          <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-secondary">
            <button
              type="button"
              :disabled="loading"
              class="px-4 py-2 rounded-xl bg-bg-secondary border border-border-secondary text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-40"
              @click="closeModal"
            >
              {{ locale.actions.cancel }}
            </button>
            <button
              type="button"
              :disabled="loading"
              class="px-4 py-2 rounded-xl bg-error-10 text-error border border-error-20 hover:bg-error-20 transition-colors disabled:opacity-40"
              @click="handleReject"
            >
              {{ locale.approval.reject }}
            </button>
            <button
              type="button"
              :disabled="loading"
              class="px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
              @click="handleApprove"
            >
              <RefreshCw v-if="loading" :size="14" class="animate-spin" />
              {{ locale.approval.approve }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <ConfirmDialog
      :show="showRejectConfirm"
      :title="locale.approval.title"
      :message="locale.approval.confirmReject"
      type="danger"
      :confirm-text="locale.approval.reject"
      :loading="loading"
      @confirm="confirmReject"
      @close="showRejectConfirm = false"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ClipboardCheck, RefreshCw, X } from '@lucide/vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'

const props = defineProps({
  show: { type: Boolean, default: false },
  user: { type: Object, default: null }
})
const emit = defineEmits(['close', 'success'])

const { admin } = useLocale()
const locale = computed(() => admin.value?.userManager || {})
const { localize: localizeServerError } = useServerErrors()

const form = ref({ name: '', grade: '', class: '', remark: '' })
const rejectReason = ref('')
const error = ref('')
const loading = ref(false)
const showRejectConfirm = ref(false)

const classOptions = ref([])
const classOptionsLoaded = ref(false)

const gradeSelectOptions = computed(() => [
  { label: locale.value?.approval?.gradeNotSet || '不设置', value: '' },
  ...[...new Set(classOptions.value.map((item) => item.grade))].map((option) => ({ label: option, value: option }))
])

const classSelectOptions = computed(() =>
  classOptions.value
    .filter((item) => item.grade === form.value.grade)
    .map((item) => ({ label: item.class, value: item.class }))
)

const formatDate = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

const handleGradeChange = () => {
  form.value.class = ''
}

const fetchClassOptions = async () => {
  if (classOptionsLoaded.value) return
  try {
    const response = await $fetch('/api/auth/grade-class-options')
    if (response.success) {
      classOptions.value = response.classes || []
      classOptionsLoaded.value = true
    }
  } catch (e) {
    console.error('获取年级班级选项失败:', e)
  }
}

const resetForm = () => {
  form.value = {
    name: props.user?.name || '',
    grade: props.user?.grade || '',
    class: props.user?.class || '',
    remark: props.user?.remark || ''
  }
  rejectReason.value = ''
  error.value = ''
  showRejectConfirm.value = false
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      resetForm()
      void fetchClassOptions()
    }
  }
)

const closeModal = () => {
  if (loading.value) return
  emit('close')
}

const handleApprove = async () => {
  if (!props.user) return
  error.value = ''
  loading.value = true

  try {
    const response = await $fetch(`/api/admin/users/${props.user.id}/approval`, {
      method: 'POST',
      body: {
        action: 'approve',
        name: form.value.name.trim(),
        grade: form.value.grade,
        class: form.value.class,
        remark: form.value.remark.trim()
      }
    })

    if (response.success) {
      emit('success', { action: 'approve', user: props.user })
      emit('close')
    }
  } catch (err) {
    error.value = localizeServerError(err, locale.value.approval?.approveFailed)
  } finally {
    loading.value = false
  }
}

const handleReject = () => {
  if (!props.user) return
  error.value = ''
  showRejectConfirm.value = true
}

const confirmReject = async () => {
  if (!props.user) return
  loading.value = true

  try {
    const response = await $fetch(`/api/admin/users/${props.user.id}/approval`, {
      method: 'POST',
      body: {
        action: 'reject',
        reason: rejectReason.value.trim()
      }
    })

    if (response.success) {
      showRejectConfirm.value = false
      emit('success', { action: 'reject', user: props.user })
      emit('close')
    }
  } catch (err) {
    error.value = localizeServerError(err, locale.value.approval?.rejectFailed)
    showRejectConfirm.value = false
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
