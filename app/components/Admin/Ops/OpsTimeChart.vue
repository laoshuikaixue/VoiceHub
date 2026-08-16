<template>
  <section class="ops-chart" :class="`ops-chart--${tone}`" :aria-label="title">
    <header class="ops-chart__summary">
      <div class="ops-chart__legend"><i /><span>{{ title }}</span></div>
      <dl>
        <div><dt>{{ chartLabels.latest }}</dt><dd>{{ formatValue(latestValue) }}</dd></div>
        <div><dt>{{ chartLabels.average }}</dt><dd>{{ formatValue(averageValue) }}</dd></div>
        <div><dt>{{ chartLabels.peak }}</dt><dd>{{ formatValue(peakValue) }}</dd></div>
        <div><dt>{{ chartLabels.change }}</dt><dd>{{ formattedChange }}</dd></div>
      </dl>
    </header>

    <div class="ops-chart__body">
      <div class="ops-chart__y-axis">
        <span v-for="tick in ticks" :key="tick">{{ formatNumber(tick) }}</span>
      </div>
      <div
        ref="plotElement"
        class="ops-chart__plot"
        @pointermove="activateNearestPoint"
        @pointerleave="activePoint = null"
      >
        <div class="ops-chart__grid"><i v-for="tick in ticks" :key="tick" /></div>
        <svg class="ops-chart__svg" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="currentColor" stop-opacity="0.2" />
              <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          <polygon v-for="(area, index) in areaSegments" :key="`area-${index}`" :points="area" :fill="`url(#${gradientId})`" />
          <polyline v-for="(line, index) in lineSegments" :key="`line-${index}`" :points="line" />
        </svg>
        <button
          v-for="point in validPoints"
          :key="`${point.index}-${point.at}`"
          type="button"
          class="ops-chart__point"
          :class="{ 'is-active': activePoint?.index === point.index }"
          :style="{ '--point-x': `${point.xPercent}%`, '--point-y': `${point.yPercent}%` }"
          :aria-label="`${formatTooltipTime(point.at)}, ${title} ${formatValue(point.value)}`"
          @focus="activePoint = point"
          @blur="activePoint = null"
          @pointerenter="activePoint = point"
        ><i /></button>
        <Transition name="chart-hover">
          <div v-if="activePoint" class="ops-chart__interaction">
            <i class="ops-chart__guide" :style="{ left: `${activePoint.xPercent}%` }" />
            <i class="ops-chart__active-point" :style="{ left: `${activePoint.xPercent}%`, bottom: `${activePoint.yPercent}%` }" />
            <div class="ops-chart__tooltip" :style="{ left: `${tooltipLeft}%` }">
              <time>{{ formatTooltipTime(activePoint.at) }}</time>
              <div><span>{{ title }}</span><strong>{{ formatValue(activePoint.value) }}</strong></div>
            </div>
          </div>
        </Transition>
      </div>
      <div class="ops-chart__x-axis">
        <time v-for="label in axisLabels" :key="`${label.index}-${label.at}`" :style="{ left: `${label.left}%` }">{{ formatAxisTime(label.at) }}</time>
      </div>
    </div>

    <footer class="ops-chart__footer">
      <span>{{ chartLabels.range }} {{ rangeText }}</span>
      <span>{{ validPoints.length }} {{ chartLabels.samples }}</span>
    </footer>
  </section>
</template>

<script setup>
import { computed, ref, useId } from 'vue'

const props = defineProps({
  points: { type: Array, default: () => [] },
  field: { type: String, required: true },
  title: { type: String, default: '' },
  unit: { type: String, default: '' },
  labels: {
    type: Object,
    default: () => ({ latest: '最新', average: '均值', peak: '峰值', change: '变化', range: '范围', samples: '个采样点' })
  }
})

const plotElement = ref(null)
const activePoint = ref(null)
const gradientId = `ops-chart-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const chartLabels = computed(() => ({
  latest: '最新',
  average: '均值',
  peak: '峰值',
  change: '区间变化',
  range: '时间范围',
  samples: '个有效采样点',
  ...props.labels
}))

const tone = computed(() => {
  const field = props.field.toLowerCase()
  if (field.includes('error') || field.includes('failure')) return 'danger'
  if (field.includes('p95') || field.includes('p99') || field.includes('duration') || field.includes('latency')) return 'warning'
  if (field.includes('connection') || field.includes('schedule')) return 'success'
  return 'info'
})

const rawValues = computed(() => props.points.map((point) => {
  const value = point?.[props.field]
  if (value == null || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}))
const collectedValues = computed(() => rawValues.value.filter((value) => value != null))

const niceScale = computed(() => {
  const maximum = Math.max(...collectedValues.value, 0)
  if (maximum <= 0) return { top: 1, step: 0.25 }
  const roughStep = maximum / 4
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = niceNormalized * magnitude
  return { top: step * 4, step }
})
const ticks = computed(() => Array.from({ length: 5 }, (_, index) => niceScale.value.top - niceScale.value.step * index))
const valueRatio = (value) => Math.min(1, Math.max(0, Number(value || 0) / niceScale.value.top))

const allPoints = computed(() => props.points.map((point, index) => {
  const total = props.points.length
  const value = rawValues.value[index]
  const xPercent = total > 1 ? index / (total - 1) * 100 : 50
  return {
    index,
    at: point?.at,
    value,
    x: xPercent * 10,
    xPercent,
    y: value == null ? null : 214 - valueRatio(value) * 202,
    yPercent: value == null ? null : 3 + valueRatio(value) * 92
  }
}))
const validPoints = computed(() => allPoints.value.filter((point) => point.value != null))

const segmentPoints = computed(() => {
  const segments = []
  let current = []
  allPoints.value.forEach((point) => {
    if (point.value == null) {
      if (current.length) segments.push(current)
      current = []
      return
    }
    current.push(point)
  })
  if (current.length) segments.push(current)
  return segments
})
const lineSegments = computed(() => segmentPoints.value.map((segment) => segment.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')))
const areaSegments = computed(() => segmentPoints.value.map((segment) => {
  const line = segment.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  return `${segment[0].x.toFixed(2)},220 ${line} ${segment[segment.length - 1].x.toFixed(2)},220`
}))

const latestValue = computed(() => collectedValues.value.at(-1) ?? null)
const peakValue = computed(() => collectedValues.value.length ? Math.max(...collectedValues.value) : null)
const averageValue = computed(() => collectedValues.value.length ? collectedValues.value.reduce((sum, value) => sum + value, 0) / collectedValues.value.length : null)
const changeValue = computed(() => collectedValues.value.length > 1 ? collectedValues.value.at(-1) - collectedValues.value[0] : null)

const valuePrecision = computed(() => {
  if (props.unit.includes('MB')) return 2
  if (props.unit === '%' || niceScale.value.step < 1) return 1
  return 0
})
const formatNumber = (value) => Number(value).toFixed(valuePrecision.value).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
const formatValue = (value) => value == null || !Number.isFinite(Number(value)) ? '--' : `${formatNumber(value)}${props.unit ? ` ${props.unit}` : ''}`
const formattedChange = computed(() => {
  if (changeValue.value == null) return '--'
  const prefix = changeValue.value > 0 ? '+' : ''
  return `${prefix}${formatNumber(changeValue.value)}${props.unit ? ` ${props.unit}` : ''}`
})

const toDate = (value) => {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}
const formatAxisTime = (value) => {
  const date = toDate(value)
  if (!date) return '--'
  const first = toDate(props.points[0]?.at)
  const last = toDate(props.points.at(-1)?.at)
  const spansDay = first && last && last.getTime() - first.getTime() >= 20 * 60 * 60 * 1000
  return date.toLocaleString([], spansDay ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' })
}
const formatTooltipTime = (value) => {
  const date = toDate(value)
  return date ? date.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--'
}
const axisLabels = computed(() => {
  const total = props.points.length
  if (!total) return []
  const indexes = total <= 5
    ? Array.from({ length: total }, (_, index) => index)
    : [0, Math.round((total - 1) * 0.25), Math.round((total - 1) * 0.5), Math.round((total - 1) * 0.75), total - 1]
  return [...new Set(indexes)].map((index) => ({ index, at: props.points[index]?.at, left: total > 1 ? index / (total - 1) * 100 : 50 }))
})
const rangeText = computed(() => axisLabels.value.length ? `${formatAxisTime(props.points[0]?.at)} - ${formatAxisTime(props.points.at(-1)?.at)}` : '--')
const tooltipLeft = computed(() => Math.min(86, Math.max(14, activePoint.value?.xPercent ?? 50)))

const activateNearestPoint = (event) => {
  const rect = plotElement.value?.getBoundingClientRect()
  if (!rect?.width || !validPoints.value.length) return
  const xPercent = Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100))
  activePoint.value = validPoints.value.reduce((nearest, point) => Math.abs(point.xPercent - xPercent) < Math.abs(nearest.xPercent - xPercent) ? point : nearest)
}
</script>

<style scoped>
.ops-chart { --chart-color: var(--ops-info, #38bdf8); --chart-rgb: 56, 189, 248; min-width: 0; color: var(--chart-color); }
.ops-chart--danger { --chart-color: #fb7185; --chart-rgb: 251, 113, 133; }
.ops-chart--warning { --chart-color: #fbbf24; --chart-rgb: 251, 191, 36; }
.ops-chart--success { --chart-color: #34d399; --chart-rgb: 52, 211, 153; }
.ops-chart__summary { display: flex; min-height: 3.1rem; align-items: center; justify-content: space-between; gap: .75rem; border-bottom: 1px solid var(--ops-line-soft, rgba(148, 163, 184, .1)); padding: .15rem .1rem .75rem; }
.ops-chart__legend { display: flex; min-width: 0; align-items: center; gap: .5rem; color: var(--ops-text-1, #cbd5e1); font-size: .75rem; font-weight: 650; }
.ops-chart__legend i { width: 1.25rem; height: 2px; flex: none; background: var(--chart-color); box-shadow: 0 0 10px rgba(var(--chart-rgb), .28); }
.ops-chart__legend span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-chart__summary dl { display: grid; grid-template-columns: repeat(4, minmax(4.2rem, auto)); gap: .35rem; margin: 0; }
.ops-chart__summary dl div { border-left: 1px solid var(--ops-line-soft, rgba(148, 163, 184, .1)); padding-left: .6rem; }
.ops-chart__summary dt { color: var(--ops-text-2, #64748b); font-size: .625rem; font-weight: 600; }
.ops-chart__summary dd { margin: .12rem 0 0; color: var(--ops-text-1, #e2e8f0); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .6875rem; font-weight: 700; white-space: nowrap; }
.ops-chart__body { position: relative; margin-top: .75rem; padding-left: 3.9rem; }
.ops-chart__y-axis { position: absolute; top: 0; bottom: 1.7rem; left: 0; display: flex; width: 3.45rem; flex-direction: column; justify-content: space-between; color: var(--ops-text-2, #64748b); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .625rem; text-align: right; }
.ops-chart__plot { position: relative; height: 13.75rem; overflow: hidden; border-bottom: 1px solid var(--ops-line-strong, rgba(148, 163, 184, .24)); background-color: color-mix(in srgb, var(--ops-control, #0e1217) 45%, transparent); background-image: linear-gradient(to right, var(--ops-line-soft, rgba(148, 163, 184, .075)) 1px, transparent 1px); background-size: 25% 100%; cursor: crosshair; }
.ops-chart__grid { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
.ops-chart__grid i { border-top: 1px dashed var(--ops-line, rgba(148, 163, 184, .14)); }
.ops-chart__svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; color: var(--chart-color); pointer-events: none; }
.ops-chart__svg polygon { stroke: none; animation: chart-area-in .45s ease-out both; }
.ops-chart__svg polyline { fill: none; stroke: currentColor; stroke-width: 2.25; stroke-dasharray: 1400; stroke-dashoffset: 1400; vector-effect: non-scaling-stroke; stroke-linecap: round; stroke-linejoin: round; animation: chart-line-in .65s cubic-bezier(.22, 1, .36, 1) forwards; }
.ops-chart__point { position: absolute; bottom: 0; left: var(--point-x); z-index: 2; width: max(18px, calc(100% / 48)); height: 100%; transform: translateX(-50%); border: 0; padding: 0; background: transparent; cursor: crosshair; }
.ops-chart__point i { position: absolute; bottom: var(--point-y); left: 50%; width: 6px; height: 6px; transform: translate(-50%, 50%); border: 1px solid var(--chart-color); border-radius: 50%; background: var(--ops-panel, #11151b); opacity: .45; transition: width .12s ease, height .12s ease, opacity .12s ease, box-shadow .12s ease; }
.ops-chart__point:hover i,
.ops-chart__point:focus-visible i,
.ops-chart__point.is-active i { width: 10px; height: 10px; opacity: 1; box-shadow: 0 0 0 4px rgba(var(--chart-rgb), .14); outline: none; }
.ops-chart__point:focus-visible { outline: 1px dashed rgba(var(--chart-rgb), .55); outline-offset: -1px; }
.ops-chart__interaction { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.ops-chart__guide { position: absolute; inset-block: 0; border-left: 1px dashed rgba(var(--chart-rgb), .72); transition: left .18s cubic-bezier(.22, 1, .36, 1); }
.ops-chart__active-point { position: absolute; width: 11px; height: 11px; transform: translate(-50%, 50%); border: 2px solid var(--ops-panel, #11151b); border-radius: 50%; background: var(--chart-color); box-shadow: 0 0 0 4px rgba(var(--chart-rgb), .18), 0 0 14px rgba(var(--chart-rgb), .32); transition: left .18s cubic-bezier(.22, 1, .36, 1), bottom .18s cubic-bezier(.22, 1,.36, 1); }
.ops-chart__tooltip { position: absolute; top: .55rem; min-width: 11rem; transform: translateX(-50%); border: 1px solid rgba(var(--chart-rgb), .34); border-radius: 6px; padding: .6rem .7rem; background: color-mix(in srgb, var(--ops-panel, #11151b) 96%, transparent); color: var(--ops-text-1, #e5e7eb); box-shadow: var(--ops-shadow-lg, 0 10px 24px rgba(0, 0, 0, .28)); transition: left .18s cubic-bezier(.22, 1, .36, 1); }
.ops-chart__tooltip time { display: block; margin-bottom: .4rem; color: var(--ops-text-2, #94a3b8); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .625rem; }
.ops-chart__tooltip div { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.ops-chart__tooltip span { overflow: hidden; color: var(--ops-text-2, #94a3b8); font-size: .6875rem; text-overflow: ellipsis; white-space: nowrap; }
.ops-chart__tooltip strong { color: var(--ops-text-1, #f8fafc); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .75rem; white-space: nowrap; }
.ops-chart__x-axis { position: relative; height: 1.7rem; color: var(--ops-text-2, #64748b); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .625rem; }
.ops-chart__x-axis time { position: absolute; top: .5rem; transform: translateX(-50%); white-space: nowrap; }
.ops-chart__x-axis time:first-child { transform: none; }
.ops-chart__x-axis time:last-child { transform: translateX(-100%); }
.ops-chart__footer { display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--ops-line-soft, rgba(148, 163, 184, .08)); padding: .55rem .1rem 0; color: var(--ops-text-2, #64748b); font-size: .625rem; }
.chart-hover-enter-active,
.chart-hover-leave-active { transition: opacity .14s ease, transform .14s ease; }
.chart-hover-enter-from,
.chart-hover-leave-to { transform: translateY(-3px); opacity: 0; }
@keyframes chart-line-in { to { stroke-dashoffset: 0; } }
@keyframes chart-area-in { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 640px) {
  .ops-chart__summary { align-items: flex-start; flex-direction: column; }
  .ops-chart__summary dl { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ops-chart__summary dl div:nth-child(odd) { border-left: 0; padding-left: 0; }
  .ops-chart__body { padding-left: 3.25rem; }
  .ops-chart__y-axis { width: 2.85rem; }
  .ops-chart__plot { height: 11.5rem; }
  .ops-chart__x-axis time:nth-child(even) { display: none; }
  .ops-chart__footer span:first-child { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .ops-chart__svg polygon,
  .ops-chart__svg polyline { animation: none; stroke-dashoffset: 0; }
  .ops-chart__point i,
  .ops-chart__guide,
  .ops-chart__active-point,
  .ops-chart__tooltip,
  .chart-hover-enter-active,
  .chart-hover-leave-active { transition: none; }
}
</style>
