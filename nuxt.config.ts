// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [],
  
  // 引入全局CSS
  css: [
    '~/assets/css/main.css',
  ],
  
  // 配置运行时配置
  runtimeConfig: {
    // 服务器私有键（不会暴露到客户端）
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    // 公共键（会暴露到客户端）
    public: {
      apiBase: '/api',
      siteTitle: process.env.NUXT_PUBLIC_SITE_TITLE || '校园广播站点歌系统',
      siteLogo: process.env.NUXT_PUBLIC_SITE_LOGO || '',
      siteDescription: process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见'
    }
  },
  
  // 配置环境变量
  app: {
    head: {
      title: process.env.NUXT_PUBLIC_SITE_TITLE || '校园广播站点歌系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: process.env.NUXT_PUBLIC_SITE_LOGO || '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }
      ]
    }
  },
  
  // TypeScript配置
  typescript: {
    strict: true
  },
  
  // 自动导入
  imports: {
    dirs: ['composables']
  },
  
  // 服务器端配置
  nitro: {
    preset: 'vercel'
  }
})
