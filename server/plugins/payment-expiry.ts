import { expirePaymentOrders } from '~~/server/services/paymentService'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'test') return
  const timer = setInterval(() => {
    expirePaymentOrders().catch(error => console.error('支付订单超时检查失败:', error))
  }, 60_000)
  timer.unref?.()
})
