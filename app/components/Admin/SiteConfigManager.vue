<template>
  <div class="max-w-[1200px] mx-auto space-y-6 pb-24 px-2">
    <!-- 顶部标题栏 -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-black text-text-primary tracking-tight">{{ locale.pageTitle }}</h2>
        <p class="text-xs text-text-tertiary mt-1 font-medium">
          {{ locale.pageDescription }}
        </p>
      </div>
      <div class="flex gap-3">
        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-5 py-2 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-tertiary text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          @click="resetForm"
        >
          <RotateCcw :size="14" /> {{ locale.reset }}
        </button>
        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-8 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveConfig"
        >
          <template v-if="saving">
            <AppSpinner :size="14" />
            {{ locale.saving }}
          </template>
          <template v-else-if="saveSuccess"> <CheckCircle2 :size="14" /> {{ locale.saved }} </template>
          <template v-else> <Save :size="14" /> {{ locale.saveConfig }} </template>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <AppSpinner :size="32" class="mb-4" />
      <p class="text-text-tertiary text-sm">{{ locale.loading }}</p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 基础信息 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <Globe :size="16" class="text-primary" /> {{ locale.basicInfo }}
        </h3>
        <div class="space-y-4">
          <div>
            <label :class="labelClass">{{ locale.siteTitle }}</label>
            <input
              v-model="formData.siteTitle"
              type="text"
              :placeholder="locale.siteTitlePlaceholder"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.icpNumber }}</label>
            <input
              v-model="formData.icpNumber"
              type="text"
              :placeholder="locale.icpPlaceholder"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.gonganNumber }}</label>
            <input
              v-model="formData.gonganNumber"
              type="text"
              :placeholder="locale.gonganPlaceholder"
              :class="inputClass"
            />
          </div>
          <div class="pt-2">
            <div
              class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
            >
              <div>
                <p class="text-xs font-bold text-text-primary">{{ locale.showBeianIcon }}</p>
                <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.showBeianIconDesc }}</p>
              </div>
              <input
                v-model="formData.showBeianIcon"
                type="checkbox"
                class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label :class="labelClass">{{ locale.siteDescription }}</label>
            <textarea
              v-model="formData.siteDescription"
              :rows="3"
              :placeholder="locale.siteDescriptionPlaceholder"
              :class="[inputClass, 'resize-none']"
            />
          </div>
        </div>
      </section>

      <!-- 视觉识别 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <ImageIcon :size="16" class="text-info" /> {{ locale.visualIdentity }}
        </h3>
        <div class="space-y-4">
          <div>
            <label :class="labelClass">{{ locale.siteLogoUrl }}</label>
            <input
              v-model="formData.siteLogoUrl"
              type="text"
              :placeholder="locale.siteLogoPlaceholder"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.schoolLogoHome }}</label>
            <input
              v-model="formData.schoolLogoHomeUrl"
              type="text"
              :placeholder="locale.schoolLogoHomePlaceholder"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ locale.schoolLogoPrint }}</label>
            <input
              v-model="formData.schoolLogoPrintUrl"
              type="text"
              :placeholder="locale.schoolLogoPrintPlaceholder"
              :class="inputClass"
            />
          </div>
        </div>
      </section>

      <!-- 投稿逻辑设置 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <Settings2 :size="16" class="text-warning" /> {{ locale.submissionLogic }}
        </h3>
        <div class="space-y-6">
          <div
            class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
          >
            <div>
              <p class="text-xs font-bold text-text-primary">{{ locale.enableCollaborative }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.enableCollaborativeDesc }}</p>
            </div>
            <input
              v-model="formData.enableCollaborativeSubmission"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div
            class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
          >
            <div>
              <p class="text-xs font-bold text-text-primary">{{ locale.enableRemarks }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.enableRemarksDesc }}</p>
            </div>
            <input
              v-model="formData.enableSubmissionRemarks"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div
            class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
          >
            <div>
              <p class="text-xs font-bold text-text-primary">{{ locale.songQuotaEnabled }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.songQuotaEnabledDesc }}</p>
            </div>
            <input
              v-model="formData.songQuotaEnabled"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div v-if="formData.songQuotaEnabled" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomSelect
              v-model="formData.songQuotaPeriodType"
              :label="locale.songQuotaPeriodType"
              :options="songQuotaPeriodOptions"
            />
            <div>
              <label :class="labelClass">{{ locale.songQuotaPeriodAmount }}</label>
              <input
                v-model.number="formData.songQuotaPeriodAmount"
                type="number"
                min="1"
                step="1"
                :class="inputClass"
              />
            </div>
          </div>

          <div
            v-for="setting in songQuotaToggleSettings"
            :key="setting.key"
            class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
          >
            <div class="pr-4">
              <p class="text-xs font-bold text-text-primary">{{ setting.label }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5">{{ setting.description }}</p>
            </div>
            <input
              v-model="formData[setting.key]"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

          <div
            class="flex items-center justify-between p-3 bg-bg-primary-50 border border-border-secondary rounded-xl"
          >
            <div>
              <p class="text-xs font-bold text-text-primary">{{ locale.enableReplay }}</p>
              <p class="text-[10px] text-text-tertiary mt-0.5">{{ locale.enableReplayDesc }}</p>
            </div>
            <input
              v-model="formData.enableReplayRequests"
              type="checkbox"
              class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
            />
          </div>

        </div>
      </section>

      <!-- 安全与隐私设置 -->
      <section :class="cardClass">
        <h3
          class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 border-b border-border-secondary pb-4"
        >
          <Shield :size="16" class="text-error" /> {{ locale.securityPrivacy }}
        </h3>
        <div class="space-y-4">
          <div class="p-4 bg-bg-primary-50 border border-border-secondary rounded-xl space-y-4">
            <div class="flex items-start gap-4">
              <div class="shrink-0 pt-0.5">
                <input
                  id="captcha-enabled"
                  v-model="formData.captchaEnabled"
                  type="checkbox"
                  class="w-4 h-4 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                />
              </div>
              <div class="flex-1 space-y-4">
                <label for="captcha-enabled" class="cursor-pointer block">
                  <p class="text-xs font-bold text-text-primary">{{ locale.captchaEnabled }}</p>
                  <p class="text-[10px] text-text-tertiary mt-1 leading-relaxed">
                    {{ locale.captchaEnabledDesc }}
                  </p>
                </label>

                <div v-if="formData.captchaEnabled" class="pt-2 border-t border-border-secondary space-y-4">
                  <!-- 验证码类型选择 -->
                  <div>
                    <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.captchaType }}</label>
                    <div class="flex gap-4">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          v-model="formData.captchaProvider"
                          type="radio"
                          value="graphic"
                          class="w-4 h-4 rounded-full border-border-secondary bg-bg-secondary cursor-pointer"
                        />
                        <span class="text-sm text-text-secondary">{{ locale.captchaGraphic }}</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          v-model="formData.captchaProvider"
                          type="radio"
                          value="turnstile"
                          class="w-4 h-4 rounded-full border-border-secondary bg-bg-secondary cursor-pointer"
                        />
                        <span class="text-sm text-text-secondary">{{ locale.captchaTurnstile }}</span>
                      </label>
                    </div>
                  </div>

                  <!-- 图形验证码配置 -->
                  <div v-if="formData.captchaProvider === 'graphic'">
                    <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.captchaMaxFailures }}</label>
                    <input
                      v-model.number="formData.captchaMaxFailures"
                      type="number"
                      min="1"
                      :placeholder="locale.captchaMaxFailuresPlaceholder"
                      class="w-full max-w-[200px] bg-bg-secondary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                    <p class="text-[10px] text-text-tertiary mt-1">
                      {{ locale.captchaMaxFailuresDesc }}
                    </p>
                  </div>

                  <!-- Turnstile 配置 -->
                  <div v-if="formData.captchaProvider === 'turnstile'" class="space-y-4">
                    <div>
                      <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.turnstileSiteKey }}</label>
                      <input
                        v-model="formData.turnstileSiteKey"
                        type="text"
                        :placeholder="locale.turnstileSiteKeyPlaceholder"
                        class="w-full bg-bg-secondary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-text-tertiary mb-2">{{ locale.turnstileSecretKey }}</label>
                      <input
                        v-model="formData.turnstileSecretKey"
                        type="password"
                        :placeholder="locale.turnstileSecretKeyPlaceholder"
                        class="w-full bg-bg-secondary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      />
                      <p class="text-[10px] text-text-tertiary mt-1">
                        {{ locale.turnstileSecretKeyDesc }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 bg-bg-primary-50 border border-border-secondary rounded-xl space-y-4">
            <div class="flex items-start gap-4">
              <div class="shrink-0 pt-0.5">
                <input
                  id="force-password-change-first-login"
                  v-model="formData.forcePasswordChangeOnFirstLogin"
                  type="checkbox"
                  class="w-4 h-4 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                />
              </div>
              <label for="force-password-change-first-login" class="cursor-pointer">
                <p class="text-xs font-bold text-text-primary">
                  {{ locale.forcePasswordChangeOnFirstLogin }}
                </p>
                <p class="text-[10px] text-text-tertiary mt-1 leading-relaxed">
                  {{ locale.forcePasswordChangeOnFirstLoginDesc }}
                </p>
              </label>
            </div>
          </div>

          <div class="p-4 bg-bg-primary-50 border border-border-secondary rounded-xl space-y-4">
            <div class="flex items-start gap-4">
              <div class="shrink-0 pt-0.5">
                <input
                  id="show-keywords"
                  v-model="formData.showBlacklistKeywords"
                  type="checkbox"
                  class="w-4 h-4 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                />
              </div>
              <label for="show-keywords" class="cursor-pointer">
                <p class="text-xs font-bold text-text-primary">{{ locale.showBlacklistKeywords }}</p>
                <p class="text-[10px] text-text-tertiary mt-1 leading-relaxed">
                  {{ locale.showBlacklistKeywordsDesc }}
                </p>
              </label>
            </div>
          </div>

          <div class="p-4 bg-bg-primary-50 border border-border-secondary rounded-xl space-y-4">
            <div class="flex items-start gap-4">
              <div class="shrink-0 pt-0.5">
                <input
                  id="hide-students"
                  v-model="formData.hideStudentInfo"
                  type="checkbox"
                  class="w-4 h-4 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                />
              </div>
              <label for="hide-students" class="cursor-pointer">
                <p class="text-xs font-bold text-text-primary">{{ locale.hideStudentInfo }}</p>
                <p class="text-[10px] text-text-tertiary mt-1 leading-relaxed">
                  {{ locale.hideStudentInfoDesc }}
                </p>
              </label>
            </div>
          </div>

          <div class="p-4 bg-bg-primary-50 border border-border-secondary rounded-xl space-y-4">
            <div class="flex items-start gap-4">
              <div class="shrink-0 pt-0.5">
                <input
                  id="telemetry-enabled"
                  v-model="formData.telemetryEnabled"
                  type="checkbox"
                  class="w-4 h-4 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                />
              </div>
              <label for="telemetry-enabled" class="cursor-pointer">
                <p class="text-xs font-bold text-text-primary">{{ locale.telemetryEnabled }}</p>
                <p class="text-[10px] text-text-tertiary mt-1 leading-relaxed">
                  {{ locale.telemetryEnabledDesc }} <strong class="text-text-tertiary">{{ locale.telemetryPrivacy }}</strong>
                </p>
              </label>
            </div>
          </div>

          <div
            class="p-4 bg-primary-5 border border-primary-10 rounded-xl flex items-start gap-3"
          >
            <AlertCircle class="text-primary shrink-0 mt-0.5" :size="14" />
            <p class="text-[10px] text-text-tertiary leading-normal">
              {{ locale.configWarning }}
            </p>
          </div>
        </div>
      </section>

      <!-- 投稿须知 -->
      <section
        class="lg:col-span-2 bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 space-y-6"
      >
        <div class="flex items-center justify-between border-b border-border-secondary pb-4">
          <h3
            class="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2"
          >
            <FileText :size="16" class="text-success" /> {{ locale.submissionGuidelines }}
          </h3>
          <div class="flex gap-1 bg-bg-primary rounded-lg p-1">
            <button
              :class="[
                'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider',
                editMode === 'edit'
                  ? 'bg-primary-hover text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              ]"
              @click="editMode = 'edit'"
            >
              {{ locale.guidelinesEdit }}
            </button>
            <button
              :class="[
                'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider',
                editMode === 'preview'
                  ? 'bg-primary-hover text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              ]"
              @click="editMode = 'preview'"
            >
              {{ locale.guidelinesPreview }}
            </button>
          </div>
        </div>
        <textarea
          v-if="editMode === 'edit'"
          v-model="formData.submissionGuidelines"
          :rows="6"
          :placeholder="locale.guidelinesPlaceholder"
          :class="[inputClass, 'font-mono text-xs leading-relaxed min-h-[150px]']"
        />
        <div
          v-else
          class="guidelines-preview markdown-body w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-3 text-sm text-text-secondary leading-relaxed min-h-[150px] max-h-[400px] overflow-y-auto"
          v-html="renderedPreview"
        />
      </section>

      <!-- OAuth 第三方登录配置 -->
      <OAuthConfigManager v-model="formData" class="lg:col-span-2" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Globe,
  ImageIcon,
  FileText,
  Settings2,
  Shield,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useToast } from '~/composables/useToast'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useLocale } from '~/utils/locale'
import { renderMarkdown } from '~/utils/markdown'
import { getAggregateOAuthLoginTypesOrDefault } from '~/utils/oauth'
import OAuthConfigManager from './OAuthConfigManager.vue'

const { showToast: showNotification } = useToast()
const { refreshSiteConfig } = useSiteConfig()
const { localize: localizeServerError } = useServerErrors()
const { siteConfig: locale } = useLocale()

const loading = ref(true)
const saving = ref(false)
const saveSuccess = ref(false)
const editMode = ref('edit') // 投稿须知编辑/预览模式

// 投稿须知 Markdown 预览
const renderedPreview = computed(() => renderMarkdown(formData.value.submissionGuidelines))

// 样式类常量
const inputClass =
  'w-full bg-bg-primary border border-border-secondary rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-30 transition-all placeholder:text-text-primary'
const labelClass = 'text-[10px] font-black text-text-disabled uppercase tracking-widest px-1 block mb-2'
const cardClass = 'bg-bg-secondary-40 border border-border-secondary rounded-2xl p-6 shadow-xl space-y-6'

const defaultSubmissionGuidelines = computed(() => locale.value?.defaultSubmissionGuidelines || '请遵守校园广播站投稿规范。')

const formData = ref({
  siteTitle: '',
  siteLogoUrl: '',
  schoolLogoHomeUrl: '',
  schoolLogoPrintUrl: '',
  siteDescription: '',
  submissionGuidelines: '',
  icpNumber: '',
  gonganNumber: '',
  showBeianIcon: false,
  enableCollaborativeSubmission: true,
  enableSubmissionRemarks: false,
  enableReplayRequests: false,
  songQuotaEnabled: false,
  songQuotaPeriodType: 'DAILY',
  songQuotaPeriodAmount: 5,
  adminSongQuotaExempt: true,
  blockOnSongQuotaInsufficient: true,
  legacyCardConversionEnabled: false,
  showBlacklistKeywords: false,
  hideStudentInfo: true,
  forcePasswordChangeOnFirstLogin: false,
  telemetryEnabled: true,
  captchaEnabled: false,
  captchaProvider: 'graphic',
  turnstileSiteKey: '',
  turnstileSecretKey: '',
  captchaMaxFailures: 3,
  allowOAuthRegistration: false,
  oauthRedirectUri: '',
  oauthStateSecret: '',
  githubOAuthEnabled: false,
  githubClientId: '',
  githubClientSecret: '',
  casdoorOAuthEnabled: false,
  casdoorServerUrl: '',
  casdoorClientId: '',
  casdoorClientSecret: '',
  casdoorOrganizationName: '',
  googleOAuthEnabled: false,
  googleClientId: '',
  googleClientSecret: '',
  aggregateOAuthEnabled: false,
  aggregateOAuthAppId: '',
  aggregateOAuthAppKey: '',
  aggregateOAuthLoginType: ['qq'],
  aggregateOAuthEndpoint: 'https://a.idcfx.net/connect.php',
  customOAuthEnabled: false,
  customOAuthDisplayName: '',
  customOAuthAuthorizeUrl: '',
  customOAuthTokenUrl: '',
  customOAuthUserInfoUrl: '',
  customOAuthScope: '',
  customOAuthClientId: '',
  customOAuthClientSecret: '',
  customOAuthUserIdField: '',
  customOAuthUsernameField: '',
  customOAuthNameField: '',
  customOAuthEmailField: '',
  customOAuthAvatarField: ''
})

const originalData = ref({})

const songQuotaPeriodOptions = computed(() => [
  { value: 'DAILY', label: locale.value?.songQuotaDaily },
  { value: 'WEEKLY', label: locale.value?.songQuotaWeekly },
  { value: 'MONTHLY', label: locale.value?.songQuotaMonthly }
])

const songQuotaToggleSettings = computed(() => [
  {
    key: 'adminSongQuotaExempt',
    label: locale.value?.adminSongQuotaExempt,
    description: locale.value?.adminSongQuotaExemptDesc
  },
  {
    key: 'blockOnSongQuotaInsufficient',
    label: locale.value?.blockOnSongQuotaInsufficient,
    description: locale.value?.blockOnSongQuotaInsufficientDesc
  },
  {
    key: 'legacyCardConversionEnabled',
    label: locale.value?.legacyCardConversionEnabled,
    description: locale.value?.legacyCardConversionEnabledDesc
  }
])

const getLocalizedServerMessage = (message) => {
  if (!message) return locale.value?.saveFailed || '系统设置保存失败'
  if (typeof message !== 'string') return String(message)

  const serverMessages = locale.value?.serverMessages
  if (!serverMessages) return message
  const rawMessages = serverMessages.raw
  if (!rawMessages) return message
  const exactMessageMap = {
    [rawMessages.oauthRedirectCallbackInvalid]: serverMessages.oauthRedirectCallbackInvalid,
    [rawMessages.oauthRedirectUrlInvalid]: serverMessages.oauthRedirectUrlInvalid,
    [rawMessages.unauthorized]: serverMessages.unauthorized,
    [rawMessages.adminOnly]: serverMessages.adminOnly,
    [rawMessages.captchaProviderInvalid]: serverMessages.captchaProviderInvalid,
    [rawMessages.turnstileRequired]: serverMessages.turnstileRequired,
    [rawMessages.smtpPortInvalid]: serverMessages.smtpPortInvalid,
    [rawMessages.oauthBaseRequired]: serverMessages.oauthBaseRequired,
    [rawMessages.githubClientIdRequired]: serverMessages.githubClientIdRequired,
    [rawMessages.githubClientSecretRequired]: serverMessages.githubClientSecretRequired,
    [rawMessages.casdoorServerUrlRequired]: serverMessages.casdoorServerUrlRequired,
    [rawMessages.casdoorClientIdRequired]: serverMessages.casdoorClientIdRequired,
    [rawMessages.casdoorClientSecretRequired]: serverMessages.casdoorClientSecretRequired,
    [rawMessages.casdoorOrganizationRequired]: serverMessages.casdoorOrganizationRequired,
    [rawMessages.googleClientIdRequired]: serverMessages.googleClientIdRequired,
    [rawMessages.googleClientSecretRequired]: serverMessages.googleClientSecretRequired,
    [rawMessages.onlyOneLimit]: serverMessages.onlyOneLimit,
    [rawMessages.updateFailed]: serverMessages.updateFailed
  }

  if (exactMessageMap[message]) return exactMessageMap[message]

  const fields = serverMessages.fields || {}
  const fieldLabelMap = {
    [rawMessages.customOAuthAuthorizeUrlLabel]: fields.customOAuthAuthorizeUrl,
    [rawMessages.customOAuthTokenUrlLabel]: fields.customOAuthTokenUrl,
    [rawMessages.customOAuthUserInfoUrlLabel]: fields.customOAuthUserInfoUrl,
    [rawMessages.customOAuthClientIdLabel]: fields.customOAuthClientId,
    [rawMessages.customOAuthClientSecretLabel]: fields.customOAuthClientSecret,
    [rawMessages.customOAuthUserIdFieldLabel]: fields.customOAuthUserIdField,
    customOAuthAuthorizeUrl: fields.customOAuthAuthorizeUrl,
    customOAuthTokenUrl: fields.customOAuthTokenUrl,
    customOAuthUserInfoUrl: fields.customOAuthUserInfoUrl,
    customOAuthClientId: fields.customOAuthClientId,
    customOAuthClientSecret: fields.customOAuthClientSecret,
    customOAuthUserIdField: fields.customOAuthUserIdField
  }

  if (
    typeof rawMessages.booleanSuffix === 'string' &&
    rawMessages.booleanSuffix.length > 0 &&
    typeof serverMessages.mustBeBoolean === 'function' &&
    message.endsWith(rawMessages.booleanSuffix)
  ) {
    return serverMessages.mustBeBoolean(message.slice(0, -rawMessages.booleanSuffix.length))
  }

  if (
    typeof rawMessages.positiveIntegerSuffix === 'string' &&
    rawMessages.positiveIntegerSuffix.length > 0 &&
    typeof serverMessages.mustBePositiveInteger === 'function' &&
    message.endsWith(rawMessages.positiveIntegerSuffix)
  ) {
    return serverMessages.mustBePositiveInteger(message.slice(0, -rawMessages.positiveIntegerSuffix.length))
  }

  if (
    typeof rawMessages.nonNegativeIntegerOrNullSuffix === 'string' &&
    rawMessages.nonNegativeIntegerOrNullSuffix.length > 0 &&
    typeof serverMessages.mustBeNonNegativeIntegerOrNull === 'function' &&
    message.endsWith(rawMessages.nonNegativeIntegerOrNullSuffix)
  ) {
    return serverMessages.mustBeNonNegativeIntegerOrNull(
      message.slice(0, -rawMessages.nonNegativeIntegerOrNullSuffix.length)
    )
  }

  if (
    typeof rawMessages.customOAuthRequiredPrefix === 'string' &&
    rawMessages.customOAuthRequiredPrefix.length > 0 &&
    typeof serverMessages.customOAuthFieldRequired === 'function' &&
    message.startsWith(rawMessages.customOAuthRequiredPrefix)
  ) {
    const rawField = message.slice(rawMessages.customOAuthRequiredPrefix.length)
    const fieldLabel = fieldLabelMap[rawField] || rawField
    return serverMessages.customOAuthFieldRequired(fieldLabel)
  }

  if (
    typeof rawMessages.invalidUrlSuffix === 'string' &&
    rawMessages.invalidUrlSuffix.length > 0 &&
    typeof serverMessages.invalidUrl === 'function' &&
    message.endsWith(rawMessages.invalidUrlSuffix)
  ) {
    const rawField = message.slice(0, -rawMessages.invalidUrlSuffix.length)
    return serverMessages.invalidUrl(fieldLabelMap[rawField] || rawField)
  }

  return message
}

// 加载配置
const loadConfig = async () => {
  try {
    loading.value = true
    const response = await fetch('/api/admin/system-settings', {
      credentials: 'include'
    })

    if (!response.ok) throw new Error(locale.value?.fetchFailed || 'Failed to load site config')

    const data = await response.json()

    formData.value = {
      siteTitle: data.siteTitle || '',
      siteLogoUrl: data.siteLogoUrl || '',
      schoolLogoHomeUrl: data.schoolLogoHomeUrl || '',
      schoolLogoPrintUrl: data.schoolLogoPrintUrl || '',
      siteDescription: data.siteDescription || '',
      submissionGuidelines: data.submissionGuidelines || defaultSubmissionGuidelines.value,
      icpNumber: data.icpNumber || '',
      gonganNumber: data.gonganNumber || '',
      showBeianIcon: !!data.showBeianIcon,
      enableCollaborativeSubmission: data.enableCollaborativeSubmission !== false,
      enableSubmissionRemarks: !!data.enableSubmissionRemarks,
      enableReplayRequests: !!data.enableReplayRequests,
      songQuotaEnabled: !!data.songQuotaEnabled,
      songQuotaPeriodType: data.songQuotaPeriodType || 'DAILY',
      songQuotaPeriodAmount: data.songQuotaPeriodAmount ?? 5,
      adminSongQuotaExempt: data.adminSongQuotaExempt !== false,
      blockOnSongQuotaInsufficient: data.blockOnSongQuotaInsufficient !== false,
      legacyCardConversionEnabled: !!data.legacyCardConversionEnabled,
      showBlacklistKeywords: !!data.showBlacklistKeywords,
      hideStudentInfo: data.hideStudentInfo ?? true,
      forcePasswordChangeOnFirstLogin: data.forcePasswordChangeOnFirstLogin === true,
      telemetryEnabled: !!data.telemetryEnabled,
      captchaEnabled: !!data.captchaEnabled,
      captchaProvider: data.captchaProvider || 'graphic',
      turnstileSiteKey: data.turnstileSiteKey || '',
      turnstileSecretKey: undefined,
      captchaMaxFailures: data.captchaMaxFailures ?? 3,
      allowOAuthRegistration: !!data.allowOAuthRegistration,
      oauthRedirectUri: data.oauthRedirectUri || '',
      oauthStateSecret: data.oauthStateSecret || '',
      githubOAuthEnabled: !!data.githubOAuthEnabled,
      githubClientId: data.githubClientId || '',
      githubClientSecret: data.githubClientSecret || '',
      casdoorOAuthEnabled: !!data.casdoorOAuthEnabled,
      casdoorServerUrl: data.casdoorServerUrl || '',
      casdoorClientId: data.casdoorClientId || '',
      casdoorClientSecret: data.casdoorClientSecret || '',
      casdoorOrganizationName: data.casdoorOrganizationName || '',
      googleOAuthEnabled: !!data.googleOAuthEnabled,
      googleClientId: data.googleClientId || '',
      googleClientSecret: data.googleClientSecret || '',
      aggregateOAuthEnabled: !!data.aggregateOAuthEnabled,
      aggregateOAuthAppId: data.aggregateOAuthAppId || '',
      aggregateOAuthAppKey: data.aggregateOAuthAppKey || '',
      aggregateOAuthLoginType: getAggregateOAuthLoginTypesOrDefault(data.aggregateOAuthLoginType),
      aggregateOAuthEndpoint: data.aggregateOAuthEndpoint || 'https://a.idcfx.net/connect.php',
      customOAuthEnabled: !!data.customOAuthEnabled,
      customOAuthDisplayName: data.customOAuthDisplayName || '',
      customOAuthAuthorizeUrl: data.customOAuthAuthorizeUrl || '',
      customOAuthTokenUrl: data.customOAuthTokenUrl || '',
      customOAuthUserInfoUrl: data.customOAuthUserInfoUrl || '',
      customOAuthScope: data.customOAuthScope || '',
      customOAuthClientId: data.customOAuthClientId || '',
      customOAuthClientSecret: data.customOAuthClientSecret || '',
      customOAuthUserIdField: data.customOAuthUserIdField || '',
      customOAuthUsernameField: data.customOAuthUsernameField || '',
      customOAuthNameField: data.customOAuthNameField || '',
      customOAuthEmailField: data.customOAuthEmailField || '',
      customOAuthAvatarField: data.customOAuthAvatarField || ''
    }

    originalData.value = JSON.parse(JSON.stringify(formData.value))
  } catch (error) {
    console.error('Failed to load site config:', error)
    showNotification(locale.value?.loadFailed || '系统设置加载失败', 'error')
  } finally {
    loading.value = false
  }
}

// 保存配置
const saveConfig = async () => {
  try {
    saving.value = true
    const configToSave = {
      ...formData.value,
      siteTitle: (formData.value.siteTitle || '').trim() || locale.value?.defaultSiteTitle || 'VoiceHub',
      siteLogoUrl: (formData.value.siteLogoUrl || '').trim() || '/favicon.ico',
      submissionGuidelines:
        (formData.value.submissionGuidelines || '').trim() || defaultSubmissionGuidelines.value
    }

    const response = await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(configToSave)
    })

    if (!response.ok) {
      const error = new Error(locale.value?.saveFailed || '系统设置保存失败')
      try {
        error.data = await response.json()
      } catch {
        error.data = null
      }
      throw error
    }

    saveSuccess.value = true
    formData.value = { ...configToSave }
    originalData.value = JSON.parse(JSON.stringify(formData.value))
    localStorage.setItem('voicehub.telemetryEnabled', configToSave.telemetryEnabled ? 'true' : 'false')
    // 刷新前端模块级缓存，避免首页等页面继续使用旧配置
    await refreshSiteConfig()
    showNotification(locale.value?.saveSuccess || '系统设置已保存', 'success')

    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch (error) {
    console.error('Failed to save site config:', error)
    showNotification(
      error?.data
        ? localizeServerError(error)
        : getLocalizedServerMessage(error?.message || locale.value?.saveFailedRetry || '系统设置保存失败，请稍后重试'),
      'error'
    )
  } finally {
    saving.value = false
  }
}

// 重置表单
const resetForm = () => {
  formData.value = JSON.parse(JSON.stringify(originalData.value))
}

onMounted(loadConfig)
</script>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}
</style>
