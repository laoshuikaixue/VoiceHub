<template>
  <div class="payment-page min-h-screen bg-bg-primary text-text-primary">
    <header class="payment-header border-b border-border-secondary bg-bg-primary-90">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <NuxtLink to="/" class="flex items-center gap-2 font-black"><ArrowLeft :size="18" /> VoiceHub</NuxtLink>
        <h1 class="text-lg font-black">{{ locale.title }}</h1>
        <NuxtLink to="/account" class="p-2 text-text-tertiary" :title="common.account"><User :size="19" /></NuxtLink>
      </div>
    </header>

    <main class="payment-main mx-auto max-w-6xl px-4 py-8">
      <div class="payment-intro"><div><p class="payment-eyebrow">VoiceHub</p><h1>{{ locale.title }}</h1><p>选择适合你的点歌券套餐，支付完成后自动发放。</p></div><div class="payment-intro-icon"><Ticket :size="25" /></div></div>
      <div class="payment-tabs mb-7 flex overflow-x-auto">
        <button v-for="tab in tabs" :key="tab.id" class="payment-tab" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-20"><AppSpinner :label="common.loading" /></div>
      <div v-else-if="errorMessage" class="rounded-lg border border-error-30 bg-error-10 p-4 text-sm text-error">{{ errorMessage }}</div>

      <section v-else-if="activeTab === 'plans'">
        <div v-if="!config.enabled" class="py-20 text-center text-text-tertiary">{{ locale.disabled }}</div>
        <div v-else-if="!plans.length" class="py-20 text-center text-text-tertiary">{{ locale.emptyPlans }}</div>
        <div v-else class="plan-grid">
          <article v-for="plan in plans" :key="plan.id" class="plan-card">
            <div class="plan-card-top"><div class="plan-card-title"><span class="plan-icon"><Ticket :size="18" /></span><div><h2>{{ plan.name }}</h2><p>{{ plan.description || '灵活购买点歌券' }}</p></div></div><span class="plan-badge">{{ plan.cardCount }} {{ locale.cardsCount }}</span></div>
            <div class="plan-price"><span>{{ formatMoney(plan.priceCents, plan.currency) }}</span><del v-if="plan.originalPriceCents">{{ formatMoney(plan.originalPriceCents, plan.currency) }}</del></div>
            <div class="plan-divider" />
            <div class="plan-benefit"><Check :size="16" /><span>{{ locale.cardsCount }} <b>{{ plan.cardCount }}</b></span></div>
            <ul v-if="plan.features?.length" class="plan-features"><li v-for="feature in plan.features" :key="feature"><Check :size="15" />{{ feature }}</li></ul>
            <div class="plan-buy"><label>支付方式</label><CustomSelect v-model="selectedMethods[plan.id]" :options="methodOptions" /><button class="buy-button" :disabled="creatingId === plan.id || !selectedMethods[plan.id]" @click="buy(plan)"><RefreshCw v-if="creatingId === plan.id" :size="16" class="animate-spin" /><CreditCard v-else :size="16" />{{ locale.buy }}</button></div>
          </article>
        </div>
        <p v-if="config.helpText" class="payment-help mt-6 whitespace-pre-wrap">{{ config.helpText }}</p>
      </section>

      <section v-else-if="activeTab === 'orders'" class="payment-list">
        <div v-if="!orders.length" class="py-20 text-center text-text-tertiary">{{ locale.noOrders }}</div>
        <article v-for="order in orders" :key="order.id" class="order-card">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div><h2 class="font-black">{{ order.planName }}</h2><p class="mt-1 font-mono text-xs text-text-disabled">{{ order.outTradeNo }}</p></div>
            <span class="rounded-full border px-2.5 py-1 text-xs font-bold" :class="statusClass(order.status)">{{ statusText(order.status) }}</span>
          </div>
          <div class="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border-secondary pt-4">
            <div><p class="text-xs text-text-tertiary">{{ formatDate(order.createdAt) }}</p><p class="mt-1 text-lg font-black">{{ formatMoney(order.payAmountCents, order.currency) }}</p></div>
            <div class="flex flex-wrap gap-2">
              <button v-if="order.status === 'PENDING' && order.payUrl" class="action-primary" @click="openPay(order)"><ExternalLink :size="15" />{{ locale.payNow }}</button>
              <button v-if="['PENDING','PAID','FAILED','EXPIRED'].includes(order.status)" class="action-button" @click="verify(order)"><RefreshCw :size="15" />{{ locale.verify }}</button>
              <button v-if="order.status === 'PENDING'" class="action-button text-error" @click="cancelOrder(order)"><X :size="15" />{{ locale.cancel }}</button>
              <button v-if="order.status === 'COMPLETED'" class="action-button" @click="startRefund(order)"><Undo2 :size="15" />{{ locale.refund }}</button>
            </div>
          </div>
        </article>
      </section>

      <section v-else class="payment-list">
        <div v-if="!cards.length" class="py-20 text-center text-text-tertiary">{{ locale.noCards }}</div>
        <article v-for="card in cards" :key="card.id" class="card-code-card">
          <div><p class="text-xs text-text-tertiary">{{ locale.cardCode }}</p><code class="mt-1 block break-all text-base font-black text-primary">{{ card.code }}</code></div>
          <button class="shrink-0 p-2 text-text-tertiary hover:text-primary" :title="locale.copy" @click="copyCard(card.code)"><Copy :size="18" /></button>
        </article>
      </section>
    </main>

    <Teleport to="body">
      <div v-if="qrOrder" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" @click.self="closeQr">
        <div class="w-full max-w-sm rounded-lg bg-bg-primary p-6 text-center shadow-xl">
          <button class="ml-auto block p-2 text-text-tertiary" @click="closeQr"><X :size="18" /></button>
          <h2 class="mb-4 font-black">{{ qrOrder.planName }}</h2>
          <img v-if="qrImage" :src="qrImage" alt="Payment QR code" class="mx-auto h-64 w-64 rounded-lg bg-white p-3" />
          <AppSpinner v-else :label="common.loading" />
          <p class="mt-4 text-sm text-text-tertiary">{{ locale.paymentHint }}</p>
        </div>
      </div>
      <div v-if="refundOrder" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" @click.self="refundOrder = null">
        <div class="w-full max-w-md rounded-lg bg-bg-primary p-6"><h2 class="font-black">{{ locale.refund }}</h2><label class="mt-4 block text-sm font-bold">{{ locale.refundReason }}</label><textarea v-model="refundReason" rows="4" class="mt-2 w-full rounded-lg border border-border-secondary bg-bg-secondary p-3 text-sm" :placeholder="locale.refundReasonPlaceholder" /><div class="mt-4 flex justify-end gap-2"><button class="action-button" @click="refundOrder = null">{{ common.cancel }}</button><button class="action-primary" @click="submitRefund">{{ locale.confirmRefund }}</button></div></div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import QRCode from 'qrcode'
import { ArrowLeft, Check, Copy, CreditCard, ExternalLink, RefreshCw, Ticket, Undo2, User, X } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'

const sections = useLocale(); const locale = computed(() => sections.payment.value); const common = computed(() => sections.common.value)
const { localize } = useServerErrors()
const config = ref({ enabled: false, methods: [] }); const plans = ref([]); const orders = ref([]); const cards = ref([])
const selectedMethods = reactive({}); const loading = ref(true); const errorMessage = ref(''); const activeTab = ref('plans'); const creatingId = ref(null)
const qrOrder = ref(null); const qrImage = ref(''); const refundOrder = ref(null); const refundReason = ref(''); let pollTimer = null
const tabs = computed(() => [{ id: 'plans', label: locale.value.title }, { id: 'orders', label: locale.value.orders }, { id: 'cards', label: locale.value.cards }])
const methodLabels = { alipay: '支付宝', wxpay: '微信支付', stripe: 'Stripe', airwallex: 'Airwallex' }
const methodOptions = computed(() => config.value.methods.map(value => ({ value, label: methodLabels[value] || value })))
const formatMoney = (cents, currency = 'CNY') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
const formatDate = value => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusText = status => ({ PENDING: locale.value.pending, PAID: locale.value.paid, COMPLETED: locale.value.completed, EXPIRED: locale.value.expired, CANCELLED: locale.value.cancelled, FAILED: locale.value.failed, REFUND_REQUESTED: locale.value.refundRequested, REFUNDING: locale.value.refunding, REFUNDED: locale.value.refunded }[status] || status)
const statusClass = status => status === 'COMPLETED' ? 'border-success-30 bg-success-10 text-success' : ['FAILED','EXPIRED','CANCELLED'].includes(status) ? 'border-error-30 bg-error-10 text-error' : 'border-warning-30 bg-warning-10 text-warning'

const loadOrders = async () => {
  orders.value = await $fetch('/api/payment/orders')
  const details = await Promise.all(orders.value.filter(order => order.status === 'COMPLETED').map(order => $fetch(`/api/payment/orders/${order.id}`).catch(() => ({ cards: [] }))))
  cards.value = details.flatMap(item => item.cards || [])
}
const load = async () => {
  try {
    const [paymentConfig, paymentPlans] = await Promise.all([$fetch('/api/payment/config'), $fetch('/api/payment/plans')])
    config.value = paymentConfig; plans.value = paymentPlans
    for (const plan of plans.value) selectedMethods[plan.id] = config.value.methods[0] || ''
    await loadOrders()
  } catch (error) { errorMessage.value = localize(error, common.value.loadFailed) } finally { loading.value = false }
}
const openPay = async order => {
  if (order.payUrl) { window.location.assign(order.payUrl); return }
  if (order.qrCode) { qrOrder.value = order; qrImage.value = await QRCode.toDataURL(order.qrCode, { width: 320, margin: 1 }); startPolling(order); return }
  if (order.clientSecret && order.paymentMethod === 'airwallex') {
    const data = order.providerData || {}; const sdk = await import('@airwallex/components-sdk'); const initialized = await sdk.init({ env: data.environment === 'prod' ? 'prod' : 'demo', enabledElements: ['payments'], locale: navigator.language.startsWith('zh') ? 'zh' : 'en' })
    initialized.payments?.redirectToCheckout({ intent_id: order.paymentTradeNo, client_secret: order.clientSecret, currency: data.currency || order.currency, country_code: data.countryCode || 'CN', successUrl: `${location.origin}/payment/result?order=${order.id}` })
  }
}
const buy = async plan => { creatingId.value = plan.id; try { const order = await $fetch('/api/payment/orders', { method: 'POST', body: { planId: plan.id, method: selectedMethods[plan.id], mobile: matchMedia('(max-width: 768px)').matches } }); orders.value.unshift(order); await openPay(order) } catch (error) { errorMessage.value = localize(error, locale.value.createFailed) } finally { creatingId.value = null } }
const verify = async order => { try { await $fetch(`/api/payment/orders/${order.id}/verify`, { method: 'POST' }); await loadOrders(); if (orders.value.find(item => item.id === order.id)?.status === 'COMPLETED') closeQr() } catch (error) { errorMessage.value = localize(error) } }
const cancelOrder = async order => { try { await $fetch(`/api/payment/orders/${order.id}/cancel`, { method: 'POST' }); await loadOrders() } catch (error) { errorMessage.value = localize(error) } }
const startRefund = order => { refundOrder.value = order; refundReason.value = '' }
const submitRefund = async () => { try { await $fetch(`/api/payment/orders/${refundOrder.value.id}/refund`, { method: 'POST', body: { reason: refundReason.value } }); refundOrder.value = null; await loadOrders() } catch (error) { errorMessage.value = localize(error) } }
const copyCard = async code => navigator.clipboard.writeText(code)
const startPolling = order => { clearInterval(pollTimer); pollTimer = setInterval(() => verify(order), 3000) }
const closeQr = () => { qrOrder.value = null; qrImage.value = ''; clearInterval(pollTimer) }
onMounted(load); onUnmounted(() => clearInterval(pollTimer))
</script>

<style scoped>
.payment-header { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(14px); }
.payment-header a { color: var(--text-secondary); transition: color .2s; }
.payment-header a:hover { color: var(--primary); }
.payment-main { min-height: calc(100vh - 73px); }
.payment-intro { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.7rem; padding: 1.35rem 1.5rem; border: 1px solid var(--border-secondary); border-radius: .85rem; background: linear-gradient(120deg, var(--bg-secondary), var(--bg-tertiary-30)); box-shadow: var(--shadow-sm); }
.payment-intro h1 { margin: .15rem 0 .35rem; color: var(--text-primary); font-size: 1.35rem; font-weight: 850; letter-spacing: 0; }
.payment-intro p:last-child { color: var(--text-tertiary); font-size: .78rem; }
.payment-eyebrow { color: var(--primary); font-size: .68rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.payment-intro-icon { display: flex; width: 3.1rem; height: 3.1rem; align-items: center; justify-content: center; border-radius: .7rem; background: var(--primary-10); color: var(--primary); }
.payment-tabs { gap: .3rem; padding: .3rem; border: 1px solid var(--border-secondary); border-radius: .75rem; background: var(--bg-secondary); }
.payment-tab { min-width: 6.8rem; min-height: 2.45rem; padding: 0 1rem; border: 1px solid transparent; border-radius: .55rem; color: var(--text-tertiary); font-size: .78rem; font-weight: 750; white-space: nowrap; transition: color .2s, background .2s, border-color .2s; }
.payment-tab:hover { color: var(--text-primary); background: var(--bg-hover); }
.payment-tab.active { border-color: var(--primary); background: var(--bg-primary); color: var(--primary); box-shadow: var(--shadow-sm); }
.plan-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.plan-card { display: flex; min-width: 0; flex-direction: column; padding: 1.25rem; border: 1px solid var(--border-secondary); border-radius: .8rem; background: var(--bg-secondary); box-shadow: var(--shadow-sm); transition: transform .2s, border-color .2s, box-shadow .2s; }
.plan-card:hover { transform: translateY(-2px); border-color: var(--primary); box-shadow: var(--shadow-md); }
.plan-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; min-height: 3.3rem; }
.plan-card-title { display: flex; min-width: 0; align-items: center; gap: .65rem; }
.plan-card-title h2 { overflow: hidden; color: var(--text-primary); font-size: .95rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.plan-card-title p { margin-top: .25rem; overflow: hidden; color: var(--text-tertiary); font-size: .7rem; text-overflow: ellipsis; white-space: nowrap; }
.plan-icon { display: flex; width: 2.15rem; height: 2.15rem; flex: none; align-items: center; justify-content: center; border-radius: .55rem; background: var(--primary-10); color: var(--primary); }
.plan-badge { max-width: 7rem; border: 1px solid var(--border-secondary); border-radius: 999px; padding: .25rem .5rem; color: var(--text-tertiary); font-size: .62rem; font-weight: 700; white-space: nowrap; }
.plan-price { display: flex; align-items: baseline; gap: .55rem; margin-top: 1.1rem; }
.plan-price span { color: var(--text-primary); font-size: 1.8rem; font-weight: 900; letter-spacing: 0; }
.plan-price del { color: var(--text-disabled); font-size: .72rem; }
.plan-divider { height: 1px; margin: 1rem 0 .85rem; background: var(--border-secondary); }
.plan-benefit { display: flex; align-items: center; gap: .45rem; color: var(--text-secondary); font-size: .76rem; }
.plan-benefit svg { color: var(--success); }
.plan-benefit b { color: var(--text-primary); }
.plan-features { display: grid; gap: .45rem; margin-top: .8rem; color: var(--text-tertiary); font-size: .72rem; }
.plan-features li { display: flex; align-items: flex-start; gap: .4rem; }
.plan-features svg { flex: none; margin-top: .08rem; color: var(--success); }
.plan-buy { display: grid; gap: .45rem; margin-top: auto; padding-top: 1.15rem; }
.plan-buy label { color: var(--text-tertiary); font-size: .68rem; font-weight: 700; }
.buy-button { display: inline-flex; min-height: 2.55rem; align-items: center; justify-content: center; gap: .4rem; margin-top: .15rem; border-radius: .55rem; background: var(--primary); color: white; font-size: .78rem; font-weight: 800; transition: filter .2s, transform .2s; }
.buy-button:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.buy-button:disabled { cursor: not-allowed; opacity: .45; }
.payment-help { padding: .85rem 1rem; border: 1px solid var(--border-secondary); border-radius: .65rem; background: var(--bg-secondary); color: var(--text-tertiary); font-size: .74rem; line-height: 1.65; }
.payment-list { display: grid; gap: .75rem; }
.order-card,.card-code-card { border: 1px solid var(--border-secondary); border-radius: .75rem; background: var(--bg-secondary); box-shadow: var(--shadow-sm); }
.order-card { padding: 1rem; }
.card-code-card { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: 1rem; }
.card-code-card code { font-size: .9rem; }
.action-button { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.25rem; padding: 0 .8rem; border: 1px solid var(--border-secondary); border-radius: .5rem; background: var(--bg-primary); color: var(--text-secondary); font-size: .75rem; font-weight: 700; transition: border-color .2s, color .2s, background .2s; }
.action-button:hover { border-color: var(--primary); color: var(--primary); background: var(--bg-hover); }
.action-primary { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.25rem; padding: 0 .8rem; border-radius: .5rem; background: var(--primary); color: white; font-size: .75rem; font-weight: 700; }
@media (max-width: 900px) { .plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .payment-main { padding-top: 1.25rem; } .payment-intro { padding: 1rem; } .payment-intro-icon { width: 2.5rem; height: 2.5rem; } .plan-grid { grid-template-columns: 1fr; } .plan-card:hover { transform: none; } .order-card .border-t { align-items: flex-start; flex-direction: column; } .order-card .border-t > div:last-child { width: 100%; } .order-card .border-t button { flex: 1; justify-content: center; } }
:global(:root[data-theme='ClassicDark']) .payment-intro { background: var(--bg-secondary); }
</style>
