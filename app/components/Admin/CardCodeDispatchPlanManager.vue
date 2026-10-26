<template>
  <section class="rounded-2xl border border-border-secondary bg-bg-secondary-40 p-5 space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 class="text-sm font-black text-text-primary uppercase tracking-[0.24em]">{{ locale.dispatchPlans.title }}</h3>
        <p class="mt-1 text-[11px] text-text-tertiary">{{ locale.dispatchPlans.desc }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary hover:border-border-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
          :disabled="loading"
          @click="scanDue"
        >
          {{ locale.dispatchPlans.scanDue }}
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-xl bg-primary-hover px-3.5 py-2 text-xs font-black text-text-primary hover:bg-primary transition-colors"
          @click="openCreate"
        >
          <Plus :size="14" /> {{ locale.dispatchPlans.create }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="rounded-xl border border-border-secondary bg-bg-primary-60 p-6 text-center text-sm text-text-tertiary">
      {{ locale.loading }}
    </p>

    <div v-else-if="!plans.length" class="rounded-xl border border-border-secondary bg-bg-primary p-6 text-center text-sm text-text-tertiary">
      {{ locale.dispatchPlans.empty }}
    </div>

    <div v-else class="overflow-x-auto rounded-2xl border border-border-secondary">
      <table class="min-w-[820px] table-fixed text-left text-sm">
        <thead class="bg-bg-primary-80 text-text-tertiary">
          <tr>
            <th class="px-3 py-3 w-40">{{ locale.dispatchPlans.name }}</th>
            <th class="px-3 py-3 w-48">{{ locale.dispatchPlans.scheduleType }}</th>
            <th class="px-3 py-3 w-24">{{ locale.dispatchPlans.recipients }}</th>
            <th class="px-3 py-3 w-40">{{ locale.dispatchPlans.nextRun }}</th>
            <th class="px-3 py-3 w-40">{{ locale.dispatchPlans.lastRun }}</th>
            <th class="px-3 py-3 w-20">{{ locale.dispatchPlans.enabled }}</th>
            <th class="px-3 py-3 w-44">{{ locale.actions }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="plan in plans" :key="plan.id" class="border-t border-border-secondary-80 hover:bg-bg-primary-70 transition-colors">
            <td class="px-3 py-3 align-top">
              <p class="truncate font-bold text-text-primary" :title="plan.name">{{ plan.name }}</p>
              <p v-if="plan.lastMessage" class="mt-1 text-[10px] leading-relaxed text-text-tertiary" :title="plan.lastMessage">
                <span :class="['mr-1 inline-block rounded px-1 font-black', statusMeta(plan.lastStatus).class]">{{ statusMeta(plan.lastStatus).label }}</span>{{ plan.lastMessage }}
              </p>
            </td>
            <td class="px-3 py-3 align-top text-[12px] text-text-secondary">
              {{ describeSchedule(plan) }}
            </td>
            <td class="px-3 py-3 align-top text-text-secondary">
              {{ getMessage('dispatchPlans.recipientsCount', plan.recipientCount) }}
            </td>
            <td class="px-3 py-3 align-top text-[12px] text-text-secondary">
              <span v-if="!plan.enabled" class="text-text-disabled">{{ locale.dispatchPlans.stopped }}</span>
              <span v-else-if="!plan.nextRunAt" class="text-text-disabled">{{ locale.dispatchPlans.noNextRun }}</span>
              <span v-else>{{ formatBJ(plan.nextRunAt) }}</span>
            </td>
            <td class="px-3 py-3 align-top text-[12px] text-text-tertiary">
              {{ plan.lastRunAt ? formatBJ(plan.lastRunAt) : '—' }}
            </td>
            <td class="px-3 py-3 align-top">
              <button
                type="button"
                role="switch"
                :aria-checked="plan.enabled"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="plan.enabled ? 'bg-primary' : 'bg-bg-quaternary'"
                @click="toggleEnabled(plan)"
              >
                <span
                  class="inline-block h-5 w-5 transform rounded-full bg-bg-primary shadow transition-transform"
                  :class="plan.enabled ? 'translate-x-5' : 'translate-x-0.5'"
                />
              </button>
            </td>
            <td class="px-3 py-3 align-top">
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-text-secondary hover:text-text-primary"
                  :disabled="runningId === plan.id"
                  @click="runNow(plan)"
                >
                  {{ runningId === plan.id ? locale.loading : locale.dispatchPlans.runNow }}
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-text-secondary hover:text-text-primary"
                  @click="openEdit(plan)"
                >
                  {{ locale.dispatchPlans.edit }}
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-[11px] font-bold text-error hover:bg-error-10"
                  @click="removePlan(plan)"
                >
                  {{ locale.dispatchPlans.delete }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新建 / 编辑计划弹窗 -->
    <Teleport to="body">
      <div v-if="formOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-[var(--modal-overlay)] backdrop-blur-sm" @click="closeForm" />

        <div class="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-panel-bg-dark bg-panel-bg-deepest shadow-2xl">
          <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-panel-bg-dark bg-panel-bg-deepest-95 px-5 py-4 backdrop-blur-sm">
            <h3 class="text-base font-black text-text-primary-lighter">
              {{ editingId ? locale.dispatchPlans.update : locale.dispatchPlans.create }}
            </h3>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-xl text-text-tertiary transition-colors hover:bg-panel-bg-dark hover:text-text-primary-light"
              :aria-label="locale.dispatchPlans.cancel"
              @click="closeForm"
            >
              <X :size="18" />
            </button>
          </div>

          <div class="space-y-4 overflow-y-auto px-5 py-5">
            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.name }}</label>
              <input
                v-model="form.name"
                type="text"
                maxlength="60"
                :placeholder="locale.dispatchPlans.namePlaceholder"
                class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
              >
            </div>

            <div>
              <p class="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.recipients }}</p>
              <CardCodeRecipientPicker v-model="form.recipients" />
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.countPerUser }}</label>
                <input
                  v-model.number="form.countPerUser"
                  type="number"
                  min="1"
                  max="100"
                  class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-40"
                >
              </div>
              <div>
                <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.prefix }}</label>
                <input
                  v-model="form.prefix"
                  type="text"
                  maxlength="12"
                  :placeholder="locale.dispatchPlans.prefixPlaceholder"
                  class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm uppercase text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
                >
              </div>
            </div>

            <div>
              <p class="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.scheduleType }}</p>
              <div class="flex flex-wrap gap-1 rounded-xl border border-border-secondary bg-bg-primary p-1">
                <button
                  v-for="opt in scheduleOptions"
                  :key="opt.value"
                  type="button"
                  class="flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-bold transition-colors"
                  :class="form.scheduleType === opt.value ? 'bg-primary-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'"
                  @click="form.scheduleType = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.startAt }}</label>
                <input
                  v-model="form.startAtLocal"
                  type="datetime-local"
                  step="60"
                  class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-40"
                >
                <p v-if="startAtIsPast" class="mt-1.5 text-[11px] leading-relaxed text-warning">
                  {{ dp.value?.startAtPastHint || '所选时间已过，该计划不会自动执行；如需马上发券，请保存后在列表点「立即执行」。' }}
                </p>
                <p v-else-if="form.scheduleType === 'once'" class="mt-1.5 text-[11px] leading-relaxed text-text-tertiary">
                  {{ dp.value?.startAtOnceHint || '该时间只执行一次，到点后计划自动结束。' }}
                </p>
              </div>
              <div>
                <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.endAt }}</label>
                <input
                  v-model="form.endAtLocal"
                  type="datetime-local"
                  step="60"
                  class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
                >
              </div>
            </div>

            <div v-if="form.scheduleType === 'weekly'">
              <p class="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.weekdays }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="(label, idx) in weekdayLabels"
                  :key="idx"
                  type="button"
                  class="min-h-[40px] min-w-[40px] rounded-xl border px-2 text-sm font-bold transition-colors"
                  :class="form.weekdays.includes(Number(idx)) ? 'border-primary bg-primary-10 text-primary' : 'border-border-secondary bg-bg-primary text-text-secondary'"
                  @click="toggleWeekday(Number(idx))"
                >
                  {{ label }}
                </button>
              </div>
            </div>

            <div v-if="form.scheduleType === 'monthly'">
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.dispatchPlans.dayOfMonth }}</label>
              <input
                v-model.number="form.dayOfMonth"
                type="number"
                min="1"
                max="31"
                class="w-32 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-40"
              >
            </div>

            <div>
              <label class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">{{ locale.note }}</label>
              <input
                v-model="form.note"
                type="text"
                maxlength="200"
                :placeholder="locale.dispatchPlans.note"
                class="w-full rounded-xl border border-border-secondary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-40"
              >
            </div>

            <label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-text-secondary">
              <input v-model="form.notify" type="checkbox" class="h-4 w-4 rounded border-border-tertiary bg-bg-secondary text-primary">
              {{ locale.dispatchPlans.notify }}
            </label>

            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                class="flex items-center gap-2 rounded-xl bg-primary-hover px-4 py-2 text-xs font-black text-text-primary transition-colors hover:bg-primary disabled:opacity-50"
                :disabled="saving"
                @click="submitForm"
              >
                <Send :size="14" /> {{ saving ? locale.loading : (editingId ? locale.dispatchPlans.update : locale.dispatchPlans.submit) }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-border-secondary bg-bg-primary px-4 py-2 text-xs font-bold text-text-secondary"
                @click="closeForm"
              >
                {{ locale.dispatchPlans.cancel }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Plus, Send, X } from '@lucide/vue'
import CardCodeRecipientPicker from '~/components/Admin/CardCodeRecipientPicker.vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import { useLocaleText } from '~/composables/useLocaleText'

const { showToast } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.cardCodesManager || {})
const { msg: getMessage } = useLocaleText(locale)
// dispatchPlans 是 cardCodesManager 下的嵌套对象，单独取一层，避免每层都写长链
const dp = computed(() => locale.value?.dispatchPlans || {})

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const weekdayLabels = WEEKDAY_LABELS

const scheduleOptions = computed(() => [
  { value: 'once', label: dp.value?.scheduleOnce || '指定日期（一次）' },
  { value: 'daily', label: dp.value?.scheduleDaily || '每天' },
  { value: 'weekly', label: dp.value?.scheduleWeekly || '每周' },
  { value: 'monthly', label: dp.value?.scheduleMonthly || '每月' }
])

const plans = ref([])
const loading = ref(false)
const saving = ref(false)
const runningId = ref(null)
const formOpen = ref(false)
const editingId = ref(null)

const emptyForm = () => ({
  name: '',
  recipients: [],
  countPerUser: 1,
  prefix: '',
  scheduleType: 'once',
  startAtLocal: '',
  endAtLocal: '',
  weekdays: [],
  dayOfMonth: 1,
  notify: true,
  note: ''
})
const form = ref(emptyForm())

// 单次计划若选了已过的时间，创建后不会自动执行（后端 nextRunAt 为 null）。
// 这里当场提示，避免管理员保存成功却以为券会发出去。
const startAtIsPast = computed(() => {
  if (form.value.scheduleType !== 'once') return false
  const iso = toISO(form.value.startAtLocal)
  if (!iso) return false
  return new Date(iso).getTime() <= Date.now()
})

// ===== 时间处理：业务统一用北京时间（Asia/Shanghai）=====
// 表单用 datetime-local（无时区），按北京时间理解；提交时补 +08:00 转成 UTC ISO 给后端
const toISO = (local) => {
  if (!local) return null
  const withTz = `${local}:00+08:00`
  const d = new Date(withTz)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const formatBJ = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d)
  } catch {
    return String(iso)
  }
}

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d).replace(', ', 'T')
  } catch {
    return ''
  }
}

const describeSchedule = (plan) => {
  const start = formatBJ(plan.startAt)
  const time = start.slice(-5)
  if (plan.scheduleType === 'once') return `单次：${start}`
  if (plan.scheduleType === 'daily') return `每天 ${time} 起`
  if (plan.scheduleType === 'weekly') {
    const days = (plan.weekdays || []).map((d) => WEEKDAY_LABELS[d] ?? '?').join('、')
    return `每周 ${days || '—'} ${time} 起`
  }
  if (plan.scheduleType === 'monthly') return `每月 ${plan.dayOfMonth} 日 ${time} 起`
  return plan.scheduleType
}

const statusMeta = (status) => {
  const map = {
    SUCCESS: { label: dp.value?.statusSuccess || '成功', class: 'bg-success-10 text-success' },
    PARTIAL: { label: dp.value?.statusPartial || '部分成功', class: 'bg-warning-10 text-warning' },
    FAILED: { label: dp.value?.statusFailed || '失败', class: 'bg-error-10 text-error' },
    RUNNING: { label: dp.value?.statusRunning || '执行中', class: 'bg-info-10 text-info' }
  }
  return map[status] || { label: '—', class: 'bg-bg-quaternary-10 text-text-secondary' }
}

const fetchPlans = async () => {
  loading.value = true
  try {
    const res = await $fetch('/api/admin/card-codes/dispatch-plans')
    plans.value = Array.isArray(res?.data) ? res.data : []
  } catch (error) {
    console.error('加载自动派发计划失败', error)
    showToast(dp.value?.loadFailed || '加载自动派发计划失败', 'error')
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editingId.value = null
  form.value = emptyForm()
  formOpen.value = true
}

const openEdit = (plan) => {
  editingId.value = plan.id
  form.value = {
    name: plan.name || '',
    recipients: (plan.recipientIds || []).map((id) => ({ id })),
    countPerUser: plan.countPerUser || 1,
    prefix: plan.prefix || '',
    scheduleType: plan.scheduleType || 'once',
    startAtLocal: toLocalInput(plan.startAt),
    endAtLocal: toLocalInput(plan.endAt),
    weekdays: [...(plan.weekdays || [])],
    dayOfMonth: plan.dayOfMonth || 1,
    notify: plan.notify !== false,
    note: plan.note || ''
  }
  formOpen.value = true
}

const closeForm = () => {
  formOpen.value = false
  editingId.value = null
}

const toggleWeekday = (idx) => {
  const next = new Set(form.value.weekdays)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  form.value.weekdays = [...next].sort((a, b) => a - b)
}

const submitForm = async () => {
  const f = form.value
  if (!f.name.trim()) {
    showToast(dp.value?.nameRequired || '请填写计划名称', 'warning')
    return
  }
  if (!f.recipients.length) {
    showToast(dp.value?.recipientRequired || '请至少选择一位接收人', 'warning')
    return
  }
  if (!Number.isInteger(f.countPerUser) || f.countPerUser < 1 || f.countPerUser > 100) {
    showToast(dp.value?.countInvalid || '每人派发张数需为 1-100', 'warning')
    return
  }
  if (!f.startAtLocal) {
    showToast(dp.value?.startRequired || '请选择执行时间', 'warning')
    return
  }
  if (f.scheduleType === 'weekly' && !f.weekdays.length) {
    showToast(dp.value?.weekdayRequired || '每周执行至少选择一天', 'warning')
    return
  }
  if (f.scheduleType === 'monthly' && (!Number.isInteger(f.dayOfMonth) || f.dayOfMonth < 1 || f.dayOfMonth > 31)) {
    showToast(dp.value?.dayInvalid || '每月执行日需为 1-31', 'warning')
    return
  }

  const body = {
    name: f.name.trim(),
    countPerUser: Number(f.countPerUser),
    recipientIds: f.recipients.map((item) => Number(item.id)),
    scheduleType: f.scheduleType,
    startAt: toISO(f.startAtLocal),
    endAt: f.endAtLocal ? toISO(f.endAtLocal) : null,
    notify: f.notify,
    prefix: f.prefix.trim().toUpperCase() || null,
    note: f.note.trim() || null
  }
  if (f.scheduleType === 'weekly') body.weekdays = f.weekdays
  if (f.scheduleType === 'monthly') body.dayOfMonth = Number(f.dayOfMonth)

  saving.value = true
  try {
    if (editingId.value) {
      const res = await $fetch(`/api/admin/card-codes/dispatch-plans/${editingId.value}`, { method: 'PUT', body })
      // 与新建同理：后端提示「已无可执行时间」时必须透出，不能只说「计划已更新」
      if (res?.message) {
        showToast(res.message, 'warning')
      } else {
        showToast(dp.value?.updated || '计划已更新', 'success')
      }
    } else {
      const res = await $fetch('/api/admin/card-codes/dispatch-plans', { method: 'POST', body })
      // 后端在「按当前时间规则已无可执行时间」时会带回 message：此时计划不会自动执行，
      // 必须原样告知管理员，不能只提示「计划已保存」让他以为券会发出去。
      if (res?.message) {
        showToast(res.message, 'warning')
      } else {
        showToast(dp.value?.saved || '计划已保存', 'success')
      }
    }
    closeForm()
    await fetchPlans()
  } catch (error) {
    console.error('保存自动派发计划失败', error)
    const msg = error?.data?.message || error?.message || (dp.value?.saveFailed || '保存失败')
    showToast(msg, 'error')
  } finally {
    saving.value = false
  }
}

const toggleEnabled = async (plan) => {
  try {
    const res = await $fetch(`/api/admin/card-codes/dispatch-plans/${plan.id}`, {
      method: 'PUT',
      body: { enabled: !plan.enabled }
    })
    // 重新启用时若按规则已无可执行时间，后端会带回 message —— 提示管理员该计划不会自动跑
    if (res?.message) {
      showToast(res.message, 'warning')
    }
    await fetchPlans()
  } catch (error) {
    console.error('切换计划状态失败', error)
    showToast(error?.data?.message || error?.message || '操作失败', 'error')
  }
}

const runNow = async (plan) => {
  runningId.value = plan.id
  try {
    const res = await $fetch(`/api/admin/card-codes/dispatch-plans/${plan.id}/run`, { method: 'POST' })
    const data = res?.data || {}
    if (data.status === 'FAILED') {
      showToast(dp.value?.runFailed || '执行失败，请查看计划结果', 'error')
    } else if (Number(data.assignedCount || 0) === 0) {
      showToast(dp.value?.runNoCodes || '未派发出任何券', 'warning')
    } else {
      showToast(getMessage('dispatchPlans.runSuccess', Number(data.assignedCount || 0)), 'success')
    }
    await fetchPlans()
  } catch (error) {
    console.error('立即执行失败', error)
    showToast(error?.data?.message || error?.message || '执行失败', 'error')
  } finally {
    runningId.value = null
  }
}

const scanDue = async () => {
  try {
    const res = await $fetch('/api/admin/card-codes/dispatch-plans/run-due', { method: 'POST' })
    const results = Array.isArray(res?.results) ? res.results : []
    const executed = results.length
    showToast(getMessage('dispatchPlans.scanDueDone', executed), 'success')
    await fetchPlans()
  } catch (error) {
    console.error('触发扫描失败', error)
    showToast(error?.data?.message || error?.message || '操作失败', 'error')
  }
}

const removePlan = async (plan) => {
  const confirmed = window.confirm(dp.value?.deleteConfirm?.(plan.name) || `确定删除计划「${plan.name}」吗？`)
  if (!confirmed) return
  try {
    await $fetch(`/api/admin/card-codes/dispatch-plans/${plan.id}`, { method: 'DELETE' })
    showToast(dp.value?.deleted || '计划已删除', 'success')
    await fetchPlans()
  } catch (error) {
    console.error('删除计划失败', error)
    showToast(error?.data?.message || error?.message || '删除失败', 'error')
  }
}

onMounted(fetchPlans)
</script>
