// 这个插件只在服务器端运行
export default defineNuxtPlugin(() => {
  // 仅在服务器端提供 prisma
  if (process.server) {
    return {
      provide: {
        // 这里不直接导入 PrismaClient，而是通过事件上下文获取
        // 服务器端的 API 处理程序可以通过 event.context.prisma 访问 Prisma 客户端
      }
    }
  }
}) 