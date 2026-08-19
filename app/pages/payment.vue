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
      <div v-if="!purchasePlan && !checkoutOrder && !resultOrder" class="payment-intro"><div><p class="payment-eyebrow">VoiceHub</p><h1>{{ locale.title }}</h1><p>选择适合你的点歌券套餐，支付完成后自动发放。</p></div><div class="payment-intro-icon"><Ticket :size="25" /></div></div>
      <section v-if="resultOrder" class="payment-result-panel">
        <div class="result-icon" :class="resultOrder.status === 'COMPLETED' ? 'success' : resultOrder.status === 'EXPIRED' ? 'expired' : resultOrder.status === 'CANCELLED' ? 'cancelled' : 'failed'"><Check v-if="resultOrder.status === 'COMPLETED'" :size="34" /><Clock3 v-else-if="resultOrder.status === 'EXPIRED'" :size="34" /><X v-else :size="34" /></div>
        <h2>{{ resultOrder.status === 'COMPLETED' ? '支付成功' : resultOrder.status === 'EXPIRED' ? '订单已过期' : resultOrder.status === 'CANCELLED' ? '订单已取消' : '支付失败' }}</h2>
        <p v-if="resultOrder.status === 'EXPIRED'" class="result-message">订单已超时，请重新创建订单</p>
        <p v-else-if="resultOrder.status === 'CANCELLED'" class="result-message">您已取消本次支付</p>
        <div class="result-details"><div><span>订单 ID</span><b>#{{ resultOrder.id }}</b></div><div><span>订单编号</span><b>{{ resultOrder.outTradeNo }}</b></div><div><span>充值金额</span><b>{{ formatMoney(resultOrder.payAmountCents, resultOrder.currency) }}</b></div><div><span>支付方式</span><b>{{ methodLabels[resultOrder.paymentMethod] || resultOrder.paymentMethod }}</b></div><div><span>状态</span><b>{{ statusText(resultOrder.status) }}</b></div></div>
        <div class="result-actions"><button class="action-primary" @click="closeResult(false)">确认</button><button v-if="resultOrder.status !== 'EXPIRED' && resultOrder.status !== 'CANCELLED'" class="action-button" @click="closeResult(true)">查看订单</button></div>
      </section>
      <section v-else-if="checkoutOrder" class="checkout-panel">
        <div v-if="checkoutOrder.qrCode" class="checkout-qr"><h2>{{ checkoutMethodLabel }}扫码支付</h2><div class="qr-frame" :class="`brand-${paymentBrand(checkoutOrder.paymentMethod)}`"><img :src="qrImage" :alt="`${checkoutMethodLabel}支付二维码`" /><span v-if="checkoutPaymentIcon" class="qr-brand-icon"><img :src="checkoutPaymentIcon" :alt="`${checkoutMethodLabel}图标`" /></span></div><p>请使用手机打开{{ checkoutMethodLabel }}，扫描二维码完成支付</p><button type="button" class="reopen-payment" :class="`brand-${paymentBrand(checkoutOrder.paymentMethod)}`" @click="reopenPayment"><ExternalLink :size="15" />重新打开支付页面</button></div>
        <div v-else-if="isStripeCheckout" class="checkout-stripe"><h2>Stripe 安全支付</h2><p>请选择 Stripe 支持的支付方式完成付款</p><div ref="stripeMount" class="stripe-element" /><p v-if="stripeError" class="stripe-error">{{ stripeError }}</p><button class="action-primary stripe-pay-button" :disabled="!stripeReady || stripeProcessing" @click="confirmStripePayment"><RefreshCw v-if="stripeProcessing" :size="16" class="animate-spin" />{{ stripeProcessing ? '处理中…' : '确认支付' }}</button></div>
        <div v-else class="checkout-popup"><AppSpinner /><p>{{ checkoutOrder.providerKey === 'airwallex' ? '请打开 Airwallex 收银台完成支付后返回此页面' : '支付页面已在新窗口打开，请在新窗口中完成支付后返回此页面' }}</p><button class="action-button" @click="reopenPayment">重新打开支付页面</button></div>
        <div class="checkout-countdown">{{ countdownText }}<small>等待支付…</small></div><button class="checkout-cancel" @click="cancelCheckout">取消订单</button>
      </section>
      <div v-if="!purchasePlan && !checkoutOrder && !resultOrder" class="payment-tabs mb-7 flex overflow-x-auto">
        <button v-for="tab in tabs" :key="tab.id" class="payment-tab" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-20"><AppSpinner :label="common.loading" /></div>
      <div v-else-if="errorMessage" class="rounded-lg border border-error-30 bg-error-10 p-4 text-sm text-error">{{ errorMessage }}</div>

      <section v-else-if="purchasePlan" class="purchase-confirmation">
        <button type="button" class="purchase-back" @click="cancelPurchase"><ArrowLeft :size="16" />返回套餐</button>
        <section class="purchase-summary"><div class="purchase-summary-head"><div><p>套餐 ID #{{ purchasePlan.id }}</p><h2>{{ purchasePlan.name }}</h2><span>{{ purchasePlan.description || '灵活购买点歌券' }}</span></div><span class="plan-badge">每份 {{ purchasePlan.cardCount }} {{ locale.cardsCount }}</span></div><div class="purchase-price"><b>{{ formatMoney(purchaseTotalCents, purchasePlan.currency) }}</b><del v-if="hasDiscount(purchasePlan)">{{ formatMoney(Number(purchasePlan.originalPriceCents) * purchaseQuantity, purchasePlan.currency) }}</del><em v-if="hasDiscount(purchasePlan)">-{{ discountPercent(purchasePlan) }}%</em></div><div class="purchase-quantity"><span>购买数量</span><div class="quantity-stepper"><button type="button" :disabled="purchaseQuantity <= 1" aria-label="减少数量" @click="setPurchaseQuantity(purchaseQuantity - 1)">−</button><input v-model.number="purchaseQuantity" type="number" min="1" max="99" inputmode="numeric" @input="setPurchaseQuantity($event.target.value)" @change="setPurchaseQuantity(purchaseQuantity)" /><button type="button" :disabled="purchaseQuantity >= 99" aria-label="增加数量" @click="setPurchaseQuantity(purchaseQuantity + 1)">+</button></div></div><div class="purchase-details"><div><span>点歌券数量</span><b>{{ purchaseCardCount }} 张</b></div><div><span>有效期</span><b>{{ validityText(purchasePlan) }}</b></div><div><span>套餐币种</span><b>{{ purchasePlan.currency }}</b></div><div><span>购买金额</span><b>{{ formatMoney(purchaseTotalCents, purchasePlan.currency) }}</b></div></div><ul v-if="purchasePlan.features?.length" class="purchase-features"><li v-for="feature in purchasePlan.features" :key="feature"><Check :size="15" />{{ feature }}</li></ul></section>
        <section class="purchase-methods"><h2>支付方式</h2><div class="purchase-method-grid"><button v-for="method in methodOptions" :key="method.value" type="button" class="purchase-method" :class="[`brand-${paymentBrand(method.value)}`, { active: purchaseMethod === method.value }]" @click="purchaseMethod = method.value"><img v-if="paymentIcon(method.value)" :src="paymentIcon(method.value)" :alt="`${method.label}图标`" class="payment-method-icon" /><CreditCard v-else :size="19" /><span>{{ method.label }}</span></button></div></section>
        <button type="button" class="purchase-submit" :class="`brand-${paymentBrand(purchaseMethod)}`" :disabled="creatingId === purchasePlan.id || !purchaseMethod" @click="buy(purchasePlan)"><RefreshCw v-if="creatingId === purchasePlan.id" :size="17" class="animate-spin" />{{ creatingId === purchasePlan.id ? '创建订单中…' : `确认支付 ${formatMoney(purchaseTotalCents, purchasePlan.currency)}` }}</button>
        <button type="button" class="purchase-cancel" @click="cancelPurchase">取消</button>
      </section>

      <section v-else-if="!checkoutOrder && !resultOrder && activeTab === 'plans'">
        <div v-if="!config.enabled" class="py-20 text-center text-text-tertiary">{{ locale.disabled }}</div>
        <div v-else-if="!plans.length" class="py-20 text-center text-text-tertiary">{{ locale.emptyPlans }}</div>
        <div v-else class="plan-grid">
          <article v-for="plan in plans" :key="plan.id" class="plan-card">
            <div class="plan-card-top"><div class="plan-card-title"><span class="plan-icon"><Ticket :size="18" /></span><div><h2>{{ plan.name }}</h2><p>{{ plan.description || '灵活购买点歌券' }}</p></div></div><span class="plan-badge">{{ plan.cardCount }} {{ locale.cardsCount }}</span></div>
            <div class="plan-price"><span>{{ formatMoney(plan.priceCents, plan.currency) }}</span><del v-if="hasDiscount(plan)">{{ formatMoney(plan.originalPriceCents, plan.currency) }}</del><b v-if="hasDiscount(plan)" class="plan-discount">-{{ discountPercent(plan) }}%</b></div>
            <div class="plan-divider" />
            <div class="plan-benefit"><Check :size="16" /><span>{{ locale.cardsCount }} <b>{{ plan.cardCount }}</b></span></div>
            <ul v-if="plan.features?.length" class="plan-features"><li v-for="feature in plan.features" :key="feature"><Check :size="15" />{{ feature }}</li></ul>
            <button type="button" class="buy-button" @click="beginPurchase(plan)"><CreditCard :size="16" />{{ locale.buy }}</button>
          </article>
        </div>
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
              <button v-if="order.status === 'PENDING' && (order.payUrl || order.qrCode || order.clientSecret)" class="action-primary" @click="openPay(order)"><ExternalLink :size="15" />{{ locale.payNow }}</button>
              <button v-if="['PENDING','PAID','FAILED'].includes(order.status)" class="action-button" @click="verify(order)"><RefreshCw :size="15" />{{ locale.verify }}</button>
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

      <section v-if="config.helpText || config.helpImageUrl" class="payment-help mt-6" aria-label="支付帮助"><h2>支付帮助</h2><img v-if="config.helpImageUrl" :src="config.helpImageUrl" alt="支付帮助" @error="$event.target.style.display = 'none'" /><p v-if="config.helpText" class="whitespace-pre-wrap">{{ config.helpText }}</p></section>
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
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { ArrowLeft, Check, Clock3, Copy, CreditCard, ExternalLink, RefreshCw, Ticket, Undo2, User, X } from '@lucide/vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import { useToast } from '~/composables/useToast'

const sections = useLocale(); const locale = computed(() => sections.payment.value); const common = computed(() => sections.common.value)
const { localize } = useServerErrors()
const { showToast } = useToast()
const route = useRoute()
const router = useRouter()
const config = ref({ enabled: false, methods: [], methodLabels: {} }); const plans = ref([]); const orders = ref([]); const cards = ref([])
const purchasePlan = ref(null); const purchaseMethod = ref(''); const purchaseQuantity = ref(1); const loading = ref(true); const errorMessage = ref(''); const activeTab = ref('plans'); const creatingId = ref(null)
const qrOrder = ref(null); const qrImage = ref(''); const refundOrder = ref(null); const refundReason = ref(''); const checkoutOrder = ref(null); const resultOrder = ref(null); const countdown = ref(1800); const stripeMount = ref(null); const stripeReady = ref(false); const stripeProcessing = ref(false); const stripeError = ref(''); let stripeInstance = null; let stripeElements = null; let stripePaymentElement = null; let pollTimer = null; let countdownTimer = null; const verifyingOrderIds = new Set()
const tabs = computed(() => [{ id: 'plans', label: locale.value.title }, { id: 'orders', label: locale.value.orders }, { id: 'cards', label: locale.value.cards }])
const methodLabels = { alipay: '支付宝', wxpay: '微信支付', stripe: 'Stripe', airwallex: 'Airwallex' }
const methodOptions = computed(() => config.value.methods.map(value => ({ value, label: config.value.methodLabels?.[value] || methodLabels[value] || value })))
const paymentBrand = method => ({ alipay: 'alipay', wxpay: 'wxpay', stripe: 'stripe', airwallex: 'airwallex' }[method] || 'default')
const paymentIcon = method => ({ alipay: '/assets/payment/alipay.svg', wxpay: '/assets/payment/wxpay.svg', stripe: '/assets/payment/stripe.svg', airwallex: '/assets/payment/airwallex.svg' }[method] || '')
const checkoutMethodLabel = computed(() => config.value.methodLabels?.[checkoutOrder.value?.paymentMethod] || methodLabels[checkoutOrder.value?.paymentMethod] || '支付')
const checkoutPaymentIcon = computed(() => paymentIcon(checkoutOrder.value?.paymentMethod))
const toHttpPaymentUrl = value => {
  const raw = String(value || '').trim()
  if (!/^https?:\/\//i.test(raw)) return ''
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}
const openPaymentWindow = value => {
  const url = toHttpPaymentUrl(value)
  if (!url) return false
  const popup = window.open('', 'voicehub-payment', 'width=1120,height=840,resizable=yes,scrollbars=yes,menubar=yes,toolbar=yes')
  if (!popup) return false
  try {
    popup.opener = null
    popup.location.replace(url)
    return true
  } catch {
    try { popup.close() } catch {}
    return false
  }
}
const createPaymentQrImage = value => QRCode.toDataURL(value, { width: 320, margin: 1, errorCorrectionLevel: 'H' })
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
const hasDiscount = plan => Number(plan?.originalPriceCents) > Number(plan?.priceCents) && Number(plan?.priceCents) >= 0
const discountPercent = plan => Math.round((1 - Number(plan.priceCents) / Number(plan.originalPriceCents)) * 100)
const purchaseTotalCents = computed(() => Math.max(0, Number(purchasePlan.value?.priceCents || 0) * purchaseQuantity.value))
const purchaseCardCount = computed(() => Math.max(0, Number(purchasePlan.value?.cardCount || 0) * purchaseQuantity.value))
const formatDate = value => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusText = status => ({ PENDING: locale.value.pending, PAID: locale.value.paid, COMPLETED: locale.value.completed, EXPIRED: locale.value.expired, CANCELLED: locale.value.cancelled, FAILED: locale.value.failed, REFUND_REQUESTED: locale.value.refundRequested, REFUNDING: locale.value.refunding, REFUNDED: locale.value.refunded }[status] || status)
const statusClass = status => status === 'COMPLETED' ? 'border-success-30 bg-success-10 text-success' : ['EXPIRED','CANCELLED'].includes(status) ? 'border-border-secondary bg-bg-tertiary text-text-tertiary' : status === 'FAILED' ? 'border-error-30 bg-error-10 text-error' : 'border-warning-30 bg-warning-10 text-warning'

const loadOrders = async () => {
  orders.value = await $fetch('/api/payment/orders')
  const details = await Promise.all(orders.value.filter(order => order.status === 'COMPLETED').map(order => $fetch(`/api/payment/orders/${order.id}`).catch(() => ({ cards: [] }))))
  cards.value = details.flatMap(item => item.cards || [])
}
const load = async () => {
  try {
    const [paymentConfig, paymentPlans] = await Promise.all([$fetch('/api/payment/config'), $fetch('/api/payment/plans')])
    config.value = paymentConfig; plans.value = paymentPlans
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
    try { qrImage.value = await createPaymentQrImage(order.qrCode) } catch {}
    startPolling(order)
    if (/^alipayqr:\/\//i.test(String(deepLink))) window.location.assign(deepLink)
    return
  }
  if (order.payUrl && !order.qrCode) {
    const isMobile = isMobilePaymentClient()
    if (isMobile) {
      const url = toHttpPaymentUrl(order.payUrl)
      if (url) window.location.assign(url)
    } else {
      if (!openPaymentWindow(order.payUrl)) {
        const url = toHttpPaymentUrl(order.payUrl)
        if (url) window.location.assign(url)
      }
    }
    startPolling(order)
    return
  }
  if (order.qrCode) {
    checkoutOrder.value = order
    try { qrImage.value = await createPaymentQrImage(order.qrCode) } catch { qrImage.value = ''; showToast('支付二维码生成失败，请重新打开支付页面', 'error') }
    startPolling(order)
  }
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
    try { qrImage.value = await createPaymentQrImage(order.qrCode) } catch { qrImage.value = '' }
  } else qrImage.value = ''
  if (order.providerKey === 'stripe' && order.clientSecret) await mountStripeCheckout(order)
  startPolling(order)
}
const validityText = plan => plan?.validityValue ? `${plan.validityValue}${({ day: '天', month: '月', year: '年' }[plan.validityUnit] || '天')}` : '不限时'
const setPurchaseQuantity = value => { const quantity = Math.trunc(Number(value)); purchaseQuantity.value = Number.isFinite(quantity) ? Math.min(99, Math.max(1, quantity)) : 1 }
const beginPurchase = plan => { errorMessage.value = ''; purchasePlan.value = plan; purchaseQuantity.value = 1; purchaseMethod.value = methodOptions.value[0]?.value || '' }
const cancelPurchase = () => { if (creatingId.value) return; purchasePlan.value = null; purchaseMethod.value = ''; purchaseQuantity.value = 1 }
const buy = async plan => { if (!purchaseMethod.value) return; setPurchaseQuantity(purchaseQuantity.value); creatingId.value = plan.id; try { const order = await $fetch('/api/payment/orders', { method: 'POST', body: { planId: plan.id, quantity: purchaseQuantity.value, method: purchaseMethod.value, mobile: isMobilePaymentClient() } }); purchasePlan.value = null; purchaseMethod.value = ''; purchaseQuantity.value = 1; orders.value.unshift(order); await openPay(order) } catch (error) { errorMessage.value = localize(error, locale.value.createFailed) } finally { creatingId.value = null } }
const verify = async order => {
  if (!order?.id || verifyingOrderIds.has(order.id)) return
  verifyingOrderIds.add(order.id)
  try {
    await $fetch(`/api/payment/orders/${order.id}/verify`, { method: 'POST' })
    await loadOrders()
    const latest = orders.value.find(item => item.id === order.id)
    if (latest && ['COMPLETED','FAILED','EXPIRED','CANCELLED'].includes(latest.status)) {
      resultOrder.value = latest
      checkoutOrder.value = null
      clearStripeCheckout()
      clearSavedCheckout()
      clearInterval(pollTimer)
      clearInterval(countdownTimer)
    }
  } catch (error) {
    errorMessage.value = localize(error)
  } finally {
    verifyingOrderIds.delete(order.id)
  }
}
const cancelOrder = async order => { try { await $fetch(`/api/payment/orders/${order.id}/cancel`, { method: 'POST' }); showToast('订单已取消', 'success'); await loadOrders() } catch (error) { errorMessage.value = localize(error); showToast(errorMessage.value, 'error') } }
const startRefund = order => { refundOrder.value = order; refundReason.value = '' }
const submitRefund = async () => { try { await $fetch(`/api/payment/orders/${refundOrder.value.id}/refund`, { method: 'POST', body: { reason: refundReason.value } }); refundOrder.value = null; showToast('退款申请已提交', 'success'); await loadOrders() } catch (error) { errorMessage.value = localize(error); showToast(errorMessage.value, 'error') } }
const copyCard = async code => navigator.clipboard.writeText(code)
const startPolling = order => { clearInterval(pollTimer); clearInterval(countdownTimer); countdown.value = Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000)); pollTimer = setInterval(() => verify(order), 3000); countdownTimer = setInterval(() => { countdown.value = Math.max(0, countdown.value - 1) }, 1000) }
const countdownText = computed(() => `${String(Math.floor(countdown.value / 60)).padStart(2, '0')}:${String(countdown.value % 60).padStart(2, '0')}`)
const reopenPayment = () => {
  const order = checkoutOrder.value
  if (!order) return
  if (isStripeCheckout.value) { mountStripeCheckout(order); return }
  if (order.providerKey === 'airwallex') { launchAirwallexCheckout(order).catch(error => { errorMessage.value = error instanceof Error ? error.message : 'Airwallex 收银台打开失败' }); return }
  const paymentUrl = order.payUrl || order.qrCode
  if (!openPaymentWindow(paymentUrl)) showToast('支付页面地址不可用或浏览器阻止了支付窗口，请刷新订单后重试', 'error')
}
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
.checkout-panel,.payment-result-panel{width:100%;margin:0 0 1.5rem;padding:2rem;border:1px solid var(--border-secondary);border-radius:.9rem;background:var(--bg-secondary);box-shadow:var(--shadow-sm);text-align:center}.checkout-qr h2,.payment-result-panel h2{color:var(--text-primary);font-size:1.35rem;font-weight:850}.qr-frame{position:relative;display:flex;width:17rem;height:17rem;margin:1.25rem auto;align-items:center;justify-content:center;border:2px solid var(--primary);border-radius:.7rem;background:#fff;padding:.8rem}.qr-frame.brand-wxpay{border-color:#07c160}.qr-frame.brand-alipay{border-color:#1677ff}.qr-frame img{width:100%;height:100%;object-fit:contain}.qr-brand-icon{position:absolute;display:flex;width:2.7rem;height:2.7rem;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50%;background:#fff;box-shadow:0 .18rem .55rem rgb(0 0 0 / 20%)}.qr-brand-icon img{width:100%;height:100%;object-fit:contain}.checkout-qr p,.checkout-popup p{color:var(--text-tertiary);font-size:.8rem}.reopen-payment{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;min-height:2.45rem;margin-top:.9rem;padding:0 .9rem;border:1px solid var(--primary);border-radius:.55rem;background:var(--bg-secondary);color:var(--primary);font-size:.78rem;font-weight:700;transition:background .15s,color .15s,border-color .15s}.reopen-payment:hover{background:var(--primary-10)}.reopen-payment.brand-wxpay{border-color:#07c160;color:#07c160}.reopen-payment.brand-wxpay:hover{background:rgb(7 193 96 / 10%)}.reopen-payment.brand-alipay{border-color:#1677ff;color:#1677ff}.reopen-payment.brand-alipay:hover{background:rgb(22 119 255 / 10%)}.checkout-popup{display:grid;justify-items:center;gap:1rem;padding:1rem}.checkout-countdown{margin-top:1.25rem;color:var(--text-primary);font-size:1.8rem;font-weight:850}.checkout-countdown small{display:block;color:var(--text-tertiary);font-size:.72rem;font-weight:500}.checkout-cancel{width:100%;margin-top:1rem;padding:.7rem;border:1px solid var(--border-secondary);border-radius:.55rem;color:var(--text-secondary);font-size:.8rem}.result-icon{display:flex;width:4.5rem;height:4.5rem;margin:0 auto 1rem;align-items:center;justify-content:center;border-radius:50%}.result-icon.success{background:var(--success-light);color:var(--success)}.result-icon.failed{background:var(--error-light);color:var(--error)}.result-details{max-width:48rem;display:grid;gap:.65rem;margin:1.5rem auto;padding:1.1rem 1.25rem;border:1px solid var(--border-secondary);border-radius:.7rem;text-align:left}.result-details div{display:flex;justify-content:space-between;gap:1rem;font-size:.78rem}.result-details span{color:var(--text-tertiary)}.result-details b{overflow-wrap:anywhere;color:var(--text-primary);font-weight:700;text-align:right}.result-actions{display:flex;justify-content:center;gap:.7rem}.result-actions button{min-width:8rem;justify-content:center}
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
.plan-discount { display: inline-flex; align-items: center; min-height: 1.35rem; border-radius: .35rem; background: var(--success-light); padding: 0 .42rem; color: var(--success); font-size: .68rem; font-weight: 800; }
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
.purchase-confirmation{display:grid;max-width:56rem;gap:1rem;margin:0 auto}.purchase-back{display:inline-flex;width:max-content;align-items:center;gap:.4rem;color:var(--text-secondary);font-size:.78rem;font-weight:700}.purchase-back:hover{color:var(--primary)}.purchase-summary,.purchase-methods{border:1px solid var(--border-secondary);border-radius:.85rem;background:var(--bg-secondary);box-shadow:var(--shadow-sm)}.purchase-summary{padding:1.45rem}.purchase-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.purchase-summary-head p{color:var(--text-tertiary);font-size:.68rem;font-weight:700}.purchase-summary-head h2{margin:.3rem 0;color:var(--text-primary);font-size:1.2rem;font-weight:850}.purchase-summary-head span{color:var(--text-tertiary);font-size:.78rem}.purchase-price{display:flex;align-items:baseline;gap:.55rem;margin-top:1.25rem}.purchase-price b{color:var(--success);font-size:2rem;font-weight:900}.purchase-price del{color:var(--text-disabled);font-size:.82rem}.purchase-price em{border-radius:.35rem;background:var(--success-light);padding:.2rem .42rem;color:var(--success);font-size:.68rem;font-style:normal;font-weight:800}.purchase-quantity{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1.15rem;padding:1rem;border:1px solid var(--border-secondary);border-radius:.65rem;background:var(--bg-primary)}.purchase-quantity>span{color:var(--text-secondary);font-size:.8rem;font-weight:750}.quantity-stepper{display:grid;grid-template-columns:2.2rem 3.3rem 2.2rem;overflow:hidden;border:1px solid var(--border-secondary);border-radius:.5rem}.quantity-stepper button,.quantity-stepper input{height:2.3rem;background:var(--bg-secondary);color:var(--text-primary);text-align:center}.quantity-stepper button{font-size:1.1rem;font-weight:700}.quantity-stepper button:hover:not(:disabled){background:var(--bg-hover);color:var(--primary)}.quantity-stepper button:disabled{cursor:not-allowed;opacity:.4}.quantity-stepper input{min-width:0;border-right:1px solid var(--border-secondary);border-left:1px solid var(--border-secondary);outline:0;font-size:.8rem;font-weight:800}.quantity-stepper input::-webkit-outer-spin-button,.quantity-stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}.quantity-stepper input[type=number]{appearance:textfield}.purchase-details{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-top:1.45rem;padding-top:1.1rem;border-top:1px solid var(--border-secondary)}.purchase-details div{display:grid;gap:.35rem}.purchase-details span{color:var(--text-tertiary);font-size:.7rem}.purchase-details b{color:var(--text-primary);font-size:.86rem}.purchase-features{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem;margin-top:1.1rem;color:var(--text-secondary);font-size:.74rem}.purchase-features li{display:flex;gap:.4rem}.purchase-features svg{flex:none;color:var(--success)}.purchase-methods{padding:1.25rem}.purchase-methods h2{margin-bottom:.85rem;color:var(--text-primary);font-size:.88rem;font-weight:800}.purchase-method-grid{display:flex;flex-wrap:wrap;gap:.75rem}.purchase-method{display:inline-flex;min-width:12rem;min-height:3.7rem;align-items:center;justify-content:center;gap:.6rem;border:1px solid var(--border-secondary);border-radius:.6rem;background:var(--bg-primary);color:var(--text-secondary);font-size:.88rem;font-weight:800;transition:border-color .15s,background .15s,color .15s}.payment-method-icon{width:1.35rem;height:1.35rem;object-fit:contain}.purchase-method:hover{border-color:var(--primary);color:var(--primary)}.purchase-method.active{border-color:var(--primary);background:var(--primary-10);color:var(--primary)}.purchase-method.brand-alipay.active{border-color:#02a9f1;background:rgb(2 169 241 / 10%);color:#028bc9}.purchase-method.brand-wxpay.active{border-color:#09bb07;background:rgb(9 187 7 / 10%);color:#078d05}.purchase-method.brand-stripe.active{border-color:#676be5;background:rgb(103 107 229 / 10%);color:#5458c7}.purchase-method.brand-airwallex.active{border-color:#111;background:rgb(17 17 17 / 10%);color:var(--text-primary)}.purchase-submit,.purchase-cancel{display:flex;width:100%;min-height:3.1rem;align-items:center;justify-content:center;gap:.45rem;border-radius:.65rem;font-size:.88rem;font-weight:800}.purchase-submit{background:var(--primary);color:white;box-shadow:var(--shadow-sm)}.purchase-submit.brand-alipay{background:#02a9f1}.purchase-submit.brand-wxpay{background:#09bb07}.purchase-submit.brand-stripe{background:#676be5}.purchase-submit.brand-airwallex{background:#111;color:#fff}.purchase-submit:disabled{cursor:not-allowed;opacity:.5}.purchase-cancel{border:1px solid var(--border-secondary);background:var(--bg-secondary);color:var(--text-secondary)}.purchase-cancel:hover{border-color:var(--primary);color:var(--primary)}
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
@media (max-width: 600px) { .payment-main { padding-top: 1.25rem; } .payment-intro { padding: 1rem; } .payment-intro-icon { width: 2.5rem; height: 2.5rem; } .checkout-panel,.payment-result-panel{padding:1.25rem 1rem}.plan-grid { grid-template-columns: 1fr; } .plan-card:hover { transform: none; } .purchase-summary{padding:1.1rem}.purchase-summary-head{flex-direction:column}.purchase-details,.purchase-features{grid-template-columns:1fr 1fr}.purchase-method{min-width:100%;width:100%}.order-card .border-t { align-items: flex-start; flex-direction: column; } .order-card .border-t > div:last-child { width: 100%; } .order-card .border-t button { flex: 1; justify-content: center; } }
:global(:root[data-theme='ClassicDark']) .payment-intro { background: var(--bg-secondary); }
.result-icon.expired{background:var(--warning-light);color:var(--warning)}.result-message{margin-top:.45rem;color:var(--text-tertiary);font-size:.82rem}
textarea{color:var(--text-primary);caret-color:var(--primary);background:var(--bg-secondary)!important}textarea::placeholder{color:var(--text-tertiary);opacity:1}textarea:focus{border-color:var(--primary);outline:2px solid var(--primary-10);outline-offset:0}
</style>
<style scoped>
.result-icon.cancelled{background:var(--bg-tertiary);color:var(--text-tertiary)}
</style>
<style scoped>
.purchase-quantity>span::after{content:'最多 99 份';display:block;margin-top:.2rem;color:var(--text-tertiary);font-size:.68rem;font-weight:500}
.quantity-stepper{flex:none;max-width:100%}
@media (max-width:600px){.purchase-quantity{align-items:flex-start;flex-direction:column}.quantity-stepper{width:100%;grid-template-columns:2.5rem minmax(0,1fr) 2.5rem}}
</style>
