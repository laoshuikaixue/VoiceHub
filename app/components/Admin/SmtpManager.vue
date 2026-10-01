<template>
  <div class="max-w-[1400px] mx-auto space-y-10 pb-20 px-2">
    <!-- 头部区域 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.title }}</h2>
        <p class="text-xs text-text-tertiary mt-1">
          {{ locale.desc }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="flex items-center gap-2 px-6 py-2 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-secondary text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
          :disabled="reloading"
          @click="reloadSmtpConfig"
        >
          <RotateCw :size="14" :class="reloading ? 'animate-spin' : ''" />
          {{ reloading ? locale.reloading : locale.reload }}
        </button>
        <button
          class="flex items-center gap-2 px-6 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-bold rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95"
          :disabled="saving"
          @click="saveConfig"
        >
          <Save :size="14" /> {{ saving ? locale.saving : locale.save }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
      <!-- 左侧栏：SMTP 设置与测试 -->
      <div class="xl:col-span-4 space-y-8">
        <!-- SMTP 核心设置 -->
        <section class="bg-bg-secondary-30 border border-border-secondary rounded-[2rem] p-6 space-y-6">
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2"
            >
              <Server :size="16" class="text-primary" /> {{ locale.serviceConfig }}
            </h3>
            <button
              class="relative w-10 h-5 rounded-full transition-colors"
              :class="config.smtpEnabled ? 'bg-primary-hover' : 'bg-bg-tertiary'"
              @click="config.smtpEnabled = !config.smtpEnabled"
            >
              <div
                class="absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all"
                :class="config.smtpEnabled ? 'left-6' : 'left-1'"
              />
            </button>
          </div>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.smtpHost }}</label
              >
              <input
                v-model="config.smtpHost"
                type="text"
                placeholder="smtp.example.com"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30"
              >
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                  >{{ locale.port }}</label
                >
                <input
                  v-model.number="config.smtpPort"
                  type="number"
                  placeholder="587"
                  class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30"
                >
              </div>
              <div class="space-y-1.5">
                <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                  >{{ locale.secure }}</label
                >
                <CustomSelect
                  :model-value="config.smtpSecure ? secureOptionLabels.ssl : secureOptionLabels.none"
                  :options="[secureOptionLabels.ssl, secureOptionLabels.none]"
                  class="w-full"
                  @update:model-value="(val) => (config.smtpSecure = val === secureOptionLabels.ssl)"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.username }}</label
              >
              <input
                v-model="config.smtpUsername"
                autocomplete="off"
                type="text"
                placeholder="your-email@example.com"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.fromEmail }}</label
              >
              <input
                v-model="config.smtpFromEmail"
                autocomplete="off"
                type="text"
                :placeholder="config.smtpUsername || 'your-email@example.com'"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30"
              >
              <p class="text-[9px] text-text-tertiary px-1 italic">
                {{ locale.fromEmailHint }}
              </p>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.password }}</label
              >
              <input
                v-model="config.smtpPassword"
                autocomplete="new-password"
                type="password"
                placeholder="••••••••••••"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30"
              >
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.fromName }}</label
              >
              <input
                v-model="config.smtpFromName"
                autocomplete="off"
                type="text"
                :placeholder="locale.defaultFromName"
                class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30"
              >
            </div>
          </div>
        </section>

        <!-- SMTP 测试模块 -->
        <section class="bg-bg-secondary-30 border border-border-secondary rounded-[2rem] p-6 space-y-6">
          <h3
            class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2"
          >
            <Send :size="16" class="text-success" /> {{ locale.serviceTest }}
          </h3>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1"
                >{{ locale.testEmail }}</label
              >
              <div class="flex gap-2">
                <input
                  v-model="testEmail"
                  autocomplete="off"
                  type="email"
                  :placeholder="locale.testEmailPlaceholder"
                  class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30"
                >
                <button
                  class="flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-tertiary text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  :disabled="testing || !testEmail || !config.smtpEnabled"
                  @click="sendTestEmail"
                >
                  <Check v-if="testResult?.success" :size="14" class="text-success" />
                  <Send v-else :size="14" />
                  {{ testing ? locale.sending : testResult?.success ? locale.sent : locale.send }}
                </button>
              </div>
            </div>

            <div v-if="testResult">
              <div
                class="flex items-center gap-2 p-3 rounded-xl text-xs"
                :class="
                  testResult.success
                    ? 'bg-success-10 text-success border border-success-20'
                    : 'bg-error-10 text-error border border-error-20'
                "
              >
                <CheckCircle v-if="testResult.success" :size="14" />
                <XCircle v-else :size="14" />
                <div class="flex flex-col gap-0.5">
                  <p class="font-bold">{{ testResult.message }}</p>
                  <p v-if="testResult.detail" class="text-[10px] opacity-80 break-all font-mono">
                    {{ testResult.detail }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 右侧栏：模板编辑器 -->
      <div class="xl:col-span-8">
        <EmailTemplateManager />
      </div>
    </div>
    <section class="bg-bg-secondary-30 border border-border-secondary rounded-[2rem] p-6 space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <Bot :size="16" class="text-primary shrink-0" />
          <h3 class="text-sm font-black text-text-primary uppercase tracking-widest truncate">{{ astrbotLocale.title }}</h3>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="astrbotConfig.astrbotEnabled"
          :aria-label="astrbotLocale.enabled"
          class="relative w-10 h-5 rounded-full transition-colors shrink-0"
          :class="astrbotConfig.astrbotEnabled ? 'bg-primary-hover' : 'bg-bg-tertiary'"
          @click="astrbotConfig.astrbotEnabled = !astrbotConfig.astrbotEnabled"
        >
          <span
            class="absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all"
            :class="astrbotConfig.astrbotEnabled ? 'left-6' : 'left-1'"
          />
        </button>
      </div>
      <p class="text-xs text-text-tertiary">{{ astrbotLocale.desc }}</p>

      <div v-if="astrbotLoaded" class="space-y-6">
        <div class="space-y-3">
          <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.platformHint }}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <button
              v-for="platform in platformKeys"
              :key="platform"
              type="button"
              role="switch"
              :aria-checked="astrbotPlatforms[platform]"
              class="flex items-center justify-between gap-3 p-3 bg-bg-primary border rounded-xl text-left transition-all"
              :class="astrbotPlatforms[platform] ? 'border-primary-30 bg-primary-hover-5' : 'border-border-secondary hover:border-border-tertiary'"
              @click="astrbotPlatforms[platform] = !astrbotPlatforms[platform]"
            >
              <span class="text-xs font-bold text-text-primary truncate">{{ astrbotLocale.platforms[platform] }}</span>
              <span class="relative w-8 h-4 rounded-full transition-colors shrink-0" :class="astrbotPlatforms[platform] ? 'bg-primary-hover' : 'bg-bg-tertiary'">
                <span class="absolute top-0.5 w-3 h-3 bg-bg-secondary rounded-full transition-all" :class="astrbotPlatforms[platform] ? 'left-[18px]' : 'left-0.5'" />
              </span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-border-secondary pt-5">
          <label class="space-y-1.5 block">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.baseUrl }}</span>
            <input v-model.trim="astrbotConfig.astrbotBaseUrl" type="url" :placeholder="astrbotLocale.baseUrlPlaceholder" class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30">
          </label>
          <label class="space-y-1.5 block">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.token }}</span>
            <input v-model="astrbotTokenInput" type="password" autocomplete="new-password" :placeholder="astrbotTokenConfigured ? astrbotLocale.tokenUnchanged : astrbotLocale.tokenPlaceholder" class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30">
          </label>
          <p class="lg:col-span-2 text-[10px] text-text-tertiary px-1 -mt-1">{{ astrbotLocale.tokenHint }}</p>
          <label class="space-y-1.5 block">
            <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.pushMode }}</span>
            <CustomSelect v-model="astrbotConfig.astrbotPushMode" class="w-full" :options="pushModeOptions" />
          </label>
          <p class="lg:col-span-2 text-[10px] text-text-tertiary px-1 -mt-1">{{ astrbotLocale.pushModeHint }}</p>
        </div>

        <div class="space-y-3 border-t border-border-secondary pt-5">
          <div>
            <h4 class="text-sm font-black text-text-primary">{{ astrbotLocale.weeklyTitle }}</h4>
            <p class="text-xs text-text-tertiary mt-1">{{ astrbotLocale.weeklyHint }}</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="space-y-1.5 block">
              <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.weeklyLayout }}</span>
              <CustomSelect v-model="astrbotWeeklyConfig.layoutStyle" :options="weeklyLayoutOptions" />
            </label>
            <label class="space-y-1.5 block">
              <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.weeklyListColumns }}</span>
              <CustomSelect v-model="astrbotWeeklyConfig.listColumns" :options="weeklyColumnOptions" />
            </label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              v-for="key in weeklyBooleanKeys"
              :key="key"
              type="button"
              role="switch"
              :aria-checked="astrbotWeeklyConfig[key]"
              class="flex items-center justify-between gap-3 p-3 bg-bg-primary border rounded-xl text-left transition-all"
              :class="astrbotWeeklyConfig[key] ? 'border-primary-30 bg-primary-hover-5' : 'border-border-secondary hover:border-border-tertiary'"
              @click="astrbotWeeklyConfig[key] = !astrbotWeeklyConfig[key]"
            >
              <span class="text-xs font-bold text-text-primary">{{ astrbotLocale.weeklyFields[key] }}</span>
              <span class="relative w-8 h-4 rounded-full transition-colors shrink-0" :class="astrbotWeeklyConfig[key] ? 'bg-primary-hover' : 'bg-bg-tertiary'">
                <span class="absolute top-0.5 w-3 h-3 bg-bg-secondary rounded-full transition-all" :class="astrbotWeeklyConfig[key] ? 'left-[18px]' : 'left-0.5'" />
              </span>
            </button>
          </div>
        </div>

        <div class="space-y-5 border-t border-border-secondary pt-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h4 class="text-sm font-black text-text-primary">{{ astrbotLocale.groupTitle }}</h4>
              <p class="text-xs text-text-tertiary mt-1">{{ astrbotLocale.groupHint }}</p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="astrbotConfig.astrbotBroadcastEnabled"
              :aria-label="astrbotLocale.groupEnabled"
              class="relative w-10 h-5 rounded-full transition-colors shrink-0"
              :class="astrbotConfig.astrbotBroadcastEnabled ? 'bg-primary-hover' : 'bg-bg-tertiary'"
              @click="astrbotConfig.astrbotBroadcastEnabled = !astrbotConfig.astrbotBroadcastEnabled"
            >
              <span class="absolute top-1 w-3 h-3 bg-bg-secondary rounded-full transition-all" :class="astrbotConfig.astrbotBroadcastEnabled ? 'left-6' : 'left-1'" />
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.groupTargetsTitle }}</p>
              <p class="text-xs text-text-tertiary mt-1 px-1">{{ astrbotLocale.groupTargetsHint }}</p>
            </div>
            <div v-for="(target, index) in astrbotGroupTargets" :key="index" class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_9rem_8rem_2.5rem] gap-2 items-center">
              <input v-model.trim="target.umo" type="text" :placeholder="astrbotLocale.groupTargetPlaceholder" class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30">
              <CustomSelect v-model="target.platform" class="w-full" :options="groupPlatformOptions" />
              <input v-model.trim="target.label" type="text" :placeholder="astrbotLocale.groupLabelPlaceholder" class="w-full bg-bg-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30">
              <button type="button" class="flex items-center justify-center w-10 h-10 rounded-xl text-text-tertiary hover:text-error hover:bg-error-10 transition-colors" :title="astrbotLocale.groupRemove" :aria-label="astrbotLocale.groupRemove" @click="removeGroupTarget(index)">
                <Trash2 :size="15" />
              </button>
            </div>
            <button type="button" class="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold border border-border-secondary rounded-xl text-text-secondary hover:text-primary hover:border-primary-30 transition-colors" @click="addGroupTarget">
              <Plus :size="14" /> {{ astrbotLocale.groupAdd }}
            </button>
          </div>
          <div class="space-y-3">
            <p class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.groupEventsTitle }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                v-for="key in groupEventKeys"
                :key="key"
                type="button"
                role="switch"
                :aria-checked="astrbotGroupEvents[key]"
                class="flex items-center justify-between gap-3 p-3 bg-bg-primary border rounded-xl text-left transition-all"
                :class="astrbotGroupEvents[key] ? 'border-primary-30 bg-primary-hover-5' : 'border-border-secondary hover:border-border-tertiary'"
                @click="astrbotGroupEvents[key] = !astrbotGroupEvents[key]"
              >
                <span class="text-xs font-bold text-text-primary">{{ astrbotLocale.groupEvents[key] }}</span>
                <span class="relative w-8 h-4 rounded-full transition-colors shrink-0" :class="astrbotGroupEvents[key] ? 'bg-primary-hover' : 'bg-bg-tertiary'">
                  <span class="absolute top-0.5 w-3 h-3 bg-bg-secondary rounded-full transition-all" :class="astrbotGroupEvents[key] ? 'left-[18px]' : 'left-0.5'" />
                </span>
              </button>
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-1.5 block">
              <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.groupMergeWindow }}</span>
              <input v-model.number="astrbotGroupThrottle.mergeWindowSeconds" type="number" min="0" max="3600" class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30">
            </label>
            <label class="space-y-1.5 block">
              <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest px-1">{{ astrbotLocale.groupMinInterval }}</span>
              <input v-model.number="astrbotGroupThrottle.minIntervalSeconds" type="number" min="0" max="3600" class="w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary-30">
            </label>
          </div>
          <p class="text-[10px] text-text-tertiary px-1">{{ astrbotLocale.groupThrottleHint }}</p>
        </div>

        <div class="flex justify-end border-t border-border-secondary pt-5">
          <button :disabled="astrbotSaving" class="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" @click="saveAstrbotConfig">
            <Save :size="14" /> {{ astrbotSaving ? astrbotLocale.saving : astrbotLocale.save }}
          </button>
        </div>
      </div>
      <div v-else class="flex justify-center py-8">
        <AppSpinner :size="20" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'
import EmailTemplateManager from '~/components/Admin/EmailTemplateManager.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { ASTRBOT_PLATFORMS, DEFAULT_ASTRBOT_PLATFORMS } from '~~/server/utils/astrbot-platforms'
import { ASTRBOT_GROUP_EVENT_KEYS, DEFAULT_ASTRBOT_GROUP_EVENTS, DEFAULT_ASTRBOT_GROUP_THROTTLE } from '~~/server/utils/astrbot-group'
import { ASTRBOT_WEEKLY_BOOLEAN_KEYS, ASTRBOT_WEEKLY_LAYOUTS, SYSTEM_SETTINGS_DEFAULTS } from '~~/server/utils/system-settings-defaults'
import { Bot, Server, Save, Check, Send, CheckCircle, XCircle, RotateCw, Plus, Trash2 } from '@lucide/vue'

const { showToast: showNotification } = useToast()
const { admin } = useLocale()
const locale = computed(() => admin.value?.smtpManager || {})
const astrbotLocale = computed(() => admin.value?.astrbotManager || {})
const { localize: localizeServerError } = useServerErrors()
const astrbotLoaded = ref(false)
const astrbotSaving = ref(false)
const astrbotTokenConfigured = ref(false)
const astrbotTokenInput = ref('')
const platformKeys = ASTRBOT_PLATFORMS
const astrbotPlatforms = ref({ ...DEFAULT_ASTRBOT_PLATFORMS })
const astrbotConfig = ref({ astrbotEnabled: false, astrbotBaseUrl: '', astrbotPushMode: 'push' })
const weeklyDefaults = SYSTEM_SETTINGS_DEFAULTS.astrbotWeeklyConfig
const weeklyBooleanKeys = ASTRBOT_WEEKLY_BOOLEAN_KEYS
const astrbotWeeklyConfig = ref({ ...weeklyDefaults })
const groupEventKeys = ASTRBOT_GROUP_EVENT_KEYS
const groupEventDefaults = DEFAULT_ASTRBOT_GROUP_EVENTS
const astrbotGroupEvents = ref({ ...groupEventDefaults })
const astrbotGroupTargets = ref([])
const astrbotGroupThrottle = ref({ ...DEFAULT_ASTRBOT_GROUP_THROTTLE })
// 平台归属必须由管理员指定：UMO 前缀是 AstrBot 平台实例 ID，无法反推适配器。
const groupPlatformOptions = computed(() => platformKeys.map(value => ({ value, label: astrbotLocale.value.platforms?.[value] || value })))

const addGroupTarget = () => { astrbotGroupTargets.value.push({ umo: '', platform: 'qq', label: '' }) }
const removeGroupTarget = (index) => { astrbotGroupTargets.value.splice(index, 1) }
// 空行是管理员点「添加」后还没填的占位，提交前剔除，否则会被服务端判为非法。
const filledGroupTargets = computed(() => astrbotGroupTargets.value
  .filter(target => (target.umo || '').trim())
  .map(target => ({ umo: target.umo.trim(), platform: target.platform, label: (target.label || '').trim() })))

const pushModeOptions = computed(() => [
  { value: 'push', label: astrbotLocale.value.pushModePush || 'push' },
  { value: 'pull', label: astrbotLocale.value.pushModePull || 'pull' }
])

const weeklyLayoutOptions = computed(() => ASTRBOT_WEEKLY_LAYOUTS.map(value => ({
  value,
  label: value === 'table' ? (astrbotLocale.value.weeklyLayoutTable || 'Table') : (astrbotLocale.value.weeklyLayoutClassic || 'Classic list')
})))
const weeklyColumnOptions = computed(() => [
  { value: 1, label: astrbotLocale.value.weeklyOneColumn || 'One column' },
  { value: 2, label: astrbotLocale.value.weeklyTwoColumns || 'Two columns' }
])

const loadAstrbotConfig = async () => {
  try {
    const response = await $fetch('/api/admin/system-settings')
    astrbotPlatforms.value = Object.fromEntries(platformKeys.map(platform => [platform, response.astrbotPlatforms?.[platform] === true]))
    astrbotWeeklyConfig.value = {
      ...weeklyDefaults,
      layoutStyle: response.astrbotWeeklyConfig?.layoutStyle === 'table' ? 'table' : 'classic',
      listColumns: response.astrbotWeeklyConfig?.listColumns === 2 ? 2 : 1,
      ...Object.fromEntries(weeklyBooleanKeys.map(key => [
        key, typeof response.astrbotWeeklyConfig?.[key] === 'boolean' ? response.astrbotWeeklyConfig[key] : weeklyDefaults[key]
      ]))
    }
    astrbotConfig.value = {
      astrbotEnabled: !!response.astrbotEnabled,
      astrbotBaseUrl: response.astrbotBaseUrl || '',
      astrbotPushMode: response.astrbotPushMode === 'pull' ? 'pull' : 'push',
      astrbotBroadcastEnabled: !!response.astrbotBroadcastEnabled
    }
    astrbotGroupTargets.value = Array.isArray(response.astrbotGroupTargets)
      ? response.astrbotGroupTargets.map(target => ({
        umo: typeof target?.umo === 'string' ? target.umo : '',
        platform: groupPlatformOptions.value.some(option => option.value === target?.platform) ? target.platform : 'qq',
        label: typeof target?.label === 'string' ? target.label : ''
      }))
      : []
    astrbotGroupEvents.value = Object.fromEntries(groupEventKeys.map(key => [
      key, typeof response.astrbotGroupEvents?.[key] === 'boolean' ? response.astrbotGroupEvents[key] : groupEventDefaults[key]
    ]))
    astrbotGroupThrottle.value = {
      mergeWindowSeconds: Number.isFinite(response.astrbotGroupThrottle?.mergeWindowSeconds) ? response.astrbotGroupThrottle.mergeWindowSeconds : DEFAULT_ASTRBOT_GROUP_THROTTLE.mergeWindowSeconds,
      minIntervalSeconds: Number.isFinite(response.astrbotGroupThrottle?.minIntervalSeconds) ? response.astrbotGroupThrottle.minIntervalSeconds : DEFAULT_ASTRBOT_GROUP_THROTTLE.minIntervalSeconds
    }
    astrbotTokenConfigured.value = !!response.astrbotToken
    astrbotTokenInput.value = ''
    astrbotLoaded.value = true
  } catch (err) {
    showNotification(localizeServerError(err, astrbotLocale.value.loadFailed), 'error')
  }
}

const saveAstrbotConfig = async () => {
  astrbotSaving.value = true
  try {
    const body = {
      ...astrbotConfig.value,
      astrbotPlatforms: { ...astrbotPlatforms.value },
      astrbotWeeklyConfig: { ...astrbotWeeklyConfig.value },
      astrbotGroupTargets: filledGroupTargets.value,
      astrbotGroupEvents: { ...astrbotGroupEvents.value },
      astrbotGroupThrottle: { ...astrbotGroupThrottle.value }
    }
    // 不回传掩码；空输入表示保留已有密钥。
    if (astrbotTokenInput.value) body.astrbotToken = astrbotTokenInput.value
    await $fetch('/api/admin/system-settings', { method: 'POST', body })
    showNotification(astrbotLocale.value.saved, 'success')
    await loadAstrbotConfig()
  } catch (err) {
    showNotification(localizeServerError(err, astrbotLocale.value.saveFailed), 'error')
  } finally {
    astrbotSaving.value = false
  }
}
const getLocaleMessage = (key) => locale.value?.[key] || `SMTP 配置：${key}`
const getOptionText = (value, fallback) => {
  if (typeof value === 'function') return value() || fallback
  if (typeof value === 'string') return value || fallback
  return fallback
}
const secureOptionLabels = computed(() => ({
  ssl: getOptionText(locale.value?.secureOptions?.ssl, 'SSL/TLS'),
  none: getOptionText(locale.value?.secureOptions?.none, 'None')
}))

// 响应式数据
const config = ref({
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: getLocaleMessage('defaultFromName')
})

const testEmail = ref('')
const testing = ref(false)
const saving = ref(false)
const reloading = ref(false)
const testResult = ref(null)
const originalConfig = ref({})

// 将服务端返回的固定文案映射为当前语言，避免后端中文穿透到前端界面。
const getLocalizedServerMessage = (message) => {
  if (!message) {
    return ''
  }

  const serverMessages = locale.value?.serverMessages
  if (!serverMessages) return message

  const rawMessages = serverMessages.raw
  if (rawMessages) {
    const key = Object.keys(rawMessages).find((item) => rawMessages[item] === message)
    return key ? serverMessages[key] : message
  }

  const matchedEntry = Object.values(serverMessages).find((entry) => entry?.raw === message)
  return matchedEntry?.text || message
}

const localizeSmtpResult = (response) => ({
  ...response,
  message: getLocalizedServerMessage(response?.message) || response?.message
})

// 加载配置
const loadConfig = async () => {
  try {
    const response = await $fetch('/api/admin/system-settings')

    config.value = {
      smtpEnabled: response.smtpEnabled || false,
      smtpHost: response.smtpHost || '',
      smtpPort: response.smtpPort || 587,
      smtpSecure: response.smtpSecure || false,
      smtpUsername: response.smtpUsername || '',
      smtpPassword: response.smtpPassword || '',
      smtpFromEmail: response.smtpFromEmail || '',
      smtpFromName: response.smtpFromName || getLocaleMessage('defaultFromName')
    }

    // 保存原始配置用于重置
    originalConfig.value = { ...config.value }
  } catch (error) {
    console.error('加载SMTP配置失败:', error)
    showNotification(getLocaleMessage('loadFailed'), 'error')
  }
}

// 保存配置
const saveConfig = async () => {
  if (config.value.smtpEnabled) {
    // 验证必填字段
    if (!config.value.smtpHost || !config.value.smtpUsername || !config.value.smtpPassword) {
      showNotification(getLocaleMessage('incompleteConfig'), 'error')
      return
    }
  }

  saving.value = true
  try {
    await $fetch('/api/admin/system-settings', {
      method: 'POST',
      body: config.value
    })

    originalConfig.value = { ...config.value }
    showNotification(getLocaleMessage('saveSuccess'), 'success')
  } catch (error) {
    console.error('保存SMTP配置失败:', error)
    showNotification(getLocalizedServerMessage(error.data?.message) || getLocaleMessage('saveFailed'), 'error')
  } finally {
    saving.value = false
  }
}

// 重置配置
const resetConfig = () => {
  config.value = { ...originalConfig.value }
  testResult.value = null
  showNotification(getLocaleMessage('resetSuccess'), 'info')
}

const reloadSmtpConfig = async () => {
  reloading.value = true
  try {
    const response = await $fetch('/api/admin/smtp/reload', {
      method: 'POST'
    })
    if (!response.success) {
      throw new Error(getLocalizedServerMessage(response.message) || getLocaleMessage('reloadFailed'))
    }
    showNotification(getLocalizedServerMessage(response.message) || getLocaleMessage('reloadSuccess'), 'success')
  } catch (error) {
    console.error('重载SMTP配置失败:', error)
    showNotification(
      getLocalizedServerMessage(error.data?.message || error.message) || getLocaleMessage('reloadFailed'),
      'error'
    )
  } finally {
    reloading.value = false
  }
}

// 测试连接
const testConnection = async () => {
  if (!config.value.smtpEnabled || !config.value.smtpHost) {
    showNotification(getLocaleMessage('serverRequired'), 'error')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const response = await $fetch('/api/admin/smtp/test-connection', {
      method: 'POST',
      body: config.value
    })

    testResult.value = localizeSmtpResult(response)
  } catch (error) {
    console.error('测试连接失败:', error)
    testResult.value = {
      success: false,
      message:
        getLocalizedServerMessage(error.data?.message) || getLocaleMessage('testConnectionFailed')
    }
  } finally {
    testing.value = false
  }
}

// 发送测试邮件
const sendTestEmail = async () => {
  if (!testEmail.value) {
    showNotification(getLocaleMessage('testEmailRequired'), 'error')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const response = await $fetch('/api/admin/smtp/test-email', {
      method: 'POST',
      body: {
        ...config.value,
        testEmail: testEmail.value
      }
    })

    testResult.value = localizeSmtpResult(response)
    if (response.success) {
      showNotification(getLocaleMessage('testEmailSuccess'), 'success')
      setTimeout(() => {
        testResult.value = null
      }, 5000)
    }
  } catch (error) {
    console.error('发送测试邮件失败:', error)
    testResult.value = {
      success: false,
      message: getLocalizedServerMessage(error.data?.message) || getLocaleMessage('testEmailFailed')
    }
  } finally {
    testing.value = false
  }
}

// 生命周期
onMounted(() => {
  loadConfig()
  loadAstrbotConfig()
})
</script>

<style scoped></style>
