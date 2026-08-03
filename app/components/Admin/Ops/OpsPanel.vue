<template>
  <section class="ops-panel" :class="[`ops-panel--${status}`, { 'ops-panel--stale': stale }]">
    <header class="ops-panel__header">
      <div class="ops-panel__heading">
        <span class="ops-panel__dot" :class="`ops-panel__dot--${status}`" />
        <div>
          <h3>{{ title }}</h3>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div class="ops-panel__actions">
        <span class="ops-panel__updated">{{ updatedAt }}</span>
        <button v-if="refreshable" type="button" :disabled="pending" :aria-label="`刷新${title}`" @click="$emit('refresh')">
          <Icon name="refresh" :size="13" :class="{ 'ops-panel__spin': pending }" />
        </button>
      </div>
    </header>
    <div class="ops-panel__body">
      <div v-if="pending" class="ops-panel__state" role="status">正在读取数据…</div>
      <div v-else-if="error" class="ops-panel__state ops-panel__state--error">
        <span>数据暂时无法读取</span><button type="button" @click="$emit('refresh')">重试</button>
      </div>
      <div v-else-if="empty" class="ops-panel__state">暂无真实采集数据。</div>
      <slot v-else />
    </div>
  </section>
</template>

<script setup>
import Icon from '~/components/UI/Icon.vue'

defineEmits(['refresh'])
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  status: { type: String, default: 'unknown' },
  updatedAt: { type: String, default: '尚未更新' },
  pending: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  empty: { type: Boolean, default: false },
  stale: { type: Boolean, default: false },
  refreshable: { type: Boolean, default: true }
})
</script>

<style scoped>
.ops-panel { overflow: hidden; border: 1px solid var(--ops-line, rgb(63 63 70)); border-left: 3px solid var(--ops-muted, rgb(82 82 91)); border-radius: 6px; background: var(--ops-panel, rgb(24 24 27 / .56)); }
.ops-panel--ok { --ops-muted: var(--ops-ok, #34d399); }
.ops-panel--warning { --ops-muted: var(--ops-warning, #fbbf24); }
.ops-panel--error { --ops-muted: var(--ops-error, #f87171); }
.ops-panel--unknown { --ops-muted: var(--ops-unknown, #71717a); }
.ops-panel--stale { border-style: dashed; }
.ops-panel__header { display: flex; min-height: 3.1rem; align-items: center; justify-content: space-between; gap: .75rem; border-bottom: 1px solid var(--ops-line, rgb(63 63 70)); padding: .6rem .75rem; }
.ops-panel__heading, .ops-panel__actions { display: flex; min-width: 0; align-items: center; gap: .55rem; }
.ops-panel__heading h3 { margin: 0; color: var(--ops-text-1, rgb(228 228 231)); font-size: .78rem; font-weight: 700; }
.ops-panel__heading p, .ops-panel__updated { margin: .15rem 0 0; color: var(--ops-text-3, rgb(113 113 122)); font-size: .62rem; }
.ops-panel__updated { margin: 0; white-space: nowrap; }
.ops-panel__dot { width: .46rem; height: .46rem; flex: 0 0 auto; border-radius: 50%; background: var(--ops-muted); }
.ops-panel__dot--error { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ops-muted) 14%, transparent); }
.ops-panel__actions button { display: inline-flex; align-items: center; justify-content: center; width: 1.6rem; height: 1.6rem; border: 1px solid var(--ops-line, rgb(63 63 70)); border-radius: 4px; color: var(--ops-text-2, rgb(161 161 170)); background: transparent; cursor: pointer; }
.ops-panel__actions button:hover { border-color: var(--ops-line-strong, rgb(82 82 91)); color: var(--ops-text-1, rgb(228 228 231)); }
.ops-panel__actions button:disabled { cursor: not-allowed; opacity: .5; }
.ops-panel__body { min-height: 5.25rem; padding: 1rem; }
.ops-panel__state { display: flex; min-height: 4rem; align-items: center; justify-content: center; gap: .55rem; color: var(--ops-text-3, rgb(113 113 122)); font-size: .72rem; }
.ops-panel__state--error { color: var(--ops-error, #f87171); }
.ops-panel__state--error button { border: 0; padding: 0; color: inherit; background: transparent; font: inherit; text-decoration: underline; cursor: pointer; }
.ops-panel__spin { animation: ops-panel-spin .8s linear infinite; }
@keyframes ops-panel-spin { to { transform: rotate(360deg); } }
</style>
