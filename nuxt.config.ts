import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import glsl from 'vite-plugin-glsl'
import { fileURLToPath } from 'url'

// 解析自定义 SEO 和 PWA 配置
let customSeoConfig: { title?: string; shortName?: string; description?: string; logo?: string } = {}
try {
  if (process.env.NUXT_PUBLIC_SEO_CONFIG) {
    customSeoConfig = JSON.parse(process.env.NUXT_PUBLIC_SEO_CONFIG)
  }
} catch (e) {
  console.warn('解析 NUXT_PUBLIC_SEO_CONFIG 失败，请检查 JSON 格式:', e)
}

const siteTitle = customSeoConfig.title || process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub校园广播站点歌系统'
const siteShortName = customSeoConfig.shortName || '校园广播'
const siteDescription = customSeoConfig.description || process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见'
const siteLogo = customSeoConfig.logo || process.env.NUXT_PUBLIC_SITE_LOGO || '/images/logo.png'

// 构造绝对路径 Logo URL 用于 SEO 标签，如果没有 host，则回退为相对路径
const host = process.env.NUXT_PUBLIC_HOST
if (!host && !siteLogo.startsWith('http') && process.env.NODE_ENV === 'production') {
  console.warn(
    '警告: 在生产环境中未配置 NUXT_PUBLIC_HOST，且 siteLogo 使用了相对路径。这可能会导致网站无法正确抓取和显示预览图。'
  )
}
const absoluteLogo = (siteLogo.startsWith('http') || siteLogo.startsWith('//') || !host)
  ? siteLogo
  : (host.startsWith('http') ? '' : 'https://') + host.replace(/\/$/, '') + '/' + siteLogo.replace(/^\//, '')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-01-30',
  future: {
    compatibilityVersion: 4
  },
  srcDir: 'app',
  serverDir: fileURLToPath(new URL('./server', import.meta.url)),
  dir: {
    public: fileURLToPath(new URL('./public', import.meta.url))
  },
  devtools: { enabled: process.env.NODE_ENV === 'development' },
  devServer: {
    host: '0.0.0.0', // 允许局域网访问
    port: 3000
  },
  modules: [
    '@nuxtjs/tailwindcss',
    '@vite-pwa/nuxt',
    ...(process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event?.includes('lint')
      ? ['@nuxt/eslint']
      : [])
  ],

  // 引入全局CSS
  css: [
    '~/assets/css/variables.css',
    '~/assets/css/components.css',
    '~/assets/css/main.css',
    '~/assets/css/transitions.css',
    '~/assets/css/mobile-admin.css',
    '~/assets/css/print-fix.css',
    '~/assets/css/sf-pro-icons.css'
  ],

  // 配置运行时配置
  runtimeConfig: {
    // 服务器私有键（不会暴露到客户端）
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    // Redis配置（可选）
    redisUrl: process.env.REDIS_URL || '',
    // 公共键（会暴露到客户端）
    public: {
      host: process.env.NUXT_PUBLIC_HOST || '', // 用于 CORS 和反向代理的主机名验证
      apiBase: '/api',
      oauth: {
        github: !!process.env.GITHUB_CLIENT_ID,
        casdoor: !!process.env.CASDOOR_CLIENT_ID,
        google: !!process.env.GOOGLE_CLIENT_ID
      },
      siteTitle,
      siteLogo,
      siteDescription,
      isNetlify: process.env.NETLIFY === 'true'
    }
  },

  // 配置环境变量
  app: {
    head: {
      title: siteTitle,
      meta: [
        { charset: 'utf-8' },
        { name: 'referrer', content: 'no-referrer' },
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        },
        {
          name: 'description',
          content: siteDescription
        },
        // Open Graph 标签
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: siteTitle },
        { property: 'og:description', content: siteDescription },
        { property: 'og:site_name', content: siteTitle },
        { property: 'og:image', content: absoluteLogo },
        // Twitter 标签
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: siteTitle },
        { name: 'twitter:description', content: siteDescription },
        { name: 'twitter:image', content: absoluteLogo },
        // 移动端优化
        { name: 'theme-color', content: '#111111' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: siteShortName },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        // 优先加载常规字体，确保页面快速显示
        {
          rel: 'preload',
          as: 'style',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css'
        },
        {
          rel: 'stylesheet',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css'
        },
        // 延迟加载其他字重，避免阻塞页面渲染
        {
          rel: 'preload',
          as: 'style',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Medium.min.css',
          onload: "this.onload=null;this.rel='stylesheet'"
        },
        {
          rel: 'preload',
          as: 'style',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Semibold.min.css',
          onload: "this.onload=null;this.rel='stylesheet'"
        },
        {
          rel: 'preload',
          as: 'style',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Bold.min.css',
          onload: "this.onload=null;this.rel='stylesheet'"
        }
      ]
    }
  },

  features: {
    inlineStyles: false
  },

  // TypeScript配置
  typescript: {
    strict: true
  },

  // 服务器端配置
  nitro: {
    preset: process.env.VERCEL
      ? 'vercel'
      : process.env.NETLIFY
        ? 'netlify'
        : process.env.NITRO_PRESET || 'node-server',
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
          Pragma: 'no-cache',
          Expires: '0',
          Connection: 'keep-alive'
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
          Pragma: 'no-cache',
          Expires: '0'
        }
      },
      '/dashboard': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      },
      '/change-password': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      },
      '/auth/**': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      },
      '/notification-settings': {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      }
    },
    // 根据部署环境调整配置
    ...(process.env.VERCEL
      ? {
          // Vercel 环境：使用标准配置
        }
      : process.env.NETLIFY
        ? {
            // Netlify 环境：确保 Drizzle 正确打包
            experimental: {
              wasm: true
            }
          }
        : {
            // 其他环境：使用标准配置
          })
  },

  // Vite 配置
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
      include: ['drizzle-orm'],
      exclude: ['@applemusic-like-lyrics/vue', '@applemusic-like-lyrics/lyric']
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('lucide-vue-next')) return 'icons'
            if (id.includes('@pixi')) return 'pixi'
            if (id.includes('@applemusic-like-lyrics')) return 'lyric-engine'
            if (id.includes('drizzle-orm') || id.includes('postgres')) return 'database'
            if (id.includes('xlsx') || id.includes('jspdf') || id.includes('jszip')) return 'office'
          }
        }
      }
    },
    // 添加 WASM 支持配置
    assetsInclude: ['**/*.wasm'],
    // SSR配置
    ssr: {
      noExternal: process.env.NETLIFY
        ? ['drizzle-orm', 'postgres']
        : process.env.VERCEL
          ? []
          : ['drizzle-orm', 'postgres']
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: siteTitle,
      short_name: siteShortName,
      description: siteDescription,
      theme_color: '#111111',
      background_color: '#111111',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/images/logo.png',
          sizes: '128x128',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/images/logo-144.png',
          sizes: '144x144',
          type: 'image/png',
          purpose: 'any'
        }
      ]
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}']
    },
    devOptions: {
      enabled: true,
      type: 'module'
    },
    injectRegister: 'auto'
  }
})
