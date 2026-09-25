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

const emit = defineEmits(['update:modelValue', 'verified', 'failed'])

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
  document.head.appendChild(script)
})

onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
  captchaInstance = null
})
</script>

<style scoped>
.esa-captcha-widget {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  margin-bottom: 8px;
}
</style>
