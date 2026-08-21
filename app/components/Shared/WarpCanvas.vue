<template>
  <div class="absolute inset-0 z-0 bg-bg-primary overflow-hidden">
    <canvas
      ref="canvasRef"
      class="w-full h-full block touch-none pointer-events-auto"
    />
    <div
      class="absolute inset-0 pointer-events-none"
      :style="{ background: `radial-gradient(circle_at_center,transparent_45%,${glowColors.overlayEnd} 100%)` }"
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useTheme } from '~/composables/useTheme'

const props = defineProps({
  settings: { type: Object, required: true },
  isAccelerating: { type: Boolean, required: true },
  currentProgress: { type: Number, required: true }
})

const { isDark } = useTheme()

const canvasRef = ref(null)

const settingsRef = ref(props.settings)
const isAcceleratingRef = ref(props.isAccelerating)

watch(() => props.settings, (val) => { settingsRef.value = val })
watch(() => props.isAccelerating, (val) => { isAcceleratingRef.value = val })
watch(isDark, () => {
  loadBrandColors()
  // 主题切换后重绘光晕颜色
  glowColors.load()
  // 主题切换后重新生成星星颜色
  stars.length = 0
  for (let i = 0; i < 250; i++) {
    stars.push(initStar({ z: Math.random() * 1000 }))
  }
})

const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }

// Canvas 动画所需的状态，提升为模块级以便主题切换时重绘
const stars = []

// Canvas 2D API 不识别 CSS 变量，此处从 CSS 变量动态读取实际色值
const BRAND_COLORS = {}

function loadBrandColors(root) {
  root = root || document.documentElement
  const cs = getComputedStyle(root)
  const keys = [
    'warp-canvas-indigo', 'warp-canvas-primary', 'warp-canvas-primary-light', 'brand-blue-light',
    'brand-green', 'brand-green-light', 'brand-red', 'brand-pink',
    'brand-teal', 'brand-orange', 'brand-yellow-light',
    'text-primary', 'text-primary-lighter', 'brand-cyan',
  ]
  for (const key of keys) {
    const val = cs.getPropertyValue(`--${key}`).trim()
    if (val) BRAND_COLORS[key] = toHexValue(val)
  }
}

if (typeof document !== 'undefined') {
  loadBrandColors()
}

/** 将任意 CSS 颜色值统一转为 hex (#RRGGBB) */
function toHexValue(color) {
  if (color.startsWith('#')) {
    // #RGB 展开为 #RRGGBB
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    }
    return color
  }
  // rgb(r, g, b) / rgba(r, g, b, a)
  const m = color.match(/rgba?\(\s*([\d.]+)\s*[,%]\s*([\d.]+)\s*[,%]\s*([\d.]+)/)
  if (m) {
    const r = parseInt(m[1], 10)
    const g = parseInt(m[2], 10)
    const b = parseInt(m[3], 10)
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  }
  // 兜底：原样返回
  return color
}

/** 将 hex 颜色转为 rgba 数组 [r, g, b, a] */
function hexToRgba(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return [r, g, b, 1]
}

/** 将 hex 颜色 + alpha 转为 rgba() 字符串 */
function hexWithAlpha(hex, alpha) {
  const [r, g, b] = hexToRgba(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 光晕颜色 — 统一从 CSS 变量 --app-loading-brand-primary 读取
const glowColors = {
  color: '',       // hex
  overlayEnd: '',  // 解析后的 rgba 字符串
  load() {
    const cs = getComputedStyle(document.documentElement)
    const raw = cs.getPropertyValue('--app-loading-brand-primary').trim()
    // 回退值与 SSR 默认主题（经典深色）的主色对齐
    this.color = raw ? toHexValue(raw) : '#6366f1'
    // 解析 --canvas-glow-overlay-end 的实际 rgba 值
    const rawOverlay = cs.getPropertyValue('--canvas-glow-overlay-end').trim()
    this.overlayEnd = rawOverlay || 'rgba(245, 245, 247, 0.7)'
  }
}
if (typeof document !== 'undefined') {
  glowColors.load()
}

function getRandomColor(base) {
  const cold = ['warp-canvas-indigo', 'warp-canvas-primary', 'brand-blue-light', 'text-primary', 'warp-canvas-primary-light']
  if (base === 'emerald') {
    const greens = ['brand-green', 'brand-green-light', 'brand-cyan']
    return toHex(greens[Math.floor(Math.random() * greens.length)])
  }
  if (base === 'cyberpunk') {
    const pinks = ['brand-red', 'brand-pink', 'warp-canvas-primary', 'brand-teal']
    return toHex(pinks[Math.floor(Math.random() * pinks.length)])
  }
  if (base === 'sunset') {
    const warm = ['brand-orange', 'brand-red', 'text-primary-lighter', 'brand-yellow-light', 'brand-pink']
    return toHex(warm[Math.floor(Math.random() * warm.length)])
  }
  return toHex(cold[Math.floor(Math.random() * cold.length)])
}

function toHex(color) {
  // 已经是 hex 直接返回
  if (color.startsWith('#')) return color
  // 从映射表取（已统一为 hex）
  return BRAND_COLORS[color] ?? glowColors.color
}

function initStar(partial) {
  partial = partial || {}
  return {
    x: partial.x ?? (Math.random() - 0.5) * 1000,
    y: partial.y ?? (Math.random() - 0.5) * 1000,
    z: partial.z ?? Math.random() * 1000 + 10,
    prevZ: partial.z ?? 1000,
    color: getRandomColor('indigo'),
    size: Math.random() * 1.5 + 1.2,
    angle: Math.random() * Math.PI * 2,
  }
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let animationId
  let width = 0
  let height = 0

  const handleResize = () => {
    const parent = canvas.parentElement
    if (parent) {
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = width
      canvas.height = height
    }
  }

  const resizeObserver = new ResizeObserver(() => handleResize())
  if (canvas.parentElement) {
    resizeObserver.observe(canvas.parentElement)
  }
  handleResize()

  for (let i = 0; i < 250; i++) {
    stars.push(initStar({ z: Math.random() * 1000 }))
  }

  let speedFactor = 1.0
  let thicknessFactor = 1.2
  let glowFactor = 0.12
  let radialGlowOpacity = 0.2

  const handleMouseMove = (e) => {
    const halfW = window.innerWidth / 2
    const halfH = window.innerHeight / 2
    pointer.targetX = (e.clientX - halfW) / halfW
    pointer.targetY = (e.clientY - halfH) / halfH
  }

  const handleTouchMove = (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0]
      const halfW = window.innerWidth / 2
      const halfH = window.innerHeight / 2
      pointer.targetX = (touch.clientX - halfW) / halfW
      pointer.targetY = (touch.clientY - halfH) / halfH
    }
  }

  const handleMouseLeave = () => {
    pointer.targetX = 0
    pointer.targetY = 0
  }

  if (props.settings.interactive) {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('mouseleave', handleMouseLeave)
  }

  const tick = () => {
    const currentSettings = settingsRef.value
    const accelerating = isAcceleratingRef.value

    const targetSpeedFactor = accelerating ? 3.2 : 1.0
    const targetThicknessFactor = accelerating ? 2.2 : 1.2
    const targetGlowFactor = accelerating ? 0.26 : 0.12
    const targetRadialGlowOpacity = accelerating ? 0.42 : 0.2

    speedFactor += (targetSpeedFactor - speedFactor) * 0.07
    thicknessFactor += (targetThicknessFactor - thicknessFactor) * 0.07
    glowFactor += (targetGlowFactor - glowFactor) * 0.07
    radialGlowOpacity += (targetRadialGlowOpacity - radialGlowOpacity) * 0.07

    pointer.x += (pointer.targetX - pointer.x) * 0.08
    pointer.y += (pointer.targetY - pointer.y) * 0.08

    ctx.save()
    // 从 CSS 变量读取背景叠加色
    const bgOverlay = getComputedStyle(document.documentElement)
      .getPropertyValue('--canvas-bg-overlay').trim()
    ctx.fillStyle = bgOverlay || 'rgba(7, 7, 9, 0.18)'
    ctx.fillRect(0, 0, width, height)

    const centerX = width / 2 + pointer.x * (width * 0.12)
    const centerY = height / 2 + pointer.y * (height * 0.12)
    const currentSpeed = 7 * currentSettings.speedMultiplier * speedFactor

    stars.forEach((star) => {
      star.prevZ = star.z
      star.z -= currentSpeed

      if (star.z <= 0) {
        Object.assign(star, initStar({ z: 1000 }))
        star.prevZ = star.z
      }

      const scaleFactor = 300
      const screenX = (star.x / star.z) * scaleFactor + centerX
      const screenY = (star.y / star.z) * scaleFactor + centerY
      const prevScreenX = (star.x / star.prevZ) * scaleFactor + centerX
      const prevScreenY = (star.y / star.prevZ) * scaleFactor + centerY

      if (screenX < -200 || screenX > width + 200 || screenY < -200 || screenY > height + 200) return

      const depthAlpha = Math.min(1, (1000 - star.z) / 800) * 0.85
      ctx.strokeStyle = star.color
      ctx.beginPath()
      ctx.lineWidth = star.size * thicknessFactor * (1 - star.z / 1000)
      ctx.globalAlpha = depthAlpha
      ctx.moveTo(prevScreenX, prevScreenY)
      ctx.lineTo(screenX, screenY)
      ctx.stroke()
    })

    if (currentSettings.glowEffect) {
      ctx.globalAlpha = glowFactor
      const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, Math.max(width, height) * 0.75)
      grad.addColorStop(0, hexWithAlpha(glowColors.color, radialGlowOpacity))
      grad.addColorStop(0.5, hexWithAlpha(glowColors.color, 0.04))
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
    }

    ctx.restore()
    animationId = requestAnimationFrame(tick)
  }

  animationId = requestAnimationFrame(tick)

  onUnmounted(() => {
    cancelAnimationFrame(animationId)
    resizeObserver.disconnect()
    if (props.settings.interactive) {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  })
})
</script>
