<template>
  <Transition
    :mode="transitionMode"
    :name="transitionName"
    @enter="onEnter"
    @leave="onLeave"
    @before-enter="onBeforeEnter"
    @after-enter="onAfterEnter"
    @before-leave="onBeforeLeave"
    @after-leave="onAfterLeave"
  >
    <slot />
  </Transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// 过渡状态
const isTransitioning = ref(false)
const previousRoute = ref(null)

// 计算过渡名称
const transitionName = computed(() => {
  const currentPath = route.path
  const prevPath = previousRoute.value?.path

  // 首页到后台的过渡
  if (prevPath === '/' && currentPath === '/dashboard') {
    return 'slide-left'
  }

  // 后台到首页的过渡
  if (prevPath === '/dashboard' && currentPath === '/') {
    return 'slide-right'
  }

  // 登录相关页面使用淡入淡出
  if (currentPath.includes('/login') || currentPath.includes('/register')) {
    return 'fade'
  }

  // 其他页面使用默认过渡
  return 'page'
})

const transitionMode = computed(() => {
  // 滑动过渡不需要mode，其他使用out-in
  if (transitionName.value.includes('slide')) {
    return undefined
  }
  return 'out-in'
})

// 过渡事件处理
const onBeforeEnter = (el) => {
  isTransitioning.value = true
  el.style.position = transitionName.value.includes('slide') ? 'absolute' : 'relative'

  // 添加路由数据属性用于CSS选择器
  el.setAttribute('data-route', route.name || 'unknown')
}

const onEnter = (el, done) => {
  // 强制重排以确保动画生效
  void el.offsetHeight
  done()
}

const onAfterEnter = (el) => {
  isTransitioning.value = false
  el.style.position = 'relative'

  // 清理数据属性
  el.removeAttribute('data-route')
}

const onBeforeLeave = (el) => {
  isTransitioning.value = true
  el.style.position = transitionName.value.includes('slide') ? 'absolute' : 'relative'

  // 添加路由数据属性
  el.setAttribute('data-route', route.name || 'unknown')
}

const onLeave = (el, done) => {
  done()
}

const onAfterLeave = (el) => {
  isTransitioning.value = false
  el.style.position = 'relative'

  // 清理数据属性
  el.removeAttribute('data-route')
}

// 监听路由变化
router.beforeEach((to, from) => {
  previousRoute.value = from
})

// 暴露过渡状态
defineExpose({
  isTransitioning
})
</script>

<style scoped>
/* 过渡容器样式 */
.transition-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 确保滑动过渡时的容器样式 */
:deep(.slide-left-enter-active),
:deep(.slide-left-leave-active),
:deep(.slide-right-enter-active),
:deep(.slide-right-leave-active) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
