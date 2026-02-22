import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import glsl from 'vite-plugin-glsl'
import { fileURLToPath } from 'url'

// Desktop client specific configuration
export default defineNuxtConfig({
  compatibilityDate: '2026-01-30',
  future: {
    compatibilityVersion: 4
  },
  srcDir: 'app/',
  
  // 关键：关闭SSR，启用SPA模式
  ssr: false,
  
  devtools: { enabled: false },
  
  modules: ['@nuxtjs/tailwindcss'],

  css: [
    '~/assets/css/variables.css',
    '~/assets/css/components.css',
    '~/assets/css/main.css',
    '~/assets/css/transitions.css',
    '~/assets/css/mobile-admin.css',
    '~/assets/css/print-fix.css',
    '~/assets/css/sf-pro-icons.css'
  ],

  runtimeConfig: {
    public: {
      apiBase: '/api',
      oauth: {
        github: false,
        casdoor: false,
        google: false
      },
      siteTitle: 'VoiceHub 桌面客户端',
      siteLogo: '',
      siteDescription: 'VoiceHub 桌面客户端 - 校园广播站点歌管理系统',
      isNetlify: false,
      isDesktop: true // 标识桌面环境
    }
  },

  app: {
    // 使用相对路径，适配file://协议
    baseURL: './',
    buildAssetsDir: 'assets',
    
    // 使用Hash路由模式
    router: {
      options: {
        hashMode: true
      }
    },
    
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    
    head: {
      title: 'VoiceHub 桌面客户端',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        },
        {
          name: 'description',
          content: 'VoiceHub 桌面客户端 - 校园广播站点歌管理系统'
        },
        { name: 'theme-color', content: '#111111' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: './favicon.ico?v=2' },
        {
          rel: 'stylesheet',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css'
        }
      ]
    }
  },

  features: {
    inlineStyles: true
  },

  typescript: {
    strict: true
  },

  // 桌面端不需要Nitro服务器
  nitro: {
    preset: 'static'
  },

  vite: {
    resolve: {
      alias: [
        {
          find: '@applemusic-like-lyrics/core/style.css',
          replacement: fileURLToPath(
            new URL('./vendor/amll-core/src/styles/index.css', import.meta.url)
          )
        },
        {
          find: '@applemusic-like-lyrics/core',
          replacement: fileURLToPath(new URL('./vendor/amll-core/src/index.ts', import.meta.url))
        }
      ]
    },
    plugins: [wasm(), topLevelAwait(), glsl()],
    optimizeDeps: {
      exclude: ['@applemusic-like-lyrics/vue', '@applemusic-like-lyrics/lyric']
    },
    assetsInclude: ['**/*.wasm'],
    // 桌面端构建优化
    build: {
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false // 保留console用于调试
        }
      }
    }
  }
})
