// 服务端认证插件已禁用
// 在serverless环境中，使用useState会导致状态在不同用户之间共享
// 认证状态应该完全由客户端管理，通过API调用获取

export default defineNuxtPlugin(async (nuxtApp) => {
  // 服务端插件已禁用，避免状态共享问题
  // 认证状态将完全由客户端通过API调用管理
  return
})
