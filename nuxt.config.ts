import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { fileURLToPath } from 'url'

// 解析自定义 SEO 和 PWA 配置
let customSeoConfig: { title?: string; shortName?: string; description?: string; logo?: string } =
  {}
try {
  if (process.env.NUXT_PUBLIC_SEO_CONFIG) {
    customSeoConfig = JSON.parse(process.env.NUXT_PUBLIC_SEO_CONFIG)
  }
} catch (e) {
  console.warn('解析 NUXT_PUBLIC_SEO_CONFIG 失败，请检查 JSON 格式:', e)
}

const siteTitle =
  customSeoConfig.title || process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub校园广播站点歌系统'
const siteShortName = customSeoConfig.shortName || '校园广播'
const siteDescription =
  customSeoConfig.description ||
  process.env.NUXT_PUBLIC_SITE_DESCRIPTION ||
  '校园广播站点歌系统 - 让你的声音被听见'
const siteLogo = customSeoConfig.logo || process.env.NUXT_PUBLIC_SITE_LOGO || '/images/logo.png'

const readNumberEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback

  // For unit-interval settings (for example, Sentry sample rates), reject
  // out-of-range environment values and fall back to the safe default.
  if (fallback >= 0 && fallback <= 1) {
    return parsed >= 0 && parsed <= 1 ? parsed : fallback
  }

  return parsed
}

const ssrInlineLyricPackages = ['@applemusic-like-lyrics/lyric']

const backendSentryDsnDefault =
  'https://2fca0c8a939c8909e02c082ec847e8e8@o4508946125619200.ingest.de.sentry.io/4511244961448016'
const frontendSentryDsnDefault =
  'https://3c4fe5353816bcdce36e7cc28703c8fa@o4508946125619200.ingest.de.sentry.io/4511244934774864'
const sentryRuntimeEnabled = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET || ''

// 构造绝对路径 Logo URL 用于 SEO 标签，如果没有 host，则回退为相对路径
const host = process.env.NUXT_PUBLIC_HOST
if (!host && !siteLogo.startsWith('http') && process.env.NODE_ENV === 'production') {
  console.warn(
    '警告: 在生产环境中未配置 NUXT_PUBLIC_HOST，且 siteLogo 使用了相对路径。这可能会导致网站无法正确抓取和显示预览图。'
  )
}
const absoluteLogo =
  siteLogo.startsWith('http') || siteLogo.startsWith('//') || !host
    ? siteLogo
    : (host.startsWith('http') ? '' : 'https://') +
      host.replace(/\/$/, '') +
      '/' +
      siteLogo.replace(/^\//, '')

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
    '@unocss/nuxt',
    '@vite-pwa/nuxt',
    ...(process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event?.includes('lint')
      ? ['@nuxt/eslint']
      : [])
  ],

  // UnoCSS 配置
  unocss: {
    presets: [
      // Tailwind 3 / Windi CSS compact preset — 完全兼容 Tailwind 类名
      () => import('@unocss/preset-wind3').then(m => m.presetWind3())
    ],
    // 将 Tailwind 语义化颜色映射到 CSS 变量，实现主题自适应
    theme: {
      colors: {
        // === 主色调 ===
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-light': 'var(--primary-light)',
        'primary-border': 'var(--primary-border)',
        // === 语义色 ===
        success: 'var(--success)',
        'success-hover': 'var(--success-hover)',
        'success-light': 'var(--success-light)',
        'success-border': 'var(--success-border)',
        warning: 'var(--warning)',
        'warning-hover': 'var(--warning-hover)',
        'warning-light': 'var(--warning-light)',
        'warning-border': 'var(--warning-border)',
        error: 'var(--error)',
        'error-hover': 'var(--error-hover)',
        'error-light': 'var(--error-light)',
        'error-border': 'var(--error-border)',
        // === 靛蓝色 → 信息色 ===
        'bg-indigo-600': 'bg-info',
        'bg-indigo-500': 'bg-info',
        'text-indigo-500': 'text-info',
        'text-indigo-400': 'text-info',
        'border-indigo-600': 'border-info',
        'border-indigo-500': 'border-info',
        // === 紫色 → 信息色 ===
        'bg-purple-600': 'bg-info',
        'text-purple-600': 'text-info',
        // === 橙色 ===
        'bg-orange-500': 'bg-warning',
        'text-orange-500': 'text-warning',
        'text-orange-400': 'text-warning',
        // === 背景色 ===
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-quaternary': 'var(--bg-quaternary)',
        'bg-hover': 'var(--bg-hover)',
        // === 文字颜色 ===
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-quaternary': 'var(--text-quaternary)',
        'text-disabled': 'var(--text-disabled)',
        // === 边框颜色 ===
        'border-primary': 'var(--border-primary)',
        'border-secondary': 'var(--border-secondary)',
        'border-tertiary': 'var(--border-tertiary)',
        'border-quaternary': 'var(--border-quaternary)',
        // === Alpha 透明度变量 ===
        'primary-5': 'var(--primary-5)',
        'primary-10': 'var(--primary-10)',
        'primary-20': 'var(--primary-20)',
        'primary-30': 'var(--primary-30)',
        'primary-40': 'var(--primary-40)',
        'primary-50': 'var(--primary-50)',
        'primary-60': 'var(--primary-60)',
        'primary-80': 'var(--primary-80)',
        'primary-hover-5': 'var(--primary-hover-5)',
        'primary-hover-10': 'var(--primary-hover-10)',
        'primary-hover-20': 'var(--primary-hover-20)',
        'primary-hover-30': 'var(--primary-hover-30)',
        'success-5': 'var(--success-5)',
        'success-10': 'var(--success-10)',
        'success-20': 'var(--success-20)',
        'success-30': 'var(--success-30)',
        'success-40': 'var(--success-40)',
        'success-50': 'var(--success-50)',
        'success-70': 'var(--success-70)',
        'success-80': 'var(--success-80)',
        'success-hover-5': 'var(--success-hover-5)',
        'success-hover-10': 'var(--success-hover-10)',
        'success-hover-20': 'var(--success-hover-20)',
        'warning-5': 'var(--warning-5)',
        'warning-10': 'var(--warning-10)',
        'warning-15': 'var(--warning-15)',
        'warning-20': 'var(--warning-20)',
        'warning-25': 'var(--warning-25)',
        'warning-30': 'var(--warning-30)',
        'warning-40': 'var(--warning-40)',
        'warning-50': 'var(--warning-50)',
        'warning-80': 'var(--warning-80)',
        'warning-200': 'var(--warning-200)',
        'warning-300': 'var(--warning-300)',
        'warning-hover-5': 'var(--warning-hover-5)',
        'warning-hover-10': 'var(--warning-hover-10)',
        'warning-hover-15': 'var(--warning-hover-15)',
        'warning-hover-20': 'var(--warning-hover-20)',
        'warning-hover-25': 'var(--warning-hover-25)',
        'warning-hover-30': 'var(--warning-hover-30)',
        'warning-hover-40': 'var(--warning-hover-40)',
        'warning-hover-50': 'var(--warning-hover-50)',
        'error-5': 'var(--error-5)',
        'error-10': 'var(--error-10)',
        'error-15': 'var(--error-15)',
        'error-20': 'var(--error-20)',
        'error-30': 'var(--error-30)',
        'error-40': 'var(--error-40)',
        'error-50': 'var(--error-50)',
        'error-60': 'var(--error-60)',
        'error-70': 'var(--error-70)',
        'error-80': 'var(--error-80)',
        'error-hover-5': 'var(--error-hover-5)',
        'error-hover-10': 'var(--error-hover-10)',
        'error-hover-15': 'var(--error-hover-15)',
        'error-hover-20': 'var(--error-hover-20)',
        'error-hover-30': 'var(--error-hover-30)',
        'info-5': 'var(--info-5)',
        'info-10': 'var(--info-10)',
        'info-20': 'var(--info-20)',
        'info-30': 'var(--info-30)',
        'info-40': 'var(--info-40)',
        'info-50': 'var(--info-50)',
        'info-hover-5': 'var(--info-hover-5)',
        'info-hover-10': 'var(--info-hover-10)',
        'info-hover-20': 'var(--info-hover-20)',
        'info-hover-30': 'var(--info-hover-30)',
        'info-hover-40': 'var(--info-hover-40)',
        'info-hover-50': 'var(--info-hover-50)',
        'bg-primary-5': 'var(--bg-primary-5)',
        'bg-primary-10': 'var(--bg-primary-10)',
        'bg-primary-20': 'var(--bg-primary-20)',
        'bg-primary-25': 'var(--bg-primary-25)',
        'bg-primary-30': 'var(--bg-primary-30)',
        'bg-primary-40': 'var(--bg-primary-40)',
        'bg-primary-45': 'var(--bg-primary-45)',
        'bg-primary-50': 'var(--bg-primary-50)',
        'bg-primary-60': 'var(--bg-primary-60)',
        'bg-primary-70': 'var(--bg-primary-70)',
        'bg-primary-80': 'var(--bg-primary-80)',
        'bg-primary-85': 'var(--bg-primary-85)',
        'bg-primary-90': 'var(--bg-primary-90)',
        'bg-primary-95': 'var(--bg-primary-95)',
        'bg-secondary-5': 'var(--bg-secondary-5)',
        'bg-secondary-10': 'var(--bg-secondary-10)',
        'bg-secondary-15': 'var(--bg-secondary-15)',
        'bg-secondary-20': 'var(--bg-secondary-20)',
        'bg-secondary-30': 'var(--bg-secondary-30)',
        'bg-secondary-40': 'var(--bg-secondary-40)',
        'bg-secondary-50': 'var(--bg-secondary-50)',
        'bg-secondary-60': 'var(--bg-secondary-60)',
        'bg-secondary-70': 'var(--bg-secondary-70)',
        'bg-secondary-80': 'var(--bg-secondary-80)',
        'bg-secondary-90': 'var(--bg-secondary-90)',
        'bg-secondary-95': 'var(--bg-secondary-95)',
        'bg-tertiary-20': 'var(--bg-tertiary-20)',
        'bg-tertiary-30': 'var(--bg-tertiary-30)',
        'bg-tertiary-40': 'var(--bg-tertiary-40)',
        'bg-tertiary-50': 'var(--bg-tertiary-50)',
        'bg-tertiary-60': 'var(--bg-tertiary-60)',
        'bg-tertiary-70': 'var(--bg-tertiary-70)',
        'bg-tertiary-80': 'var(--bg-tertiary-80)',
        'bg-quaternary-50': 'var(--bg-quaternary-50)',
        'border-secondary-30': 'var(--border-secondary-30)',
        'border-secondary-40': 'var(--border-secondary-40)',
        'border-secondary-50': 'var(--border-secondary-50)',
        'border-secondary-60': 'var(--border-secondary-60)',
        'border-secondary-70': 'var(--border-secondary-70)',
        'border-secondary-80': 'var(--border-secondary-80)',
        'border-tertiary-30': 'var(--border-tertiary-30)',
        'border-tertiary-50': 'var(--border-tertiary-50)',
        'text-primary-10': 'var(--text-primary-10)',
        'text-primary-20': 'var(--text-primary-20)',
        'text-primary-60': 'var(--text-primary-60)',
        'text-primary-80': 'var(--text-primary-80)',
        'text-error-20': 'var(--text-error-20)',
        'text-error-50': 'var(--text-error-50)',
        'text-error-60': 'var(--text-error-60)',
        'text-error-70': 'var(--text-error-70)',
        'text-error-80': 'var(--text-error-80)',
        'text-success-50': 'var(--text-success-50)',
        'text-success-70': 'var(--text-success-70)',
        'text-success-80': 'var(--text-success-80)',
        'text-warning-80': 'var(--text-warning-80)',

        // === 用途化变量 — 品牌色 ===
        'brand-blue': 'var(--brand-blue)',
        'brand-blue-light': 'var(--brand-blue-light)',
        'brand-blue-hover': 'var(--brand-blue-hover)',
        'brand-blue-light-hover': 'var(--brand-blue-light-hover)',
        'brand-blue-glow': 'var(--brand-blue-glow)',
        'brand-red': 'var(--brand-red)',
        'brand-red-light': 'var(--brand-red-light)',
        'brand-red-hover': 'var(--brand-red-hover)',
        'brand-red-glow': 'var(--brand-red-glow)',
        'brand-green': 'var(--brand-green)',
        'brand-green-light': 'var(--brand-green-light)',
        'brand-green-hover': 'var(--brand-green-hover)',
        'brand-green-glow': 'var(--brand-green-glow)',
        'brand-yellow': 'var(--brand-yellow)',
        'brand-yellow-light': 'var(--brand-yellow-light)',
        'brand-yellow-hover': 'var(--brand-yellow-hover)',
        'brand-orange': 'var(--brand-orange)',
        'brand-orange-hover': 'var(--brand-orange-hover)',
        'brand-orange-glow': 'var(--brand-orange-glow)',
        'brand-purple': 'var(--brand-purple)',
        'brand-purple-hover': 'var(--brand-purple-hover)',
        'brand-purple-light': 'var(--brand-purple-light)',
        'brand-purple-lighter': 'var(--brand-purple-lighter)',
        'brand-purple-glow': 'var(--brand-purple-glow)',
        'brand-pink': 'var(--brand-pink)',
        'brand-cyan': 'var(--brand-cyan)',
        'brand-teal': 'var(--brand-teal)',
        'brand-indigo': 'var(--brand-indigo)',
        'brand-indigo-hover': 'var(--brand-indigo-hover)',

        // === 用途化变量 — 面板背景色 ===
        'panel-surface': 'var(--panel-surface)',
        'panel-surface-alt': 'var(--panel-surface-alt)',
        'panel-surface-hover': 'var(--panel-surface-hover)',
        'panel-surface-deep': 'var(--panel-surface-deep)',
        'panel-surface-deepest': 'var(--panel-surface-deepest)',
        'panel-surface-overlay': 'var(--panel-surface-overlay)',
        'panel-surface-elevated': 'var(--panel-surface-elevated)',
        'panel-surface-dialog': 'var(--panel-surface-dialog)',
        'panel-surface-subtle': 'var(--panel-surface-subtle)',
        'panel-surface-tertiary': 'var(--panel-surface-tertiary)',
        'panel-surface-quaternary': 'var(--panel-surface-quaternary)',
        'panel-surface-contrast': 'var(--panel-surface-contrast)',
        'panel-surface-dark': 'var(--panel-surface-dark)',
        'panel-surface-darker': 'var(--panel-surface-darker)',
        'panel-surface-darkest': 'var(--panel-surface-darkest)',
        'panel-surface-compact': 'var(--panel-surface-compact)',
        'panel-surface-flat': 'var(--panel-surface-flat)',
        'panel-surface-raised': 'var(--panel-surface-raised)',
        'panel-surface-inset': 'var(--panel-surface-inset)',

        // === 用途化变量 — 文字灰度 ===
        'text-muted': 'var(--text-muted)',
        'text-muted-light': 'var(--text-muted-light)',
        'text-muted-dark': 'var(--text-muted-dark)',
        'text-tertiary-hover': 'var(--text-tertiary-hover)',
        'text-primary-light': 'var(--text-primary-light)',
        'text-primary-lighter': 'var(--text-primary-lighter)',
        'text-link': 'var(--text-link)',
        'text-link-hover': 'var(--text-link-hover)',
        'text-highlight': 'var(--text-highlight)',

        // === 用途化变量 — 边框与分割线 ===
        'panel-border': 'var(--panel-border)',
        'panel-border-active': 'var(--panel-border-active)',
        'panel-border-subtle': 'var(--panel-border-subtle)',
        'panel-border-light': 'var(--panel-border-light)',
        'panel-border-dark': 'var(--panel-border-dark)',
        'panel-border-highlight': 'var(--panel-border-highlight)',
        'panel-border-brand': 'var(--panel-border-brand)',
        'panel-border-error': 'var(--panel-border-error)',

        // === 用途化变量 — 状态色 ===
        'status-info-bg': 'var(--status-info-bg)',
        'status-info-border': 'var(--status-info-border)',
        'status-info-glow': 'var(--status-info-glow)',
        'status-info-icon': 'var(--status-info-icon)',
        'status-success-icon': 'var(--status-success-icon)',
        'status-warning-icon': 'var(--status-warning-icon)',
        'status-error-icon': 'var(--status-error-icon)',
        'status-error-deep': 'var(--status-error-deep)',

        // === 卡片 ===
        'card-bg': 'var(--card-bg)',
        'card-border': 'var(--card-border)',
        'card-hover-border': 'var(--card-hover-border)',
        // === 输入框 ===
        'input-bg': 'var(--input-bg)',
        'input-border': 'var(--input-border)',
        'input-text': 'var(--input-text)',
        'input-placeholder': 'var(--input-placeholder)',
        // === 模态框 ===
        'modal-bg': 'var(--modal-bg)',
        'modal-border': 'var(--modal-border)',
      },
      // 圆角映射
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      // 间距映射
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        '3xl': 'var(--spacing-3xl)',
      },
    },
  },

  // 引入全局CSS
  css: [
    '~/assets/css/variables.css',
    '~/assets/css/components.css',
    '~/assets/css/main.css',
    '~/assets/css/transitions.css',
    '~/assets/css/mobile-admin.css',
    '~/assets/css/print-fix.css',
    '~/assets/css/sf-pro-icons.css',
    '~/assets/css/markdown.css'
  ],

  // 配置运行时配置
  runtimeConfig: {
    // 服务器私有键（不会暴露到客户端）
    jwtSecret,
    // Redis配置（可选）
    redisUrl: process.env.REDIS_URL || '',
    sentry: {
      dsn: process.env.SENTRY_DSN || backendSentryDsnDefault,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release:
        process.env.SENTRY_RELEASE ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.COMMIT_REF ||
        '',
      tracesSampleRate: readNumberEnv(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
      enabled: sentryRuntimeEnabled
    },
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
      isNetlify: process.env.NETLIFY === 'true',
      sentry: {
        dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || frontendSentryDsnDefault,
        environment:
          process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT ||
          process.env.SENTRY_ENVIRONMENT ||
          process.env.NODE_ENV ||
          'development',
        release:
          process.env.NUXT_PUBLIC_SENTRY_RELEASE ||
          process.env.SENTRY_RELEASE ||
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.COMMIT_REF ||
          '',
        tracesSampleRate: readNumberEnv(
          process.env.NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ||
            process.env.SENTRY_TRACES_SAMPLE_RATE,
          0.1
        ),
        replaysSessionSampleRate: readNumberEnv(
          process.env.NUXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
          0
        ),
        replaysOnErrorSampleRate: readNumberEnv(
          process.env.NUXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
          0
        ),
        enabled: sentryRuntimeEnabled
      }
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
          crossorigin: 'anonymous',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css'
        },
        {
          rel: 'stylesheet',
          crossorigin: 'anonymous',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css'
        },
        // 延迟加载其他字重，避免阻塞页面渲染
        {
          rel: 'preload',
          as: 'style',
          crossorigin: 'anonymous',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Medium.min.css',
          onload: "this.onload=null;this.rel='stylesheet'"
        },
        {
          rel: 'preload',
          as: 'style',
          crossorigin: 'anonymous',
          href: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Semibold.min.css',
          onload: "this.onload=null;this.rel='stylesheet'"
        },
        {
          rel: 'preload',
          as: 'style',
          crossorigin: 'anonymous',
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
    externals: {
      inline: ssrInlineLyricPackages
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
    plugins: [wasm(), topLevelAwait()],
    optimizeDeps: {
      include: ['drizzle-orm'],
      exclude: [
        '@applemusic-like-lyrics/vue',
        '@applemusic-like-lyrics/lyric',
        '#app-manifest',
        'nuxt'
      ]
    },
    build: {
      target: 'esnext',
      // Vite 8 默认使用 Lightning CSS，会把连续声明中的标准毛玻璃属性误判为重复项
      cssMinify: 'esbuild',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('@lucide/vue')) return 'icons'
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
      noExternal: [
        ...(process.env.VERCEL ? [] : ['drizzle-orm', 'postgres']),
        ...ssrInlineLyricPackages
      ]
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
