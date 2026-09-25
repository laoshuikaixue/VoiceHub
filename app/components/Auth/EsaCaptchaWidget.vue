<template>
  <div class="esa-captcha-widget">
    <!-- SDK 只识别 #id 选择器，且要求元素在初始化时已存在于页面中 -->
    <div id="esa-captcha-element" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useLocale } from '~/utils/locale'
import { getEsaCaptchaServers } from '~/utils/esaCaptcha'

const props = defineProps({
  // 触发验证码弹窗的按钮（必须是 #id 选择器）
  buttonSelector: {
    type: String,
    required: true
  },
  // 当前接口与域名对应的场景 ID，由调用方解析后传入
  sceneId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'verified', 'failed', 'load-error'])

const { siteConfig } = useSiteConfig()
const { currentLocale } = useLocale()

const SCRIPT_ID = 'aliyun-captcha-script'
const SCRIPT_SRC = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js'
const MAX_RETRIES = 50 // 每次 100ms，共 5 秒

let captchaInstance = null
let retryCount = 0
let retryTimer = null
const initialized = ref(false)

const resolveLanguage = () => (currentLocale.value === 'en-US' ? 'en' : 'cn')

const initCaptcha = () => {
  if (initialized.value) return

  const sceneId = props.sceneId
  const prefix = siteConfig.value.esaCaptchaPrefix
  if (!sceneId || !prefix) return

  if (typeof window.initAliyunCaptcha !== 'function') {
    if (retryCount < MAX_RETRIES) {
      retryCount++
      retryTimer = setTimeout(initCaptcha, 100)
    } else {
      console.error('ESA 验证码脚本加载超时')
      emit('load-error')
    }
    return
  }

  initialized.value = true
  window.initAliyunCaptcha({
    SceneId: sceneId,
    mode: 'popup',
    element: '#esa-captcha-element',
    button: props.buttonSelector,
    language: resolveLanguage(),
    // 验证成功：把验签参数交给调用方，由登录/注册请求随请求头带给 ESA 边缘验签
    success: (captchaVerifyParam) => {
      emit('update:modelValue', captchaVerifyParam)
      emit('verified', captchaVerifyParam)
    },
    fail: (result) => {
      console.error('ESA 验证码验证失败:', result)
      emit('update:modelValue', '')
      emit('failed', result)
    },
    getInstance: (instance) => {
      captchaInstance = instance
    },
    // SDK 内置的初始化错误回调，覆盖初始化接口请求与资源加载失败/超时
    onError: (errorInfo) => {
      console.error('ESA 验证码初始化失败:', errorInfo?.code, errorInfo?.msg)
      emit('load-error')
    },
    server: getEsaCaptchaServers(siteConfig.value.esaCaptchaRegion),
    slideStyle: {
      width: 360,
      height: 40
    }
  })
}

// 重新验证：清空旧的验签参数并刷新验证码（参数一次性有效，不可复用）
const reset = () => {
  emit('update:modelValue', '')
  captchaInstance?.refresh?.()
}

defineExpose({ reset })

onMounted(() => {
  // 必须在脚本加载前定义全局配置，SDK 从中读取 region 与身份标
  window.AliyunCaptchaConfig = {
    region: siteConfig.value.esaCaptchaRegion || 'cn',
    prefix: siteConfig.value.esaCaptchaPrefix || ''
  }

  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    initCaptcha()
    return
  }

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.src = SCRIPT_SRC
  script.async = true
  script.onload = () => initCaptcha()
  script.onerror = () => emit('load-error')
  document.head.appendChild(script)
})

onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
  // 多次调用 initAliyunCaptcha 会在触发按钮上重复注册事件、重复添加验证码元素，
  // 而提交按钮由父组件持有、不随本组件重挂载而重建，故卸载时必须销毁实例；
  // destroyCaptcha 会连带移除元素，可能与 Vue 的卸载竞争，失败时忽略即可
  try {
    captchaInstance?.destroyCaptcha?.()
  } catch (e) {
    console.warn('ESA 验证码实例销毁失败:', e)
  }
  captchaInstance = null
})
</script>

<style scoped>
/* 弹窗模式下本元素仅作 SDK 挂载点，验证内容渲染在 body 的弹层里，因此不预留外边距，避免登录表单出现空白 */
.esa-captcha-widget {
  display: flex;
  justify-content: center;
}
</style>
