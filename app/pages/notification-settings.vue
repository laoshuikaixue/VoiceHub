<template>
  <div class="min-h-screen bg-bg-primary text-text-primary pb-24">
    <!-- 顶部导航栏 -->
    <div
      class="sticky top-0 z-30 bg-bg-primary-80 backdrop-blur-xl border-b border-border-secondary-50 px-4 py-4 mb-8"
    >
      <div class="max-w-[1000px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="p-2 hover:bg-bg-secondary rounded-xl transition-all text-text-tertiary hover:text-text-primary"
            @click="goBack"
          >
            <ArrowLeft :size="20" />
          </button>
          <div>
            <h1 class="text-xl font-black text-text-primary tracking-tight">{{ locale.title }}</h1>
            <p class="text-[10px] text-text-tertiary font-medium uppercase tracking-widest mt-0.5">
              {{ locale.subtitle }}
            </p>
          </div>
        </div>

        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-6 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl shadow-lg shadow-[var(--primary-glow)] transition-all active:scale-95 disabled:opacity-50"
          @click="saveSettings"
        >
          <template v-if="saving"> <Loader2 :size="14" class="animate-spin" /> {{ locale.saving }} </template>
          <template v-else> <Save :size="14" /> {{ locale.saveSettings }} </template>
        </button>
      </div>
    </div>

    <div class="max-w-[1000px] mx-auto px-4">
      <div v-if="loading" class="flex flex-col items-center justify-center py-32">
        <Loader2 :size="32" class="text-primary animate-spin mb-4" />
        <p class="text-text-tertiary text-sm font-medium">{{ locale.loading }}</p>
      </div>

      <div v-else class="space-y-8">
        <!-- 站内通知设置 -->
        <section :class="sectionClass">
          <div class="flex items-center gap-3 border-b border-border-secondary-50 pb-5 mb-6">
            <div class="p-2.5 bg-primary-10 rounded-xl">
              <Bell :size="20" class="text-primary" />
            </div>
            <div>
              <h2 class="text-base font-black text-text-primary">{{ locale.inAppTitle }}</h2>
              <p class="text-xs text-text-tertiary mt-0.5">{{ locale.inAppDesc }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 歌曲被选中消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-text-primary">{{ locale.songSelectedTitle }}</h3>
                <p class="text-[11px] text-text-tertiary mt-1">{{ locale.songSelectedDesc }}</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songSelectedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                >
              </div>
            </div>

            <!-- 歌曲已播放消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-text-primary">{{ locale.songPlayedTitle }}</h3>
                <p class="text-[11px] text-text-tertiary mt-1">{{ locale.songPlayedDesc }}</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songPlayedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                >
              </div>
            </div>

            <!-- 歌曲获得投票消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-text-primary">{{ locale.songVotedTitle }}</h3>
                <p class="text-[11px] text-text-tertiary mt-1">{{ locale.songVotedDesc }}</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songVotedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                >
              </div>
            </div>

            <!-- 系统通知 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-text-primary">{{ locale.systemTitle }}</h3>
                <p class="text-[11px] text-text-tertiary mt-1">{{ locale.systemDesc }}</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.systemNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-border-secondary bg-bg-secondary cursor-pointer"
                >
              </div>
            </div>

            <!-- 投票阈值设置 -->
            <div :class="[itemClass, 'md:col-span-1']">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-text-primary">{{ locale.voteThresholdTitle }}</h3>
                <p class="text-[11px] text-text-tertiary mt-1">{{ locale.voteThresholdDesc }}</p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="localSettings.songVotedThreshold"
                  type="number"
                  max="100"
                  min="1"
                  class="w-16 bg-bg-primary border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-primary-30"
                >
                <span class="text-[10px] font-black text-text-disabled uppercase">{{ locale.voteUnit }}</span>
              </div>
            </div>

            <!-- 通知刷新间隔 -->
            <div :class="[itemClass, 'md:col-span-1']">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-text-primary">{{ locale.refreshTitle }}</h3>
                <p class="text-[11px] text-text-tertiary mt-1">{{ locale.refreshDesc }}</p>
              </div>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="localSettings.refreshInterval"
                  type="range"
                  max="300"
                  min="30"
                  step="30"
                  class="w-24 h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer"
                >
                <span class="text-[11px] font-bold text-primary min-w-[40px] text-right"
                  >{{ localSettings.refreshInterval }}s</span
                >
              </div>
            </div>
          </div>
        </section>

        <!-- 社交账号绑定 -->
        <section :class="sectionClass">
          <div class="flex items-center gap-3 border-b border-border-secondary-50 pb-5 mb-6">
            <div class="p-2.5 bg-info-10 rounded-xl">
              <Link :size="20" class="text-info" />
            </div>
            <div>
              <h2 class="text-base font-black text-text-primary">{{ locale.socialTitle }}</h2>
              <p class="text-xs text-text-tertiary mt-0.5">{{ locale.socialDesc }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- 邮箱绑定 -->
            <div v-if="smtpEnabled" :class="cardClass">
              <div class="flex items-center gap-3 mb-4">
                <div class="p-2 bg-bg-primary rounded-lg border border-border-secondary">
                  <Mail :size="16" class="text-text-tertiary" />
                </div>
                <h3 class="text-sm font-bold text-text-primary">{{ locale.emailNotifyTitle }}</h3>
              </div>

              <div class="space-y-4">
                <div v-if="userEmail" class="p-3 bg-bg-primary-50 border border-border-secondary rounded-xl">
                  <div class="flex items-center justify-between">
                    <div>
                      <p
                        class="text-[10px] text-text-tertiary font-black uppercase tracking-widest mb-1"
                      >
                        {{ locale.currentEmail }}
                      </p>
                      <p class="text-sm font-medium text-text-primary">{{ userEmail }}</p>
                    </div>
                    <div
                      :class="[
                        'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                        emailVerified
                          ? 'bg-success-10 text-success'
                          : 'bg-warning-10 text-warning'
                      ]"
                    >
                      {{ emailVerified ? locale.verified : locale.pendingVerify }}
                    </div>
                  </div>
                </div>

                <!-- 未绑定状态 -->
                <div v-if="!userEmail" class="space-y-3">
                  <p class="text-xs text-text-tertiary">{{ locale.emailUnboundDesc }}</p>
                  <div class="flex flex-col sm:flex-row gap-2">
                    <input
                      v-model="newEmail"
                      :disabled="bindingEmail"
                      type="email"
                      :placeholder="locale.emailPlaceholder"
                      class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary-30 w-full sm:w-auto"
                    >
                    <button
                      :disabled="!newEmail || bindingEmail"
                      class="px-4 py-2 bg-bg-tertiary hover:bg-bg-quaternary text-text-primary text-xs font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                      @click="bindEmail"
                    >
                      {{ bindingEmail ? locale.pleaseWait : locale.bindNow }}
                    </button>
                  </div>
                </div>

                <!-- 待验证状态 -->
                <div v-else-if="!emailVerified" class="space-y-4 pt-2">
                  <div
                    class="p-3 bg-primary-5 border border-primary-10 rounded-xl flex items-start gap-3"
                  >
                    <AlertCircle :size="14" class="text-primary shrink-0 mt-0.5" />
                    <p class="text-[11px] text-text-tertiary leading-relaxed">
                      {{ locale.emailCodeSentTip }}
                    </p>
                  </div>

                  <div class="space-y-3">
                    <input
                      v-model="emailCode"
                      type="text"
                      maxlength="6"
                      :placeholder="locale.emailCodePlaceholder"
                      :class="[
                        'w-full bg-bg-primary border rounded-xl px-4 py-3 text-lg font-black tracking-[0.5em] text-center focus:outline-none transition-all',
                        emailCodeError
                          ? 'border-error shadow-[0_0_15px_var(--auth-error-input-shadow)]'
                          : 'border-border-secondary focus:border-primary-30'
                      ]"
                      @input="handleEmailCodeInput"
                      @keydown="handleEmailCodeKeydown"
                    >
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        :disabled="bindingEmail || emailCode.length !== 6"
                        class="px-4 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50"
                        @click="verifyEmailCode"
                      >
                        {{ bindingEmail ? locale.verifying : locale.confirmVerify }}
                      </button>
                      <button
                        :disabled="resendingEmail"
                        class="px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                        @click="resendVerificationEmail"
                      >
                        {{ resendingEmail ? locale.sending : locale.resend }}
                      </button>
                    </div>
                    <button
                      class="w-full py-2 text-text-disabled hover:text-text-tertiary text-[10px] font-black uppercase tracking-widest transition-all"
                      @click="changeEmail"
                    >
                      {{ locale.changeEmailAddress }}
                    </button>
                  </div>
                </div>

                <!-- 已验证状态 -->
                <div v-else class="flex gap-2 pt-2">
                  <button
                    class="flex-1 py-2.5 bg-bg-secondary border border-border-secondary hover:border-border-tertiary text-text-tertiary text-xs font-bold rounded-xl transition-all"
                    @click="changeEmail"
                  >
                    {{ locale.changeEmail }}
                  </button>
                  <button
                    :disabled="unbindingEmail"
                    class="flex-1 py-2.5 bg-error-10 border border-error-20 hover:bg-error-20 text-error text-xs font-black rounded-xl transition-all"
                    @click="unbindEmail"
                  >
                    {{ unbindingEmail ? locale.unbinding : locale.unbindEmail }}
                  </button>
                </div>
              </div>
            </div>

            <!-- MeoW 账号绑定 -->
            <div :class="[cardClass, 'border-primary-20 bg-primary-5']">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-primary-10 rounded-lg border border-primary-20">
                    <Smartphone :size="16" class="text-primary" />
                  </div>
                  <h3 class="text-sm font-bold text-text-primary">{{ locale.meowPushTitle }}</h3>
                </div>
              </div>

              <div class="space-y-4">
                <div
                  v-if="localSettings.meowUserId"
                  class="p-3 bg-primary-10 border border-primary-20 rounded-xl"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <p
                        class="text-[10px] text-primary-60 font-black uppercase tracking-widest mb-1"
                      >
                        {{ locale.currentBoundId }}
                      </p>
                      <p class="text-sm font-black text-primary tracking-tight">
                        {{ localSettings.meowUserId }}
                      </p>
                    </div>
                    <div
                      class="px-2 py-0.5 bg-primary text-text-primary rounded-full text-[10px] font-black uppercase tracking-wider"
                    >
                      {{ locale.connected }}
                    </div>
                  </div>
                </div>

                <!-- 未绑定状态 -->
                <div v-if="!localSettings.meowUserId" class="space-y-3">
                  <p class="text-xs text-text-tertiary">
                    {{ locale.meowDesc }}
                  </p>

                  <!-- 第一步：输入用户ID -->
                  <div v-if="!verificationSent" class="flex flex-col sm:flex-row gap-2">
                    <input
                      v-model="meowUserId"
                      :disabled="binding"
                      type="text"
                      :placeholder="locale.meowIdPlaceholder"
                      class="flex-1 bg-bg-primary border border-border-secondary rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary-30 w-full sm:w-auto"
                    >
                    <button
                      :disabled="!meowUserId || binding"
                      class="px-4 py-2 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-[var(--primary-glow)] whitespace-nowrap"
                      @click="sendVerificationCode"
                    >
                      {{ binding ? locale.sending : locale.sendCode }}
                    </button>
                  </div>

                  <!-- 第二步：输入验证码 -->
                  <div v-else class="space-y-4">
                    <div
                      class="p-3 bg-primary-5 border border-primary-10 rounded-xl flex items-start gap-3"
                    >
                      <AlertCircle :size="14" class="text-primary shrink-0 mt-0.5" />
                      <p class="text-[11px] text-text-tertiary leading-relaxed">
                        {{ locale.meowCodeSentPrefix }}
                        <span class="font-bold text-text-primary">{{ meowUserId }}</span
                        >{{ locale.meowCodeSentSuffix }}
                      </p>
                    </div>

                    <div class="space-y-3">
                      <input
                        v-model="verificationCode"
                        type="text"
                        maxlength="6"
                        :placeholder="locale.codePlaceholder"
                        :class="[
                          'w-full bg-bg-primary border rounded-xl px-4 py-3 text-lg font-black tracking-[0.5em] text-center focus:outline-none transition-all',
                          verificationCodeError
                            ? 'border-error shadow-[0_0_15px_var(--auth-error-input-shadow)]'
                            : 'border-border-secondary focus:border-primary-30'
                        ]"
                        @input="handleVerificationCodeInput"
                        @keydown="handleVerificationCodeKeydown"
                      >
                      <div class="grid grid-cols-2 gap-2">
                        <button
                          :disabled="binding || verificationCode.length !== 6"
                          class="px-4 py-2.5 bg-primary-hover hover:bg-primary text-text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50"
                          @click="verifyAndBind"
                        >
                          {{ binding ? locale.verifying : locale.confirmBind }}
                        </button>
                        <button
                          :disabled="binding"
                          class="px-4 py-2.5 bg-bg-tertiary hover:bg-bg-quaternary text-text-secondary text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                          @click="cancelVerification"
                        >
                          {{ locale.cancel }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 已绑定状态 -->
                <div v-else class="pt-2">
                  <button
                    class="w-full py-2.5 bg-error-10 border border-error-20 hover:bg-error-20 text-error text-xs font-black rounded-xl transition-all"
                    @click="showUnbindConfirm"
                  >
                    {{ locale.unbindMeow }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Bell, ArrowLeft, Save, Loader2 } from '@lucide/vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useToast } from '~/composables/useToast'
import { useLocale } from '~/utils/locale'

const { siteTitle, initSiteConfig } = useSiteConfig()
const { showToast } = useToast()
const { pages } = useLocale()
const locale = computed(() => pages.value?.notificationSettings || {})

// 样式类常量
const sectionClass = 'bg-bg-secondary-40 border border-border-secondary rounded-3xl p-6 md:p-8 shadow-2xl'
const cardClass =
  'bg-bg-primary-40 border border-border-secondary-50 rounded-2xl p-5 transition-all hover:border-border-tertiary-50'
const itemClass =
  'flex items-center justify-between p-4 bg-bg-primary-30 border border-border-secondary rounded-2xl hover:bg-bg-secondary-50 transition-all group'

// 页面状态
const loading = ref(true)
const saving = ref(false)

// 通知设置
const localSettings = ref({
  songSelectedNotify: true,
  songPlayedNotify: true,
  songVotedNotify: true,
  songVotedThreshold: 5,
  systemNotify: true,
  refreshInterval: 60
})

// 通知显示函数
const showNotification = (message, type = 'info') => {
  showToast(message, type)
}

// 返回主页
const goBack = () => {
  navigateTo('/')
}

// 页面初始化
onMounted(async () => {
  await initSiteConfig()

  // 设置页面标题
  if (typeof document !== 'undefined' && siteTitle.value) {
    document.title = `${locale.value.title} | ${siteTitle.value}`
  }

  await loadSettings()
})

// 加载设置
const loadSettings = async () => {
  try {
    loading.value = true
    const response = await $fetch('/api/notifications/settings')

    if (response.success) {
      localSettings.value = {
        songSelectedNotify: response.data.songSelectedNotify || false,
        songPlayedNotify: response.data.songPlayedNotify || false,
        songVotedNotify: response.data.songVotedNotify || false,
        songVotedThreshold: response.data.songVotedThreshold || 5,
        systemNotify: response.data.systemNotify || true,
        refreshInterval: response.data.refreshInterval || 60
      }
    }
  } catch (err) {
    console.error(locale.value.loadFailedLog, err)
    showNotification(locale.value.loadFailed, 'error')
  } finally {
    loading.value = false
  }
}

// 保存设置
const saveSettings = async () => {
  try {
    saving.value = true
    const response = await $fetch('/api/notifications/settings', {
      method: 'POST',
      body: localSettings.value
    })
    if (response.success) {
      showNotification(locale.value.saveSuccess, 'success')
    } else {
      showNotification(response.message || locale.value.saveFailed, 'error')
    }
  } catch (err) {
    showNotification(err.data?.message || locale.value.saveFailed, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
</style>
