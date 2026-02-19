<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 pb-24">
    <!-- 顶部导航栏 -->
    <div
      class="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900/50 px-4 py-4 mb-8"
    >
      <div class="max-w-[1000px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="p-2 hover:bg-zinc-900 rounded-xl transition-all text-zinc-400 hover:text-zinc-100"
            @click="goBack"
          >
            <ArrowLeft :size="20" />
          </button>
          <div>
            <h1 class="text-xl font-black text-zinc-100 tracking-tight">消息设置</h1>
            <p class="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">
              Notification Settings
            </p>
          </div>
        </div>

        <button
          :disabled="loading || saving"
          class="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
          @click="saveSettings"
        >
          <template v-if="saving"> <Loader2 :size="14" class="animate-spin" /> 保存中... </template>
          <template v-else> <Save :size="14" /> 保存设置 </template>
        </button>
      </div>
    </div>

    <div class="max-w-[1000px] mx-auto px-4">
      <div v-if="loading" class="flex flex-col items-center justify-center py-32">
        <Loader2 :size="32" class="text-blue-500 animate-spin mb-4" />
        <p class="text-zinc-500 text-sm font-medium">加载设置中...</p>
      </div>

      <div v-else class="space-y-8">
        <!-- 站内通知设置 -->
        <section :class="sectionClass">
          <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
            <div class="p-2.5 bg-blue-500/10 rounded-xl">
              <Bell :size="20" class="text-blue-500" />
            </div>
            <div>
              <h2 class="text-base font-black text-zinc-100">站内消息设置</h2>
              <p class="text-xs text-zinc-500 mt-0.5">配置您希望在系统内接收的消息类型</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 歌曲被选中消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">歌曲被选中消息</h3>
                <p class="text-[11px] text-zinc-500 mt-1">当您投稿的歌曲被选中播放时通知您</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songSelectedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
            </div>

            <!-- 歌曲已播放消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">歌曲已播放消息</h3>
                <p class="text-[11px] text-zinc-500 mt-1">当您投稿的歌曲播放完成时通知您</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songPlayedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
            </div>

            <!-- 歌曲获得投票消息 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">歌曲获得投票消息</h3>
                <p class="text-[11px] text-zinc-500 mt-1">当您投稿的歌曲获得投票时通知您</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.songVotedNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
            </div>

            <!-- 系统通知 -->
            <div :class="itemClass">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">系统通知</h3>
                <p class="text-[11px] text-zinc-500 mt-1">接收系统重要通知和公告</p>
              </div>
              <div class="shrink-0">
                <input
                  v-model="localSettings.systemNotify"
                  type="checkbox"
                  class="w-5 h-5 rounded border-zinc-800 bg-zinc-900 accent-blue-600 cursor-pointer"
                >
              </div>
            </div>

            <!-- 投票阈值设置 -->
            <div :class="[itemClass, 'md:col-span-1']">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">投票通知阈值</h3>
                <p class="text-[11px] text-zinc-500 mt-1">当投票数达到此阈值时才发送通知</p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="localSettings.songVotedThreshold"
                  type="number"
                  max="100"
                  min="1"
                  class="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-blue-500/30"
                >
                <span class="text-[10px] font-black text-zinc-600 uppercase">票</span>
              </div>
            </div>

            <!-- 通知刷新间隔 -->
            <div :class="[itemClass, 'md:col-span-1']">
              <div class="flex-1">
                <h3 class="text-sm font-bold text-zinc-200">通知刷新间隔</h3>
                <p class="text-[11px] text-zinc-500 mt-1">设置系统自动检查新通知的时间间隔</p>
              </div>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="localSettings.refreshInterval"
                  type="range"
                  max="300"
                  min="30"
                  step="30"
                  class="w-24 h-1.5 bg-zinc-800 rounded-full appearance-none accent-blue-600 cursor-pointer"
                >
                <span class="text-[11px] font-bold text-blue-500 min-w-[40px] text-right"
                  >{{ localSettings.refreshInterval }}s</span
                >
              </div>
            </div>
          </div>
        </section>

        <!-- 社交账号绑定 -->
        <section :class="sectionClass">
          <div class="flex items-center gap-3 border-b border-zinc-800/50 pb-5 mb-6">
            <div class="p-2.5 bg-purple-500/10 rounded-xl">
              <Link :size="20" class="text-purple-500" />
            </div>
            <div>
              <h2 class="text-base font-black text-zinc-100">社交账号绑定</h2>
              <p class="text-xs text-zinc-500 mt-0.5">绑定您的社交账号以接收实时推送通知</p>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- 邮箱绑定 -->
            <div v-if="smtpEnabled" :class="cardClass">
              <div class="flex items-center gap-3 mb-4">
                <div class="p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                  <Mail :size="16" class="text-zinc-400" />
                </div>
                <h3 class="text-sm font-bold text-zinc-200">邮箱消息通知</h3>
              </div>

              <div class="space-y-4">
                <div v-if="userEmail" class="p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                  <div class="flex items-center justify-between">
                    <div>
                      <p
                        class="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1"
                      >
                        当前绑定邮箱
                      </p>
                      <p class="text-sm font-medium text-zinc-200">{{ userEmail }}</p>
                    </div>
                    <div
                      :class="[
                        'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                        emailVerified
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-amber-500/10 text-amber-500'
                      ]"
                    >
                      {{ emailVerified ? '已验证' : '待验证' }}
                    </div>
                  </div>
                </div>

                <!-- 未绑定状态 -->
                <div v-if="!userEmail" class="space-y-3">
                  <p class="text-xs text-zinc-500">绑定邮箱后，您可以接收到实时的邮件通知提醒。</p>
                  <div class="flex flex-col sm:flex-row gap-2">
                    <input
                      v-model="newEmail"
                      :disabled="bindingEmail"
                      type="email"
                      placeholder="请输入邮箱地址"
                      class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/30 w-full sm:w-auto"
                    >
                    <button
                      :disabled="!newEmail || bindingEmail"
                      class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                      @click="bindEmail"
                    >
                      {{ bindingEmail ? '请稍候...' : '立即绑定' }}
                    </button>
                  </div>
                </div>

                <!-- 待验证状态 -->
                <div v-else-if="!emailVerified" class="space-y-4 pt-2">
                  <div
                    class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3"
                  >
                    <AlertCircle :size="14" class="text-blue-500 shrink-0 mt-0.5" />
                    <p class="text-[11px] text-zinc-500 leading-relaxed">
                      验证码已发送至您的邮箱，请在 5 分钟内完成验证。若未收到邮件，请检查垃圾箱。
                    </p>
                  </div>

                  <div class="space-y-3">
                    <input
                      v-model="emailCode"
                      type="text"
                      maxlength="6"
                      placeholder="输入 6 位数字验证码"
                      :class="[
                        'w-full bg-zinc-950 border rounded-xl px-4 py-3 text-lg font-black tracking-[0.5em] text-center focus:outline-none transition-all',
                        emailCodeError
                          ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                          : 'border-zinc-800 focus:border-blue-500/30'
                      ]"
                      @input="handleEmailCodeInput"
                      @keydown="handleEmailCodeKeydown"
                    >
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        :disabled="bindingEmail || emailCode.length !== 6"
                        class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
                        @click="verifyEmailCode"
                      >
                        {{ bindingEmail ? '验证中...' : '确认验证' }}
                      </button>
                      <button
                        :disabled="resendingEmail"
                        class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                        @click="resendVerificationEmail"
                      >
                        {{ resendingEmail ? '发送中...' : '重新发送' }}
                      </button>
                    </div>
                    <button
                      class="w-full py-2 text-zinc-600 hover:text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all"
                      @click="changeEmail"
                    >
                      更换邮箱地址
                    </button>
                  </div>
                </div>

                <!-- 已验证状态 -->
                <div v-else class="flex gap-2 pt-2">
                  <button
                    class="flex-1 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-xs font-bold rounded-xl transition-all"
                    @click="changeEmail"
                  >
                    更换邮箱
                  </button>
                  <button
                    :disabled="unbindingEmail"
                    class="flex-1 py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all"
                    @click="unbindEmail"
                  >
                    {{ unbindingEmail ? '正在解绑...' : '解绑邮箱' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- MeoW 账号绑定 -->
            <div :class="[cardClass, 'border-blue-500/20 bg-blue-500/[0.02]']">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Smartphone :size="16" class="text-blue-500" />
                  </div>
                  <h3 class="text-sm font-bold text-zinc-200">MeoW App 推送</h3>
                </div>
              </div>

              <div class="space-y-4">
                <div
                  v-if="localSettings.meowUserId"
                  class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <p
                        class="text-[10px] text-blue-500/60 font-black uppercase tracking-widest mb-1"
                      >
                        当前绑定 ID
                      </p>
                      <p class="text-sm font-black text-blue-500 tracking-tight">
                        {{ localSettings.meowUserId }}
                      </p>
                    </div>
                    <div
                      class="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider"
                    >
                      已连接
                    </div>
                  </div>
                </div>

                <!-- 未绑定状态 -->
                <div v-if="!localSettings.meowUserId" class="space-y-3">
                  <p class="text-xs text-zinc-500">
                    通过 MeoW 客户端接收更及时的系统通知和歌曲状态变更提醒。
                  </p>

                  <!-- 第一步：输入用户ID -->
                  <div v-if="!verificationSent" class="flex flex-col sm:flex-row gap-2">
                    <input
                      v-model="meowUserId"
                      :disabled="binding"
                      type="text"
                      placeholder="请输入 MeoW 用户 ID"
                      class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/30 w-full sm:w-auto"
                    >
                    <button
                      :disabled="!meowUserId || binding"
                      class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20 whitespace-nowrap"
                      @click="sendVerificationCode"
                    >
                      {{ binding ? '发送中...' : '发送验证码' }}
                    </button>
                  </div>

                  <!-- 第二步：输入验证码 -->
                  <div v-else class="space-y-4">
                    <div
                      class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3"
                    >
                      <AlertCircle :size="14" class="text-blue-500 shrink-0 mt-0.5" />
                      <p class="text-[11px] text-zinc-500 leading-relaxed">
                        验证码已发送至 MeoW ID:
                        <span class="font-bold text-zinc-200">{{ meowUserId }}</span
                        >，请在客户端查收。
                      </p>
                    </div>

                    <div class="space-y-3">
                      <input
                        v-model="verificationCode"
                        type="text"
                        maxlength="6"
                        placeholder="输入 6 位验证码"
                        :class="[
                          'w-full bg-zinc-950 border rounded-xl px-4 py-3 text-lg font-black tracking-[0.5em] text-center focus:outline-none transition-all',
                          verificationCodeError
                            ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                            : 'border-zinc-800 focus:border-blue-500/30'
                        ]"
                        @input="handleVerificationCodeInput"
                        @keydown="handleVerificationCodeKeydown"
                      >
                      <div class="grid grid-cols-2 gap-2">
                        <button
                          :disabled="binding || verificationCode.length !== 6"
                          class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all disabled:opacity-50"
                          @click="verifyAndBind"
                        >
                          {{ binding ? '验证中...' : '确认绑定' }}
                        </button>
                        <button
                          :disabled="binding"
                          class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                          @click="cancelVerification"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 已绑定状态 -->
                <div v-else class="pt-2">
                  <button
                    class="w-full py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 text-xs font-black rounded-xl transition-all"
                    @click="showUnbindConfirm"
                  >
                    解除 MeoW 账号绑定
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:show="showConfirmDialog"
      :loading="confirmDialog.loading"
      :message="confirmDialog.message"
      :title="confirmDialog.title"
      :type="confirmDialog.type"
      @cancel="confirmDialog.onCancel"
      @confirm="confirmDialog.onConfirm"
    />
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import {
  Bell,
  Mail,
  Link,
  MessageSquare,
  Clock,
  ArrowLeft,
  Save,
  Shield,
  Trash2,
  User,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone
} from 'lucide-vue-next'
import ConfirmDialog from '~/components/UI/ConfirmDialog.vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useToast } from '~/composables/useToast'

const { siteTitle, smtpEnabled, initSiteConfig } = useSiteConfig()
const { showToast } = useToast()

// 样式类常量
const sectionClass = 'bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 md:p-8 shadow-2xl'
const cardClass =
  'bg-zinc-950/40 border border-zinc-800/50 rounded-2xl p-5 transition-all hover:border-zinc-700/50'
const itemClass =
  'flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-900 rounded-2xl hover:bg-zinc-900/50 transition-all group'

// 页面状态
const loading = ref(true)
const saving = ref(false)
const binding = ref(false)

// 通知设置
const localSettings = ref({
  songSelectedNotify: true,
  songPlayedNotify: true,
  songVotedNotify: true,
  songVotedThreshold: 5,
  systemNotify: true,
  refreshInterval: 60,
  meowUserId: ''
})

// MeoW 绑定相关
const meowUserId = ref('')
const verificationSent = ref(false)
const verificationCode = ref('')
const verificationCodeError = ref(false)

// 邮箱绑定相关
const userEmail = ref('')
const emailVerified = ref(false)
const newEmail = ref('')
const bindingEmail = ref(false)
const resendingEmail = ref(false)
const unbindingEmail = ref(false)
const emailCode = ref('')
const emailCodeError = ref(false)

// 确认对话框相关
const showConfirmDialog = ref(false)
const confirmDialog = ref({
  title: '',
  message: '',
  type: 'warning',
  loading: false,
  onConfirm: () => {},
  onCancel: () => {}
})

// 通知显示函数
const showNotification = (message, type = 'info') => {
  showToast(message, type)
}

// 返回主页
const goBack = () => {
  if (typeof window !== 'undefined') {
    window.history.back()
  }
}

// 页面初始化
onMounted(async () => {
  await initSiteConfig()

  // 设置页面标题
  if (typeof document !== 'undefined' && siteTitle.value) {
    document.title = `通知设置 | ${siteTitle.value}`
  }

  await loadSettings()
})

// 处理验证码输入
const handleVerificationCodeInput = (event) => {
  const value = event.target.value.replace(/[^0-9]/g, '')
  verificationCode.value = value
  if (verificationCodeError.value) {
    verificationCodeError.value = false
  }
}

// 处理验证码输入键盘事件
const handleVerificationCodeKeydown = (event) => {
  if (event.key === 'Enter' && verificationCode.value.length === 6) {
    verifyAndBind()
  }
}

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
        refreshInterval: response.data.refreshInterval || 60,
        meowUserId: response.data.meowUserId || ''
      }

      userEmail.value = response.data.userEmail || ''
      emailVerified.value = response.data.emailVerified || false
    }
  } catch (err) {
    console.error('加载设置失败:', err)
    showNotification('加载设置失败，请刷新页面重试', 'error')
  } finally {
    loading.value = false
  }
}

// 发送验证码
const sendVerificationCode = async () => {
  if (!meowUserId.value.trim()) {
    showNotification('请输入 MeoW 用户 ID', 'error')
    return
  }

  try {
    binding.value = true
    const response = await $fetch('/api/meow/bind', {
      method: 'POST',
      body: {
        action: 'send_verification',
        meowId: meowUserId.value.trim()
      }
    })

    if (response.success) {
      verificationSent.value = true
      showNotification('验证码已发送到您的 MeoW 账号', 'success')
    } else {
      showNotification(response.message || '发送验证码失败', 'error')
    }
  } catch (err) {
    showNotification(err.data?.message || '发送验证码失败', 'error')
  } finally {
    binding.value = false
  }
}

// 验证并绑定
const verifyAndBind = async () => {
  if (!verificationCode.value || verificationCode.value.length !== 6) {
    showNotification('请输入6位验证码', 'error')
    verificationCodeError.value = true
    return
  }

  try {
    binding.value = true
    const response = await $fetch('/api/meow/bind', {
      method: 'POST',
      body: {
        action: 'verify_and_bind',
        meowId: meowUserId.value.trim(),
        verificationCode: verificationCode.value
      }
    })

    if (response.success) {
      localSettings.value.meowUserId = meowUserId.value.trim()
      meowUserId.value = ''
      verificationCode.value = ''
      verificationSent.value = false
      showNotification('MeoW 账号绑定成功！', 'success')
    } else {
      showNotification(response.message || '验证失败', 'error')
      verificationCodeError.value = true
    }
  } catch (err) {
    showNotification(err.data?.message || '验证失败', 'error')
    verificationCodeError.value = true
  } finally {
    binding.value = false
  }
}

// 取消验证
const cancelVerification = () => {
  verificationSent.value = false
  verificationCode.value = ''
  meowUserId.value = ''
}

// 显示解绑确认对话框
const showUnbindConfirm = () => {
  confirmDialog.value = {
    title: '解绑 MeoW 账号',
    message: '确定要解绑 MeoW 账号吗？解绑后将无法接收推送通知。',
    type: 'danger',
    loading: false,
    onConfirm: performUnbind,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

// 执行解绑操作
const performUnbind = async () => {
  try {
    confirmDialog.value.loading = true
    const response = await $fetch('/api/meow/unbind', { method: 'POST' })

    if (response.success) {
      localSettings.value.meowUserId = ''
      showNotification('MeoW 账号已解绑', 'success')
      showConfirmDialog.value = false
    } else {
      showNotification(response.message || '解绑失败', 'error')
    }
  } catch (err) {
    showNotification(err.data?.message || '解绑失败', 'error')
  } finally {
    confirmDialog.value.loading = false
  }
}

// 邮箱绑定相关方法
const bindEmail = async () => {
  if (!newEmail.value) {
    showNotification('请输入邮箱地址', 'error')
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newEmail.value)) {
    showNotification('请输入有效的邮箱地址', 'error')
    return
  }

  bindingEmail.value = true
  try {
    const response = await $fetch('/api/user/email/bind', {
      method: 'POST',
      body: { email: newEmail.value }
    })

    if (response.success) {
      userEmail.value = newEmail.value
      emailVerified.value = false
      newEmail.value = ''
      showNotification('验证码已发送，请查收邮箱', 'success')
    } else {
      showNotification(response.message || '绑定失败', 'error')
    }
  } catch (err) {
    showNotification(err.data?.message || '绑定失败', 'error')
  } finally {
    bindingEmail.value = false
  }
}

const handleEmailCodeInput = (event) => {
  const value = event.target.value.replace(/[^0-9]/g, '')
  emailCode.value = value
  if (emailCodeError.value) emailCodeError.value = false
}

const handleEmailCodeKeydown = (event) => {
  if (event.key === 'Enter' && emailCode.value.length === 6) verifyEmailCode()
}

const verifyEmailCode = async () => {
  if (emailCode.value.length !== 6) {
    emailCodeError.value = true
    showNotification('请输入6位验证码', 'error')
    return
  }
  try {
    bindingEmail.value = true
    const response = await $fetch('/api/user/email/verify-code', {
      method: 'POST',
      body: { email: userEmail.value, code: emailCode.value }
    })
    if (response.success) {
      emailVerified.value = true
      emailCode.value = ''
      showNotification('邮箱验证成功', 'success')
    } else {
      emailCodeError.value = true
      showNotification(response.message || '验证失败', 'error')
    }
  } catch (err) {
    emailCodeError.value = true
    showNotification(err.data?.message || '验证失败', 'error')
  } finally {
    bindingEmail.value = false
  }
}

const changeEmail = () => {
  confirmDialog.value = {
    title: '更换邮箱',
    message: '更换邮箱将清除当前绑定的邮箱信息，需要重新验证新邮箱。确定要继续吗？',
    type: 'warning',
    loading: false,
    onConfirm: performChangeEmail,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const performChangeEmail = () => {
  userEmail.value = ''
  emailVerified.value = false
  newEmail.value = ''
  emailCode.value = ''
  emailCodeError.value = false
  showConfirmDialog.value = false
  showNotification('已清除邮箱信息', 'info')
}

const resendVerificationEmail = async () => {
  try {
    resendingEmail.value = true
    const response = await $fetch('/api/user/email/resend-verification', { method: 'POST' })
    if (response.success) {
      emailCode.value = ''
      emailCodeError.value = false
      showNotification('验证码已重新发送', 'success')
    } else {
      showNotification(response.message || '发送失败', 'error')
    }
  } catch (err) {
    showNotification(err.data?.message || '发送失败', 'error')
  } finally {
    resendingEmail.value = false
  }
}

const unbindEmail = async () => {
  confirmDialog.value = {
    title: '确认解绑邮箱',
    message: '解绑后将无法接收邮件通知，确定要继续吗？',
    type: 'warning',
    loading: false,
    onConfirm: performEmailUnbind,
    onCancel: () => {
      showConfirmDialog.value = false
    }
  }
  showConfirmDialog.value = true
}

const performEmailUnbind = async () => {
  try {
    confirmDialog.value.loading = true
    const response = await $fetch('/api/user/email/unbind', { method: 'POST' })
    if (response.success) {
      userEmail.value = ''
      emailVerified.value = false
      showNotification('邮箱已解绑', 'success')
      showConfirmDialog.value = false
    } else {
      showNotification(response.message || '解绑失败', 'error')
    }
  } catch (err) {
    showNotification(err.data?.message || '解绑失败', 'error')
  } finally {
    confirmDialog.value.loading = false
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
      showNotification('设置保存成功', 'success')
    } else {
      showNotification(response.message || '保存失败', 'error')
    }
  } catch (err) {
    showNotification(err.data?.message || '保存失败', 'error')
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
