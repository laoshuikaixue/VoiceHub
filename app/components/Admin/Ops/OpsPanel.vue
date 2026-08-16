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
        <button v-if="refreshable" type="button" :disabled="pending || refreshing" :aria-label="`刷新${title}`" @click="$emit('refresh')">
          <Icon name="refresh" :size="13" :class="{ 'ops-panel__spin': pending || refreshing }" />
        </button>
      </div>
    </header>
    <div class="ops-panel__body" :class="{ 'ops-panel__body--refreshing': refreshing }" :aria-busy="refreshing">
      <div v-if="refreshing" class="ops-panel__refresh-line" role="status" aria-label="正在更新数据"><i /></div>
      <div v-if="pending" class="ops-panel__state" role="status">正在读取数据…</div>
      <div v-else-if="error" class="ops-panel__state ops-panel__state--error">
        <span>数据暂时无法读取</span><button type="button" @click="$emit('refresh')">重试</button>
      </div>
      <div v-else-if="empty" class="ops-panel__state">{{ emptyText }}</div>
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
  emptyText: { type: String, default: '暂无真实采集数据。' },
  stale: { type: Boolean, default: false },
  refreshing: { type: Boolean, default: false },
  refreshable: { type: Boolean, default: true }
})
</script>

<style scoped>
.ops-panel { overflow: hidden; border: 1px solid var(--ops-line, var(--card-border, rgba(148, 163, 184, .12))); border-left: 1px solid var(--ops-line, var(--card-border, rgba(148, 163, 184, .12))); border-radius: 6px; background: var(--ops-panel, var(--card-bg, #11151b)); box-shadow: none; }
.ops-panel:hover { border-color: var(--ops-line-strong, var(--card-hover-border, rgba(148, 163, 184, .2))); }
.ops-panel--ok { --ops-muted: var(--ops-ok, #34d399); }
.ops-panel--warning { --ops-muted: var(--ops-warning, #fbbf24); border-left: 3px solid var(--ops-muted); background: color-mix(in srgb, var(--ops-muted) 2.5%, var(--ops-panel, var(--card-bg, #11151b))); }
.ops-panel--error { --ops-muted: var(--ops-error, #fb7185); border-left: 3px solid var(--ops-muted); background: color-mix(in srgb, var(--ops-muted) 4%, var(--ops-panel, var(--card-bg, #11151b))); }
.ops-panel--unknown { --ops-muted: var(--ops-unknown, #94a3b8); }
.ops-panel--stale { border-style: dashed; }
.ops-panel__header { display: flex; min-height: 3.1rem; align-items: center; justify-content: space-between; gap: .75rem; border-bottom: 1px solid var(--ops-line-soft, rgba(148, 163, 184, .08)); padding: .7rem .9rem; }
.ops-panel__heading, .ops-panel__actions { display: flex; min-width: 0; align-items: center; gap: .55rem; }
.ops-panel__heading h3 { margin: 0; color: var(--ops-text-1, #e5e7eb); font-size: .8125rem; font-weight: 600; }
.ops-panel__heading p, .ops-panel__updated { margin: .15rem 0 0; color: var(--ops-text-2, #94a3b8); font-size: .75rem; }
.ops-panel__updated { margin: 0; white-space: nowrap; }
.ops-panel__dot { width: .4375rem; height: .4375rem; flex: 0 0 auto; border-radius: 50%; background: var(--ops-muted); box-shadow: none; }
.ops-panel__actions button { display: inline-flex; align-items: center; justify-content: center; width: 1.875rem; height: 1.875rem; border: 1px solid var(--ops-line, rgba(148, 163, 184, .12)); border-radius: 6px; color: var(--ops-text-1, #e5e7eb); background: var(--ops-control, var(--input-bg, #0e1217)); cursor: pointer; }
.ops-panel__actions button:hover { border-color: color-mix(in srgb, var(--ops-info, #22d3ee) 50%, var(--ops-line)); color: var(--ops-text-1, #e5e7eb); }
.ops-panel__actions button:disabled { cursor: not-allowed; opacity: .5; }
.ops-panel__body { position: relative; min-height: 5.25rem; padding: 1rem; }
.ops-panel__refresh-line { position: absolute; z-index: 1; top: 0; right: 0; left: 0; height: 2px; overflow: hidden; background: rgba(34, 211, 238, .12); pointer-events: none; }
.ops-panel__refresh-line i { display: block; width: 35%; height: 100%; background: var(--ops-info, #22d3ee); animation: ops-panel-refresh-line 1.1s ease-in-out infinite; }
.ops-panel__state { display: flex; min-height: 4rem; align-items: center; justify-content: center; gap: .55rem; color: var(--ops-text-2, #94a3b8); font-size: .75rem; }
.ops-panel__state--error { color: var(--ops-error, #fb7185); }
.ops-panel__state--error button { height: 1.875rem; border: 1px solid var(--ops-line, rgba(148, 163, 184, .12)); border-radius: 6px; padding: 0 .55rem; color: var(--ops-text-1, #e5e7eb); background: var(--ops-control, var(--input-bg, #0e1217)); font: inherit; cursor: pointer; }
.ops-panel__state--error button:hover { border-color: rgba(56, 189, 248, .5); }
.ops-panel__spin { animation: ops-panel-spin .9s linear infinite; }
@keyframes ops-panel-spin { to { transform: rotate(360deg); } }
@keyframes ops-panel-refresh-line { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
</style>
