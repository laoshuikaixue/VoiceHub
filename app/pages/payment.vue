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
      <section v-if="resultOrder" class="payment-result-panel">
        <div class="result-icon" :class="resultOrder.status === 'COMPLETED' ? 'success' : resultOrder.status === 'EXPIRED' ? 'expired' : resultOrder.status === 'CANCELLED' ? 'cancelled' : 'failed'"><Check v-if="resultOrder.status === 'COMPLETED'" :size="34" /><Clock3 v-else-if="resultOrder.status === 'EXPIRED'" :size="34" /><X v-else :size="34" /></div>
        <h2>{{ resultOrder.status === 'COMPLETED' ? '支付成功' : resultOrder.status === 'EXPIRED' ? '订单已过期' : resultOrder.status === 'CANCELLED' ? '订单已取消' : '支付失败' }}</h2>
        <p v-if="resultOrder.status === 'EXPIRED'" class="result-message">订单已超时，请重新创建订单</p>
        <p v-else-if="resultOrder.status === 'CANCELLED'" class="result-message">您已取消本次支付</p>
        <div class="result-details"><div><span>订单 ID</span><b>#{{ resultOrder.id }}</b></div><div><span>订单编号</span><b>{{ resultOrder.outTradeNo }}</b></div><div><span>充值金额</span><b>{{ formatMoney(resultOrder.payAmountCents, resultOrder.currency) }}</b></div><div><span>支付方式</span><b>{{ methodLabels[resultOrder.paymentMethod] || resultOrder.paymentMethod }}</b></div><div><span>状态</span><b>{{ statusText(resultOrder.status) }}</b></div></div>
        <div class="result-actions"><button class="action-primary" @click="closeResult(false)">确认</button><button v-if="resultOrder.status !== 'EXPIRED' && resultOrder.status !== 'CANCELLED'" class="action-button" @click="closeResult(true)">查看订单</button></div>
      </section>
      <section v-else-if="checkoutOrder" class="checkout-panel">
        <div v-if="checkoutOrder.qrCode" class="checkout-qr"><h2>扫码支付</h2><div class="qr-frame"><img :src="qrImage" alt="支付二维码" /></div><p>请使用手机扫码完成支付</p></div>
        <div v-else-if="isStripeCheckout" class="checkout-stripe"><h2>Stripe 安全支付</h2><p>请选择 Stripe 支持的支付方式完成付款</p><div ref="stripeMount" class="stripe-element" /><p v-if="stripeError" class="stripe-error">{{ stripeError }}</p><button class="action-primary stripe-pay-button" :disabled="!stripeReady || stripeProcessing" @click="confirmStripePayment"><RefreshCw v-if="stripeProcessing" :size="16" class="animate-spin" />{{ stripeProcessing ? '处理中…' : '确认支付' }}</button></div>
        <div v-else class="checkout-popup"><AppSpinner /><p>{{ checkoutOrder.providerKey === 'airwallex' ? '请打开 Airwallex 收银台完成支付后返回此页面' : '支付页面已在新窗口打开，请在新窗口中完成支付后返回此页面' }}</p><button class="action-button" @click="reopenPayment">重新打开支付页面</button></div>
        <div class="checkout-countdown">{{ countdownText }}<small>等待支付…</small></div><button class="checkout-cancel" @click="cancelCheckout">取消订单</button>
      </section>
      <div v-if="!checkoutOrder && !resultOrder" class="payment-tabs mb-7 flex overflow-x-auto">
        <button v-for="tab in tabs" :key="tab.id" class="payment-tab" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-20"><AppSpinner :label="common.loading" /></div>
      <div v-else-if="errorMessage" class="rounded-lg border border-error-30 bg-error-10 p-4 text-sm text-error">{{ errorMessage }}</div>

      <section v-else-if="!checkoutOrder && !resultOrder && activeTab === 'plans'">
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
        <section v-if="config.helpText || config.helpImageUrl" class="payment-help mt-6"><h2>支付帮助</h2><img v-if="config.helpImageUrl" :src="config.helpImageUrl" alt="支付帮助" @error="$event.target.style.display = 'none'" /><p v-if="config.helpText" class="whitespace-pre-wrap">{{ config.helpText }}</p></section>
      </section>

      <section v-else-if="!checkoutOrder && !resultOrder && activeTab === 'orders'" class="payment-list">
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

      <section v-else-if="!checkoutOrder && !resultOrder" class="payment-list">
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { ArrowLeft, Check, Clock3, Copy, CreditCard, ExternalLink, RefreshCw, Ticket, Undo2, User, X } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import CustomSelect from '~/components/UI/Common/CustomSelect.vue'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { useToast } from '~/composables/useToast'

const sections = useLocale(); const locale = computed(() => sections.payment.value); const common = computed(() => sections.common.value)
const { localize } = useServerErrors()
const { showToast } = useToast()
const route = useRoute()
const router = useRouter()
const config = ref({ enabled: false, methods: [], methodLabels: {} }); const plans = ref([]); const orders = ref([]); const cards = ref([])
const selectedMethods = reactive({}); const loading = ref(true); const errorMessage = ref(''); const activeTab = ref('plans'); const creatingId = ref(null)
const qrOrder = ref(null); const qrImage = ref(''); const refundOrder = ref(null); const refundReason = ref(''); const checkoutOrder = ref(null); const resultOrder = ref(null); const countdown = ref(1800); const stripeMount = ref(null); const stripeReady = ref(false); const stripeProcessing = ref(false); const stripeError = ref(''); let stripeInstance = null; let stripeElements = null; let stripePaymentElement = null; let pollTimer = null; let countdownTimer = null
const tabs = computed(() => [{ id: 'plans', label: locale.value.title }, { id: 'orders', label: locale.value.orders }, { id: 'cards', label: locale.value.cards }])
const methodLabels = { alipay: '支付宝', wxpay: '微信支付', stripe: 'Stripe', airwallex: 'Airwallex' }
const methodOptions = computed(() => config.value.methods.map(value => ({ value, label: config.value.methodLabels?.[value] || methodLabels[value] || value })))
const isStripeCheckout = computed(() => checkoutOrder.value?.providerKey === 'stripe' && Boolean(checkoutOrder.value?.clientSecret))
const checkoutStorageKey = 'voicehub-payment-checkout'
const dismissedResultStorageKey = 'voicehub-payment-dismissed-result'
const getSavedCheckoutId = () => { try { return sessionStorage.getItem(checkoutStorageKey) || '' } catch { return '' } }
const saveCheckoutId = id => { try { sessionStorage.setItem(checkoutStorageKey, id) } catch {} }
const clearSavedCheckout = () => { try { sessionStorage.removeItem(checkoutStorageKey) } catch {} }
const getDismissedResultId = () => { try { return sessionStorage.getItem(dismissedResultStorageKey) || '' } catch { return '' } }
const dismissResult = id => { try { sessionStorage.setItem(dismissedResultStorageKey, id) } catch {} }
const isMobilePaymentClient = () => /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent)
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
    const returnedOrderId = String(route.query.order || '')
    if (returnedOrderId && returnedOrderId !== getDismissedResultId()) {
      activeTab.value = 'orders'
      try { await $fetch(`/api/payment/orders/${encodeURIComponent(returnedOrderId)}/verify`, { method: 'POST' }); await loadOrders(); const returnedOrder = orders.value.find(item => item.id === returnedOrderId); if (returnedOrder && ['PENDING', 'PAID'].includes(returnedOrder.status)) await restoreCheckout(returnedOrder); else resultOrder.value = returnedOrder || null } catch {}
    } else {
      if (returnedOrderId) await router.replace({ path: '/payment', query: {} })
      const savedOrderId = getSavedCheckoutId()
      const savedOrder = savedOrderId ? orders.value.find(item => item.id === savedOrderId && ['PENDING', 'PAID'].includes(item.status)) : null
      if (savedOrder) await restoreCheckout(savedOrder)
      else if (savedOrderId) clearSavedCheckout()
    }
  } catch (error) { errorMessage.value = localize(error, common.value.loadFailed) } finally { loading.value = false }
}
const openPay = async order => {
  checkoutOrder.value = order
  saveCheckoutId(order.id)
  if (order.providerKey === 'stripe' && order.clientSecret) {
    await mountStripeCheckout(order)
    startPolling(order)
    return
  }
  if (order.providerKey === 'airwallex' && order.clientSecret) {
    try { await launchAirwallexCheckout(order); startPolling(order) } catch (error) { errorMessage.value = error instanceof Error ? error.message : 'Airwallex 支付组件加载失败' }
    return
  }
  const deepLink = order.providerData?.deepLink
  if (deepLink) {
    qrImage.value = ''
    try { qrImage.value = await QRCode.toDataURL(order.qrCode, { width: 320, margin: 1 }) } catch {}
    startPolling(order)
    window.location.assign(deepLink)
    return
  }
  if (order.payUrl && !order.qrCode) {
    const isMobile = isMobilePaymentClient()
    if (isMobile) {
      window.location.assign(order.payUrl)
    } else {
      const popup = window.open(order.payUrl, 'voicehub-payment', 'width=1100,height=820,resizable=yes,scrollbars=yes,menubar=yes,toolbar=yes')
      if (!popup) window.location.assign(order.payUrl)
    }
    startPolling(order)
    return
  }
  if (order.qrCode) { checkoutOrder.value = order; qrImage.value = await QRCode.toDataURL(order.qrCode, { width: 320, margin: 1 }); startPolling(order); return }
}
const launchAirwallexCheckout = async order => {
  const data = order.providerData || {}
  if (!order.clientSecret || !order.paymentTradeNo) throw new Error('Airwallex 支付订单信息不完整')
  const sdk = await import('@airwallex/components-sdk')
  const initialized = await sdk.init({ env: data.environment === 'prod' ? 'prod' : 'demo', enabledElements: ['payments'], locale: navigator.language.startsWith('zh') ? 'zh' : 'en' })
  if (!initialized?.payments?.redirectToCheckout) throw new Error('Airwallex 收银台初始化失败')
  await initialized.payments.redirectToCheckout({ intent_id: order.paymentTradeNo, client_secret: order.clientSecret, currency: data.currency || order.currency, country_code: data.countryCode || 'CN', successUrl: `${location.origin}/payment?order=${encodeURIComponent(order.id)}` })
}
const clearStripeCheckout = () => { try { stripePaymentElement?.destroy() } catch {} stripePaymentElement = null; stripeElements = null; stripeInstance = null; stripeReady.value = false; stripeProcessing.value = false; stripeError.value = '' }
const mountStripeCheckout = async order => {
  clearStripeCheckout()
  const data = order.providerData || {}
  if (!data.publishableKey || !order.clientSecret) { stripeError.value = 'Stripe 支付配置不完整'; return }
  try {
    const { loadStripe } = await import('@stripe/stripe-js/pure')
    stripeInstance = await loadStripe(data.publishableKey)
    if (!stripeInstance) throw new Error('Stripe SDK 加载失败')
    await nextTick()
    if (!stripeMount.value) throw new Error('Stripe 支付组件未加载')
    const darkTheme = document.documentElement.getAttribute('data-theme') === 'ClassicDark'
    stripeElements = stripeInstance.elements({ clientSecret: order.clientSecret, appearance: { theme: darkTheme ? 'night' : 'stripe', variables: { borderRadius: '8px' } } })
    stripePaymentElement = stripeElements.create('payment', { layout: 'tabs' })
    stripePaymentElement.mount(stripeMount.value)
    stripePaymentElement.on('ready', () => { stripeReady.value = true })
  } catch (error) {
    stripeError.value = error instanceof Error ? error.message : 'Stripe 支付组件加载失败'
  }
}
const confirmStripePayment = async () => {
  if (!checkoutOrder.value || !stripeInstance || !stripeElements || stripeProcessing.value) return
  stripeProcessing.value = true
  stripeError.value = ''
  try {
    const result = await stripeInstance.confirmPayment({ elements: stripeElements, confirmParams: { return_url: `${location.origin}/payment?order=${encodeURIComponent(checkoutOrder.value.id)}` }, redirect: 'if_required' })
    if (result.error) { stripeError.value = result.error.message || '支付未完成'; return }
    await verify(checkoutOrder.value)
    if (checkoutOrder.value) showToast('支付已提交，正在确认状态', 'success')
  } catch (error) {
    stripeError.value = error instanceof Error ? error.message : 'Stripe 支付确认失败'
  } finally { stripeProcessing.value = false }
}
const restoreCheckout = async order => {
  checkoutOrder.value = order
  countdown.value = Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000))
  if (order.qrCode) {
    try { qrImage.value = await QRCode.toDataURL(order.qrCode, { width: 320, margin: 1 }) } catch { qrImage.value = '' }
  } else qrImage.value = ''
  if (order.providerKey === 'stripe' && order.clientSecret) await mountStripeCheckout(order)
  startPolling(order)
}
const buy = async plan => { creatingId.value = plan.id; try { const order = await $fetch('/api/payment/orders', { method: 'POST', body: { planId: plan.id, method: selectedMethods[plan.id], mobile: isMobilePaymentClient() } }); orders.value.unshift(order); await openPay(order) } catch (error) { errorMessage.value = localize(error, locale.value.createFailed) } finally { creatingId.value = null } }
const verify = async order => { try { await $fetch(`/api/payment/orders/${order.id}/verify`, { method: 'POST' }); await loadOrders(); const latest = orders.value.find(item => item.id === order.id); if (latest && ['COMPLETED','FAILED','EXPIRED','CANCELLED'].includes(latest.status)) { resultOrder.value = latest; checkoutOrder.value = null; clearStripeCheckout(); clearSavedCheckout(); clearInterval(pollTimer); clearInterval(countdownTimer) } } catch (error) { errorMessage.value = localize(error) } }
const cancelOrder = async order => { try { await $fetch(`/api/payment/orders/${order.id}/cancel`, { method: 'POST' }); showToast('订单已取消', 'success'); await loadOrders() } catch (error) { errorMessage.value = localize(error); showToast(errorMessage.value, 'error') } }
const startRefund = order => { refundOrder.value = order; refundReason.value = '' }
const submitRefund = async () => { try { await $fetch(`/api/payment/orders/${refundOrder.value.id}/refund`, { method: 'POST', body: { reason: refundReason.value } }); refundOrder.value = null; showToast('退款申请已提交', 'success'); await loadOrders() } catch (error) { errorMessage.value = localize(error); showToast(errorMessage.value, 'error') } }
const copyCard = async code => navigator.clipboard.writeText(code)
const startPolling = order => { clearInterval(pollTimer); clearInterval(countdownTimer); countdown.value = Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000)); pollTimer = setInterval(() => verify(order), 3000); countdownTimer = setInterval(() => { countdown.value = Math.max(0, countdown.value - 1) }, 1000) }
const countdownText = computed(() => `${String(Math.floor(countdown.value / 60)).padStart(2, '0')}:${String(countdown.value % 60).padStart(2, '0')}`)
const reopenPayment = () => { if (isStripeCheckout.value) mountStripeCheckout(checkoutOrder.value); else if (checkoutOrder.value?.providerKey === 'airwallex') launchAirwallexCheckout(checkoutOrder.value).catch(error => { errorMessage.value = error instanceof Error ? error.message : 'Airwallex 收银台打开失败' }); else if (checkoutOrder.value?.payUrl) window.open(checkoutOrder.value.payUrl, 'voicehub-payment', 'width=1100,height=820,resizable=yes,scrollbars=yes,menubar=yes,toolbar=yes') }
const closeResult = async showOrders => { const orderId = resultOrder.value?.id; if (orderId) dismissResult(orderId); resultOrder.value = null; checkoutOrder.value = null; clearStripeCheckout(); clearSavedCheckout(); clearInterval(pollTimer); clearInterval(countdownTimer); const target = showOrders ? 'orders' : 'plans'; window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash); await router.replace({ path: '/payment', query: {} }); activeTab.value = target }
const cancelCheckout = () => {
  const order = checkoutOrder.value
  if (!order) return
  checkoutOrder.value = null
  resultOrder.value = { ...order, status: 'CANCELLED' }
  clearStripeCheckout()
  clearSavedCheckout()
  clearInterval(pollTimer)
  clearInterval(countdownTimer)
  void completeCheckoutCancellation(order)
}
const completeCheckoutCancellation = async order => {
  try {
    await $fetch(`/api/payment/orders/${order.id}/cancel`, { method: 'POST' })
    await loadOrders()
    const latest = orders.value.find(item => item.id === order.id)
    if (latest && latest.status !== 'CANCELLED') resultOrder.value = latest
    else showToast('订单已取消', 'success')
  } catch (error) {
    resultOrder.value = null
    checkoutOrder.value = order
    saveCheckoutId(order.id)
    await restoreCheckout(order)
    errorMessage.value = localize(error)
    showToast(errorMessage.value, 'error')
  }
}
const closeQr = () => { qrOrder.value = null; qrImage.value = ''; clearInterval(pollTimer) }
onMounted(load); onUnmounted(() => { clearStripeCheckout(); clearInterval(pollTimer); clearInterval(countdownTimer) })
</script>

<style scoped>
.payment-header { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(14px); }
.checkout-panel,.payment-result-panel{width:100%;margin:0 0 1.5rem;padding:2rem;border:1px solid var(--border-secondary);border-radius:.9rem;background:var(--bg-secondary);box-shadow:var(--shadow-sm);text-align:center}.checkout-qr h2,.payment-result-panel h2{color:var(--text-primary);font-size:1.35rem;font-weight:850}.qr-frame{display:flex;width:17rem;height:17rem;margin:1.25rem auto;align-items:center;justify-content:center;border:2px solid var(--primary);border-radius:.7rem;background:#fff;padding:.8rem}.qr-frame img{width:100%;height:100%;object-fit:contain}.checkout-qr p,.checkout-popup p{color:var(--text-tertiary);font-size:.8rem}.checkout-popup{display:grid;justify-items:center;gap:1rem;padding:1rem}.checkout-countdown{margin-top:1.25rem;color:var(--text-primary);font-size:1.8rem;font-weight:850}.checkout-countdown small{display:block;color:var(--text-tertiary);font-size:.72rem;font-weight:500}.checkout-cancel{width:100%;margin-top:1rem;padding:.7rem;border:1px solid var(--border-secondary);border-radius:.55rem;color:var(--text-secondary);font-size:.8rem}.result-icon{display:flex;width:4.5rem;height:4.5rem;margin:0 auto 1rem;align-items:center;justify-content:center;border-radius:50%}.result-icon.success{background:var(--success-light);color:var(--success)}.result-icon.failed{background:var(--error-light);color:var(--error)}.result-details{max-width:48rem;display:grid;gap:.65rem;margin:1.5rem auto;padding:1.1rem 1.25rem;border:1px solid var(--border-secondary);border-radius:.7rem;text-align:left}.result-details div{display:flex;justify-content:space-between;gap:1rem;font-size:.78rem}.result-details span{color:var(--text-tertiary)}.result-details b{overflow-wrap:anywhere;color:var(--text-primary);font-weight:700;text-align:right}.result-actions{display:flex;justify-content:center;gap:.7rem}.result-actions button{min-width:8rem;justify-content:center}
.checkout-stripe{max-width:38rem;margin:0 auto;text-align:left}.checkout-stripe h2{text-align:center;color:var(--text-primary);font-size:1.2rem;font-weight:850}.checkout-stripe>p{margin:.5rem 0 1.25rem;text-align:center;color:var(--text-tertiary);font-size:.8rem}.stripe-element{min-height:13rem;border:1px solid var(--border-secondary);border-radius:.65rem;background:var(--bg-primary);padding:1rem}.stripe-error{margin-top:.75rem!important;color:var(--error)!important;text-align:left!important}.stripe-pay-button{width:100%;justify-content:center;margin-top:1rem}
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
.payment-help { display:grid; gap:.75rem; padding:1rem; border:1px solid var(--border-secondary); border-radius:.65rem; background:var(--bg-secondary); color:var(--text-tertiary); font-size:.74rem; line-height:1.65; }.payment-help h2{color:var(--text-primary);font-size:.9rem;font-weight:800}.payment-help p{margin:0}.payment-help img{display:block;max-width:100%;max-height:28rem;margin:auto;border:1px solid var(--border-secondary);border-radius:.5rem;object-fit:contain}
.payment-list { display: grid; gap: .75rem; }
.order-card,.card-code-card { border: 1px solid var(--border-secondary); border-radius: .75rem; background: var(--bg-secondary); box-shadow: var(--shadow-sm); }
.order-card { padding: 1rem; }
.card-code-card { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: 1rem; }
.card-code-card code { font-size: .9rem; }
.action-button { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.25rem; padding: 0 .8rem; border: 1px solid var(--border-secondary); border-radius: .5rem; background: var(--bg-primary); color: var(--text-secondary); font-size: .75rem; font-weight: 700; transition: border-color .2s, color .2s, background .2s; }
.action-button:hover { border-color: var(--primary); color: var(--primary); background: var(--bg-hover); }
.action-primary { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.25rem; padding: 0 .8rem; border-radius: .5rem; background: var(--primary); color: white; font-size: .75rem; font-weight: 700; }
@media (max-width: 900px) { .plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .payment-main { padding-top: 1.25rem; } .payment-intro { padding: 1rem; } .payment-intro-icon { width: 2.5rem; height: 2.5rem; } .checkout-panel,.payment-result-panel{padding:1.25rem 1rem}.plan-grid { grid-template-columns: 1fr; } .plan-card:hover { transform: none; } .order-card .border-t { align-items: flex-start; flex-direction: column; } .order-card .border-t > div:last-child { width: 100%; } .order-card .border-t button { flex: 1; justify-content: center; } }
:global(:root[data-theme='ClassicDark']) .payment-intro { background: var(--bg-secondary); }
.result-icon.expired{background:var(--warning-light);color:var(--warning)}.result-message{margin-top:.45rem;color:var(--text-tertiary);font-size:.82rem}
textarea{color:var(--text-primary);caret-color:var(--primary);background:var(--bg-secondary)!important}textarea::placeholder{color:var(--text-tertiary);opacity:1}textarea:focus{border-color:var(--primary);outline:2px solid var(--primary-10);outline-offset:0}
</style>
<style scoped>
.result-icon.cancelled{background:var(--bg-tertiary);color:var(--text-tertiary)}
</style>
