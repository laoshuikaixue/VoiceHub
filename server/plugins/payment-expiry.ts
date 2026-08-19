import { expirePaymentOrders, reconcilePaymentRefunds } from '~~/server/services/paymentService'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'test') return
  const timer = setInterval(() => {
    Promise.all([
      expirePaymentOrders(),
      reconcilePaymentRefunds()
    ]).catch(error => console.error('支付订单状态检查失败:', error))
  }, 60_000)
  timer.unref?.()
})
