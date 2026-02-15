import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-01-30',
  future: {
    compatibilityVersion: 4,
  },
  srcDir: 'app/',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  
  // 引入全局CSS
  css: [
    '~/assets/css/variables.css',
    '~/assets/css/components.css',
    '~/assets/css/main.css',
    '~/assets/css/transitions.css',
    '~/assets/css/mobile-admin.css',
    '~/assets/css/print-fix.css',
    '~/assets/css/sf-pro-icons.css',
  ],
  
  // 配置运行时配置
  runtimeConfig: {
    // 服务器私有键（不会暴露到客户端）
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    // Redis配置（可选）
    redisUrl: process.env.REDIS_URL || '',
    // 公共键（会暴露到客户端）
    public: {
      apiBase: '/api',
      oauth: {
        github: !!process.env.GITHUB_CLIENT_ID,
        casdoor: !!process.env.CASDOOR_CLIENT_ID,
        google: !!process.env.GOOGLE_CLIENT_ID,
      },
      siteTitle: process.env.NUXT_PUBLIC_SITE_TITLE || '校园广播站点歌系统',
      siteLogo: process.env.NUXT_PUBLIC_SITE_LOGO || '',
      siteDescription: process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见',
      isNetlify: process.env.NETLIFY === 'true'
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
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'description', content: process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见' },
        // 移动端优化
        { name: 'theme-color', content: '#111111' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'VoiceHub管理' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      link: [
          { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=2' },
          // 优先加载常规字体，确保页面快速显示
          { rel: 'preload', as: 'style', href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css' },
          { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css' },
          // 延迟加载其他字重，避免阻塞页面渲染
          { rel: 'preload', as: 'style', href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Medium.min.css', onload: "this.onload=null;this.rel='stylesheet'" },
          { rel: 'preload', as: 'style', href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Semibold.min.css', onload: "this.onload=null;this.rel='stylesheet'" },
          { rel: 'preload', as: 'style', href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Bold.min.css', onload: "this.onload=null;this.rel='stylesheet'" }
        ]
    }
  },

  features: {
    inlineStyles: true
  },
  
  // TypeScript配置
  typescript: {
    strict: true
  },
  
  // 服务器端配置
  nitro: {
    preset: process.env.VERCEL ? 'vercel' : (process.env.NETLIFY ? 'netlify' : (process.env.NITRO_PRESET || 'node-server')),
    // 增强错误处理和稳定性
    experimental: {
      wasm: true,
      asyncContext: true
    },
    timing: true,
    // 增加请求超时时间
    routeRules: {
      // 完全禁用所有API路由的缓存，确保每次都请求数据库
      '/api/**': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Connection': 'keep-alive'
        }
      },
      // 静态资源文件缓存配置
      '/_nuxt/**': {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      },
      '/assets/**': {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      },
      '/favicon.ico': {
        headers: {
          'Cache-Control': 'public, max-age=86400'
        }
      },
      // 图片、CSS、JS等静态资源缓存
      '/**/*.{png,jpg,jpeg,gif,webp,svg,ico}': {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      },
      '/**/*.{css,js}': {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      },
      // 认证相关页面不缓存
      '/login': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },
      '/dashboard': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },
      '/change-password': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },
      '/auth/**': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },
      '/notification-settings': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    },
    // 根据部署环境调整配置
    ...(process.env.VERCEL ? {
      // Vercel 环境：使用标准配置
    } : process.env.NETLIFY ? {
      // Netlify 环境：确保 Drizzle 正确打包
      experimental: {
        wasm: true
      }
    } : {
      // 其他环境：使用标准配置
    })
  },
  
  // Vite 配置
  vite: {
    plugins: [
      wasm(),
      topLevelAwait()
    ],
    optimizeDeps: {
      include: ['drizzle-orm'],
      exclude: ['@applemusic-like-lyrics/vue', '@applemusic-like-lyrics/lyric']
    },
    // 添加 WASM 支持配置
    assetsInclude: ['**/*.wasm'],
    // SSR配置
    ssr: {
      noExternal: process.env.NETLIFY ? ['drizzle-orm', 'postgres'] : (process.env.VERCEL ? [] : ['drizzle-orm', 'postgres'])
    }
  }
})
