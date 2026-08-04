<template>
  <div class="user-activity-panel">
    <OpsPanel
      title="在线用户"
      subtitle="根据真实登录会话与最近活动时间分析在线状态、浏览器和设备来源。"
      :status="panelStatus"
      :updated-at="updatedAt"
      :pending="loading && !data"
      :error="Boolean(error) && !forbidden"
      :empty="false"
      @refresh="loadSessions(page)"
    >
      <div v-if="forbidden" class="activity-permission">仅超级管理员可查看用户活动记录。</div>
      <template v-else-if="data">
        <div class="activity-inline-summary">
          <span><Icon name="activity" :size="13" />活跃会话 <strong>{{ stats.activeSessions }}</strong></span>
          <span><Icon name="clock" :size="13" />闲置会话 <strong>{{ stats.idleSessions }}</strong></span>
          <span><Icon name="users" :size="13" />在线用户 <strong>{{ stats.onlineUsers }}</strong></span>
        </div>
        <section class="activity-kpis">
          <article><span>有效会话</span><strong>{{ stats.totalSessions }}</strong><small>未过期且未撤销</small><i><b :style="{ width: '100%' }" /></i></article>
          <article><span>在线用户</span><strong>{{ stats.onlineUsers }}</strong><small>按账号去重</small><i><b :style="{ width: `${ratio(stats.onlineUsers, stats.totalSessions)}%` }" /></i></article>
          <article class="activity-kpi--warning"><span>闲置占比</span><strong>{{ formatPercent(ratio(stats.idleSessions, stats.totalSessions)) }}</strong><small>超过 2 分钟无活动</small><i><b :style="{ width: `${ratio(stats.idleSessions, stats.totalSessions)}%` }" /></i></article>
          <article><span>浏览器来源</span><strong>{{ stats.browsers.length }}</strong><small>{{ primaryBrowserText }}</small><i><b :style="{ width: `${primaryBrowserShare}%` }" /></i></article>
        </section>
      </template>
    </OpsPanel>

    <template v-if="!forbidden && data">
      <section class="activity-analysis-grid">
        <OpsPanel title="会话态势" subtitle="按活跃度与客户端来源识别需要复核的会话。" :status="panelStatus" :updated-at="updatedAt" :refreshable="false">
          <div class="activity-posture">
            <div class="browser-distribution">
              <div class="browser-distribution__heading"><strong>浏览器分布</strong><span>{{ stats.browsers.length }} 类</span></div>
              <div class="browser-distribution__content">
                <div class="browser-donut" :style="browserDonutStyle"><span><strong>{{ stats.activeSessions }}</strong><small>活跃会话</small></span></div>
                <ol>
                  <li v-for="(item, index) in stats.browsers" :key="item.label"><i :style="{ background: chartColors[index % chartColors.length] }" /><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ formatPercent(ratio(item.value, stats.activeSessions)) }}</small></li>
                </ol>
              </div>
            </div>
            <div class="device-distribution">
              <div class="device-distribution__heading"><strong>设备来源</strong><span>{{ stats.devices.length }} 类</span></div>
              <div v-if="stats.devices.length" class="device-distribution__rows">
                <div v-for="item in stats.devices" :key="item.label">
                  <p><span><Icon :name="deviceIcon(item.label)" :size="13" />{{ deviceLabel(item.label) }}</span><strong>{{ item.value }} <small>{{ formatPercent(ratio(item.value, stats.activeSessions)) }}</small></strong></p>
                  <i><b :style="{ width: `${ratio(item.value, stats.activeSessions)}%` }" /></i>
                </div>
              </div>
              <div v-else class="activity-empty">暂无真实采集数据。</div>
            </div>
          </div>
        </OpsPanel>

        <OpsPanel title="处置建议" subtitle="结合当前有效会话状态给出优先处理方向。" :status="recommendationStatus" :updated-at="updatedAt" :refreshable="false">
          <div class="activity-recommendations">
            <article v-for="item in recommendations" :key="item.title" :class="`activity-recommendation--${item.status}`">
              <span><Icon :name="item.icon" :size="15" /></span>
              <div><strong>{{ item.title }}</strong><p>{{ item.detail }}</p></div>
              <em>{{ item.tag }}</em>
            </article>
          </div>
        </OpsPanel>
      </section>

      <div class="activity-filters">
        <label><span>关键词</span><input v-model.trim="filters.keyword" type="search" placeholder="用户名 / 姓名 / IP" @keyup.enter="applyFilters"></label>
        <label><span>会话状态</span><CustomSelect v-model="filters.status" :options="statusOptions" label-key="label" value-key="value" class-name="activity-select" /></label>
        <label><span>设备类型</span><CustomSelect v-model="filters.deviceType" :options="deviceOptions" label-key="label" value-key="value" class-name="activity-select" /></label>
        <div class="activity-filter-actions"><button type="button" @click="resetFilters">重置</button><button type="button" class="activity-button--primary" @click="applyFilters">查询</button></div>
      </div>

      <OpsPanel title="在线会话列表" subtitle="逐条查看账号、角色、来源、设备与最后活动时间；必要时可强制下线。" :status="panelStatus" :updated-at="updatedAt" :pending="loading" :error="Boolean(error)" :empty="!sessions.length && !loading" empty-text="当前筛选范围暂无统计数据。" @refresh="loadSessions(page)">
        <div class="activity-table-wrap">
          <table class="activity-table">
            <thead><tr><th>账号</th><th>角色</th><th>来源 IP</th><th>设备</th><th>浏览器</th><th>状态</th><th>最近页面</th><th>最后活跃</th><th>在线时长</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="session in sessions" :key="session.id">
                <td><strong>{{ session.displayName }}</strong><small>@{{ session.username }}</small></td>
                <td>{{ roleLabel(session.role) }}</td>
                <td class="activity-mono">{{ session.ipAddress }}</td>
                <td>{{ deviceLabel(session.deviceType) }}</td>
                <td>{{ session.browser }}</td>
                <td><span class="activity-session-status" :class="`activity-session-status--${session.status}`">{{ session.status === 'active' ? '活跃' : '闲置' }}</span></td>
                <td class="activity-path" :title="session.lastPath || '--'">{{ session.lastPath || '--' }}</td>
                <td>{{ formatTime(session.lastActiveAt) }}</td>
                <td>{{ sessionDuration(session.startedAt) }}</td>
                <td><button type="button" class="activity-revoke" :disabled="revokingId === session.id" @click="revokeSession(session)"><Icon name="logout" :size="13" />{{ revokingId === session.id ? '处理中' : '强制下线' }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer class="activity-pagination">
          <span>共 {{ pagination.total }} 条</span>
          <div><button type="button" :disabled="page <= 1 || loading" @click="loadSessions(page - 1)">上一页</button><strong>{{ page }} / {{ pagination.totalPages || 1 }}</strong><button type="button" :disabled="page >= pagination.totalPages || loading" @click="loadSessions(page + 1)">下一页</button></div>
        </footer>
      </OpsPanel>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Icon from '~/components/UI/Icon.vue'
import OpsPanel from '~/components/Admin/Ops/OpsPanel.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useServerErrors } from '~/composables/useLocaleText'

const props = defineProps({ refreshToken: { type: Number, default: 0 } })
const { localize } = useServerErrors()
const data = ref(null)
const loading = ref(false)
const error = ref('')
const forbidden = ref(false)
const page = ref(1)
const revokingId = ref('')
const filters = ref({ keyword: '', status: '', deviceType: '' })
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
let requestVersion = 0

const chartColors = ['#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#94a3b8']
const statusOptions = [{ label: '全部状态', value: '' }, { label: '活跃', value: 'active' }, { label: '闲置', value: 'idle' }]
const deviceOptions = [{ label: '全部设备', value: '' }, { label: '桌面端', value: 'desktop' }, { label: '移动端', value: 'mobile' }, { label: '平板', value: 'tablet' }, { label: '其他', value: 'unknown' }]
const stats = computed(() => data.value?.stats || { totalSessions: 0, activeSessions: 0, idleSessions: 0, onlineUsers: 0, browsers: [], devices: [] })
const sessions = computed(() => data.value?.sessions || [])
const updatedAt = computed(() => data.value?.collectedAt ? `采样时间 ${formatTime(data.value.collectedAt)}` : '尚未采集')
const panelStatus = computed(() => {
  if (!data.value) return 'unknown'
  if (!stats.value.totalSessions) return 'ok'
  return ratio(stats.value.idleSessions, stats.value.totalSessions) >= 80 ? 'warning' : 'ok'
})
const recommendationStatus = computed(() => recommendations.value.some((item) => item.status === 'warning') ? 'warning' : 'ok')
const primaryBrowser = computed(() => stats.value.browsers[0] || null)
const primaryBrowserShare = computed(() => ratio(primaryBrowser.value?.value || 0, stats.value.activeSessions))
const primaryBrowserText = computed(() => primaryBrowser.value ? `主力 ${primaryBrowser.value.label}，占 ${formatPercent(primaryBrowserShare.value)}` : '暂无浏览器数据')
const browserDonutStyle = computed(() => {
  if (!stats.value.activeSessions || !stats.value.browsers.length) return { background: 'rgba(148,163,184,.12)' }
  let cursor = 0
  const segments = stats.value.browsers.map((item, index) => {
    const start = cursor
    cursor += ratio(item.value, stats.value.activeSessions)
    return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`
  })
  return { background: `conic-gradient(${segments.join(', ')})` }
})
const recommendations = computed(() => {
  const items = []
  if (stats.value.idleSessions > 0) items.push({ icon: 'clock', status: ratio(stats.value.idleSessions, stats.value.totalSessions) >= 50 ? 'warning' : 'unknown', title: '复核长期闲置会话', detail: `当前有 ${stats.value.idleSessions} 个有效会话超过 2 分钟无活动，可结合在线时长逐条确认。`, tag: `${stats.value.idleSessions} 个待关注` })
  if (stats.value.totalSessions > stats.value.onlineUsers) items.push({ icon: 'users', status: 'warning', title: '检查账号多会话', detail: '同一账号存在多个有效会话时，应复核是否为正常的跨设备登录。', tag: '建议复核' })
  const unknownClients = stats.value.browsers.find((item) => item.label === 'Unknown')?.value || 0
  if (unknownClients) items.push({ icon: 'warning', status: 'unknown', title: '识别未知客户端', detail: `有 ${unknownClients} 个会话无法识别浏览器，可结合脱敏 IP 与最近页面继续排查。`, tag: '信息不足' })
  if (!items.length) items.push({ icon: 'success', status: 'ok', title: '当前无需处置', detail: '未发现闲置、多会话或未知客户端信号，继续观察即可。', tag: '状态正常' })
  return items
})

const ratio = (value, total) => total > 0 ? Math.min(100, Math.max(0, Number(value || 0) / Number(total) * 100)) : 0
const formatPercent = (value) => `${Number(value || 0).toFixed(1).replace(/\.0$/, '')}%`
const formatTime = (value) => value ? new Date(value).toLocaleString() : '--'
const sessionDuration = (startedAt) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时 ${Math.floor(seconds % 3600 / 60)} 分钟`
  return `${Math.floor(seconds / 86400)} 天 ${Math.floor(seconds % 86400 / 3600)} 小时`
}
const deviceLabel = (value) => ({ desktop: '桌面端', mobile: '移动端', tablet: '平板', bot: '自动客户端', unknown: '未知设备' }[value] || value || '未知设备')
const deviceIcon = (value) => value === 'bot' ? 'activity' : value === 'unknown' ? 'warning' : 'monitoring'
const roleLabel = (value) => ({ SUPER_ADMIN: '超级管理员', ADMIN: '管理员', SONG_ADMIN: '点歌管理员', USER: '用户' }[value] || value)

const loadSessions = async (targetPage = 1) => {
  const version = ++requestVersion
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch('/api/admin/user-activity', {
      query: { page: targetPage, limit: 20, ...filters.value }
    })
    if (version !== requestVersion) return
    data.value = response
    pagination.value = response.pagination
    page.value = response.pagination.page
    forbidden.value = false
  } catch (requestError) {
    if (version !== requestVersion) return
    if (requestError?.statusCode === 403) {
      forbidden.value = true
      data.value = null
    } else {
      error.value = localize(requestError, '用户活动记录暂时无法读取。')
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

const applyFilters = () => loadSessions(1)
const resetFilters = () => {
  filters.value = { keyword: '', status: '', deviceType: '' }
  void loadSessions(1)
}
const revokeSession = async (session) => {
  if (!window.confirm(`确定强制下线 ${session.displayName} 的当前会话吗？`)) return
  revokingId.value = session.id
  try {
    await $fetch(`/api/admin/user-activity/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' })
    await loadSessions(page.value)
  } catch (requestError) {
    error.value = localize(requestError, '强制下线失败。')
  } finally {
    revokingId.value = ''
  }
}

watch(() => props.refreshToken, () => void loadSessions(page.value), { immediate: true })
</script>

<style scoped>
.user-activity-panel { display: grid; gap: .75rem; color: var(--ops-text-1, #e5e7eb); }
.activity-permission, .activity-empty { display: flex; min-height: 5rem; align-items: center; justify-content: center; color: var(--ops-text-2, #94a3b8); font-size: .75rem; }
.activity-inline-summary { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; margin-bottom: .75rem; }
.activity-inline-summary span { display: inline-flex; height: 1.875rem; align-items: center; gap: .35rem; border: 1px solid var(--ops-line); border-radius: 6px; padding: 0 .6rem; color: var(--ops-text-2); background: #0e1217; font-size: .6875rem; }
.activity-inline-summary strong { color: var(--ops-text-1); font-family: var(--ops-mono); }
.activity-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .65rem; }
.activity-kpis article { --activity-accent: var(--ops-info); display: flex; min-height: 7.5rem; flex-direction: column; border: 1px solid var(--ops-line); border-radius: 6px; padding: .8rem; background: #0e1217; }
.activity-kpis article:nth-child(2) { --activity-accent: var(--ops-ok); }.activity-kpis article:nth-child(3) { --activity-accent: var(--ops-warning); }.activity-kpis article:nth-child(4) { --activity-accent: var(--ops-unknown); }
.activity-kpis span, .activity-kpis small { color: var(--ops-text-2); font-size: .6875rem; }.activity-kpis strong { margin-top: .6rem; color: var(--ops-text-1); font-family: var(--ops-mono); font-size: 1.5rem; font-weight: 650; }.activity-kpis small { margin-top: .35rem; }.activity-kpis > article > i { height: .3rem; margin-top: auto; overflow: hidden; border-radius: 3px; background: rgba(148,163,184,.1); }.activity-kpis b { display: block; height: 100%; background: var(--activity-accent); }
.activity-analysis-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: .75rem; }
.activity-posture { display: grid; grid-template-columns: minmax(0, 1fr); gap: .75rem; }
.browser-distribution, .device-distribution { min-width: 0; border: 1px solid var(--ops-line); border-radius: 6px; padding: .8rem; background: #0e1217; }
.browser-distribution__heading, .device-distribution__heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }.browser-distribution__heading strong, .device-distribution__heading strong { font-size: .75rem; }.browser-distribution__heading span, .device-distribution__heading span { color: var(--ops-info); font-size: .625rem; }
.browser-distribution__content { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr); align-items: center; gap: .8rem; margin-top: 1rem; }.browser-donut { display: grid; width: 6rem; height: 6rem; place-items: center; border-radius: 50%; }.browser-donut > span { display: flex; width: 4.3rem; height: 4.3rem; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%; background: #0e1217; }.browser-donut strong { font-family: var(--ops-mono); font-size: 1rem; }.browser-donut small { color: var(--ops-text-2); font-size: .6rem; }.browser-distribution ol { display: grid; gap: .5rem; margin: 0; padding: 0; list-style: none; }.browser-distribution li { display: grid; grid-template-columns: .45rem minmax(0, 1fr) auto auto; align-items: center; gap: .4rem; font-size: .65rem; }.browser-distribution li i { width: .4rem; height: .4rem; border-radius: 50%; }.browser-distribution li span, .browser-distribution li small { color: var(--ops-text-2); }.browser-distribution li strong { font-family: var(--ops-mono); }
.device-distribution__rows { display: grid; gap: 1rem; margin-top: 1rem; }.device-distribution__rows p { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin: 0; font-size: .7rem; }.device-distribution__rows p span { display: inline-flex; align-items: center; gap: .4rem; color: var(--ops-text-2); }.device-distribution__rows p strong { font-family: var(--ops-mono); }.device-distribution__rows p small { color: var(--ops-text-2); font-weight: 500; }.device-distribution__rows > div > i { display: block; height: .35rem; margin-top: .55rem; overflow: hidden; border-radius: 3px; background: rgba(148,163,184,.1); }.device-distribution__rows b { display: block; height: 100%; background: var(--ops-info); }
.activity-recommendations { display: grid; gap: .65rem; }.activity-recommendations article { display: grid; grid-template-columns: 2rem minmax(0, 1fr) auto; align-items: center; gap: .7rem; border: 1px solid var(--ops-line); border-radius: 6px; padding: .7rem; background: #0e1217; }.activity-recommendations article > span { display: inline-flex; width: 2rem; height: 2rem; align-items: center; justify-content: center; border-radius: 4px; color: var(--ops-unknown); background: rgba(148,163,184,.08); }.activity-recommendations strong { font-size: .72rem; }.activity-recommendations p { margin: .3rem 0 0; color: var(--ops-text-2); font-size: .64rem; line-height: 1.5; }.activity-recommendations em { border: 1px solid var(--ops-line); border-radius: 4px; padding: .22rem .35rem; color: var(--ops-text-2); font-size: .6rem; font-style: normal; }.activity-recommendation--warning > span { color: var(--ops-warning) !important; background: color-mix(in srgb,var(--ops-warning) 8%,transparent) !important; }.activity-recommendation--warning em { border-color: color-mix(in srgb,var(--ops-warning) 30%,transparent); color: var(--ops-warning); }.activity-recommendation--ok > span { color: var(--ops-ok) !important; }
.activity-filters { display: grid; grid-template-columns: minmax(0, 1fr); gap: .65rem; border: 1px solid var(--ops-line); border-radius: 6px; padding: .75rem; background: var(--ops-panel); }.activity-filters label { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr); align-items: center; gap: .5rem; color: var(--ops-text-2); font-size: .6875rem; }.activity-filters input { width: 100%; height: 1.875rem; border: 1px solid var(--ops-line); border-radius: 6px; padding: 0 .6rem; outline: none; color: var(--ops-text-1); background: #0e1217; font-size: .7rem; }.activity-filters input:focus { border-color: rgba(34,211,238,.5); }.activity-select { min-width: 0; }.activity-filter-actions { display: flex; justify-content: flex-end; gap: .5rem; }.activity-filter-actions button { height: 1.875rem; border: 1px solid var(--ops-line); border-radius: 6px; padding: 0 .75rem; color: var(--ops-text-1); background: #0e1217; font-size: .7rem; cursor: pointer; }.activity-filter-actions button:hover { border-color: rgba(34,211,238,.5); }.activity-filter-actions .activity-button--primary { border-color: rgba(34,211,238,.5); color: var(--ops-info); }
:deep(.activity-select > div) { min-height: 1.875rem; height: 1.875rem; border-color: var(--ops-line); border-radius: 6px; padding: 0 .6rem; background: #0e1217; }:deep(.activity-select > div:hover) { border-color: rgba(34,211,238,.5); }
.activity-table-wrap { overflow-x: auto; }.activity-table { width: 100%; min-width: 1050px; border-collapse: collapse; }.activity-table th { border-bottom: 1px solid var(--ops-line); padding: .65rem .55rem; color: var(--ops-text-2); font-size: .64rem; font-weight: 600; text-align: left; white-space: nowrap; }.activity-table td { max-width: 12rem; border-bottom: 1px solid rgba(148,163,184,.08); padding: .65rem .55rem; color: var(--ops-text-1); font-size: .68rem; }.activity-table td > strong, .activity-table td > small { display: block; }.activity-table td > small { margin-top: .2rem; color: var(--ops-text-2); }.activity-mono { font-family: var(--ops-mono); }.activity-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.activity-session-status { display: inline-flex; border: 1px solid var(--ops-line); border-radius: 4px; padding: .2rem .35rem; color: var(--ops-text-2); }.activity-session-status--active { border-color: color-mix(in srgb,var(--ops-ok) 30%,transparent); color: var(--ops-ok); background: color-mix(in srgb,var(--ops-ok) 8%,transparent); }.activity-session-status--idle { border-color: color-mix(in srgb,var(--ops-warning) 30%,transparent); color: var(--ops-warning); background: color-mix(in srgb,var(--ops-warning) 8%,transparent); }.activity-revoke { display: inline-flex; height: 1.75rem; align-items: center; gap: .3rem; border: 1px solid color-mix(in srgb,var(--ops-error) 30%,transparent); border-radius: 5px; padding: 0 .45rem; color: var(--ops-error); background: color-mix(in srgb,var(--ops-error) 7%,#0e1217); font-size: .64rem; cursor: pointer; }.activity-revoke:disabled { cursor: not-allowed; opacity: .5; }
.activity-pagination { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-top: .75rem; color: var(--ops-text-2); font-size: .68rem; }.activity-pagination div { display: flex; align-items: center; gap: .5rem; }.activity-pagination button { height: 1.75rem; border: 1px solid var(--ops-line); border-radius: 5px; padding: 0 .5rem; color: var(--ops-text-1); background: #0e1217; font-size: .65rem; cursor: pointer; }.activity-pagination button:disabled { cursor: not-allowed; opacity: .4; }.activity-pagination strong { color: var(--ops-text-1); font-family: var(--ops-mono); }
@media (min-width: 768px) { .activity-posture { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }.activity-filters { grid-template-columns: minmax(13rem, 1.2fr) minmax(10rem, .8fr) minmax(10rem, .8fr) auto; }.activity-filters label { grid-template-columns: auto minmax(0, 1fr); } }
@media (min-width: 1280px) { .activity-analysis-grid { grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr); } }
</style>
