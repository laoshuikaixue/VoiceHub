<template>
  <div class="absolute inset-0 z-0 bg-[#070709] overflow-hidden">
    <canvas
      ref="canvasRef"
      class="w-full h-full block touch-none pointer-events-auto"
    />
    <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,rgba(5,5,7,0.92)_100%)]" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

interface WarpSettings {
  themeColor: string
  pattern: 'hyperdrive' | 'nebula' | 'grid' | 'vortex'
  speedMultiplier: number
  particleCount: number
  glowEffect: boolean
  interactive: boolean
}

const props = defineProps<{
  settings: WarpSettings
  isAccelerating: boolean
  currentProgress: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const settingsRef = ref(props.settings)
const isAcceleratingRef = ref(props.isAccelerating)

watch(() => props.settings, (val) => { settingsRef.value = val })
watch(() => props.isAccelerating, (val) => { isAcceleratingRef.value = val })

const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }

interface Star {
  x: number
  y: number
  z: number
  prevZ: number
  color: string
  size: number
  angle: number
}

function getRandomColor(base: string): string {
  const cold = ['#6366f1', '#8b5cf6', '#a855f7', '#3b82f6', '#ffffff', '#e0e7ff']
  if (base === 'emerald') {
    const greens = ['#10b981', '#34d399', '#6ee7b7', '#059669', '#38bdf8']
    return greens[Math.floor(Math.random() * greens.length)]
  }
  if (base === 'cyberpunk') {
    const pinks = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#06b6d4']
    return pinks[Math.floor(Math.random() * pinks.length)]
  }
  if (base === 'sunset') {
    const warm = ['#f97316', '#ef4444', '#f1f5f9', '#facc15', '#ec4899']
    return warm[Math.floor(Math.random() * warm.length)]
  }
  return cold[Math.floor(Math.random() * cold.length)]
}

function initStar(partial: Partial<Star> = {}): Star {
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

  let animationId: number
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

  const stars: Star[] = []
  for (let i = 0; i < 250; i++) {
    stars.push(initStar({ z: Math.random() * 1000 }))
  }

  let speedFactor = 1.0
  let thicknessFactor = 1.2
  let glowFactor = 0.12
  let radialGlowOpacity = 0.2

  const handleMouseMove = (e: MouseEvent) => {
    const halfW = window.innerWidth / 2
    const halfH = window.innerHeight / 2
    pointer.targetX = (e.clientX - halfW) / halfW
    pointer.targetY = (e.clientY - halfH) / halfH
  }

  const handleTouchMove = (e: TouchEvent) => {
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
    ctx.fillStyle = 'rgba(7, 7, 9, 0.18)'
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
      grad.addColorStop(0, `rgba(99, 102, 241, ${radialGlowOpacity})`)
      grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.04)')
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
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
