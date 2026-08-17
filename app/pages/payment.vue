<template>
  <div class="min-h-screen bg-bg-primary text-text-primary">
    <header class="border-b border-border-secondary bg-bg-primary-90">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <NuxtLink to="/" class="flex items-center gap-2 font-black"><ArrowLeft :size="18" /> VoiceHub</NuxtLink>
        <h1 class="text-lg font-black">{{ locale.title }}</h1>
        <NuxtLink to="/account" class="p-2 text-text-tertiary" :title="common.account"><User :size="19" /></NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-8">
      <div class="mb-7 flex overflow-x-auto border-b border-border-secondary">
        <button v-for="tab in tabs" :key="tab.id" class="min-w-28 border-b-2 px-4 py-3 text-sm font-bold transition-colors" :class="activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-text-tertiary'" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-20"><AppSpinner :label="common.loading" /></div>
      <div v-else-if="errorMessage" class="rounded-lg border border-error-30 bg-error-10 p-4 text-sm text-error">{{ errorMessage }}</div>

      <section v-else-if="activeTab === 'plans'">
        <div v-if="!config.enabled" class="py-20 text-center text-text-tertiary">{{ locale.disabled }}</div>
        <div v-else-if="!plans.length" class="py-20 text-center text-text-tertiary">{{ locale.emptyPlans }}</div>
        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article v-for="plan in plans" :key="plan.id" class="rounded-lg border border-border-secondary bg-bg-secondary p-5">
            <div class="mb-5 flex items-start justify-between gap-4">
              <div><h2 class="text-lg font-black">{{ plan.name }}</h2><p class="mt-1 text-sm text-text-tertiary">{{ plan.description }}</p></div>
              <Ticket class="shrink-0 text-primary" :size="24" />
            </div>
            <div class="mb-4 flex items-baseline gap-2"><span class="text-3xl font-black">{{ formatMoney(plan.priceCents, plan.currency) }}</span><span v-if="plan.originalPriceCents" class="text-sm text-text-disabled line-through">{{ formatMoney(plan.originalPriceCents, plan.currency) }}</span></div>
            <p class="mb-4 text-sm text-text-secondary">{{ locale.cardsCount }}：<b>{{ plan.cardCount }}</b></p>
            <ul v-if="plan.features?.length" class="mb-5 space-y-2 text-sm text-text-tertiary"><li v-for="feature in plan.features" :key="feature" class="flex gap-2"><Check :size="16" class="mt-0.5 shrink-0 text-success" />{{ feature }}</li></ul>
            <CustomSelect v-model="selectedMethods[plan.id]" :options="methodOptions" class="mb-3" />
            <button class="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-50" :disabled="creatingId === plan.id || !selectedMethods[plan.id]" @click="buy(plan)">
              <RefreshCw v-if="creatingId === plan.id" :size="16" class="animate-spin" /><CreditCard v-else :size="16" />{{ locale.buy }}
            </button>
          </article>
        </div>
        <p v-if="config.helpText" class="mt-6 whitespace-pre-wrap rounded-lg border border-border-secondary bg-bg-secondary p-4 text-sm text-text-tertiary">{{ config.helpText }}</p>
      </section>

      <section v-else-if="activeTab === 'orders'" class="space-y-3">
        <div v-if="!orders.length" class="py-20 text-center text-text-tertiary">{{ locale.noOrders }}</div>
        <article v-for="order in orders" :key="order.id" class="rounded-lg border border-border-secondary bg-bg-secondary p-4">
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

      <section v-else class="space-y-3">
        <div v-if="!cards.length" class="py-20 text-center text-text-tertiary">{{ locale.noCards }}</div>
        <article v-for="card in cards" :key="card.id" class="flex items-center justify-between gap-3 rounded-lg border border-border-secondary bg-bg-secondary p-4">
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
.action-button { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.25rem; padding: 0 .8rem; border: 1px solid var(--border-secondary); border-radius: .5rem; font-size: .75rem; font-weight: 700; }
.action-primary { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.25rem; padding: 0 .8rem; border-radius: .5rem; background: var(--primary); color: white; font-size: .75rem; font-weight: 700; }
</style>
