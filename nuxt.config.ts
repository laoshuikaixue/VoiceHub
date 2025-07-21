// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [],
  
  // 引入全局CSS
  css: [
    '~/assets/css/variables.css',
    '~/assets/css/components.css',
    '~/assets/css/main.css',
    '~/assets/css/transitions.css',
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
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      title: process.env.NUXT_PUBLIC_SITE_TITLE || '校园广播站点歌系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见' },
        // 温和的主题控制
        { name: 'theme-color', content: '#111111' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: process.env.NUXT_PUBLIC_SITE_LOGO || '/favicon.ico' },
        // 预加载MiSans字体 - TTF格式
        { rel: 'preload', href: '/fonts/MiSans-Regular.ttf', as: 'font', type: 'font/ttf', crossorigin: 'anonymous' },
        { rel: 'preload', href: '/fonts/MiSans-Medium.ttf', as: 'font', type: 'font/ttf', crossorigin: 'anonymous' },
        { rel: 'preload', href: '/fonts/MiSans-Semibold.ttf', as: 'font', type: 'font/ttf', crossorigin: 'anonymous' },
        { rel: 'preload', href: '/fonts/MiSans-Demibold.ttf', as: 'font', type: 'font/ttf', crossorigin: 'anonymous' }
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
    preset: process.env.NITRO_PRESET || 'vercel',
    // 增强错误处理和稳定性
    experimental: {
      wasm: true
    },
    timing: true,
    // 增加请求超时时间
    routeRules: {
      '/api/**': {
        headers: {
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }
    }
  }
})
