import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'app/')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [
      vue(),
      wasm(),
      topLevelAwait(),
      glsl()
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'app/'),
        '~': resolve(__dirname, 'app/'),
        '~/': resolve(__dirname, 'app/'),
        '@applemusic-like-lyrics/core/style.css': resolve(__dirname, 'vendor/amll-core/src/styles/index.css'),
        '@applemusic-like-lyrics/core': resolve(__dirname, 'vendor/amll-core/src/index.ts')
      }
    },
    optimizeDeps: {
      exclude: ['@applemusic-like-lyrics/vue', '@applemusic-like-lyrics/lyric']
    },
    assetsInclude: ['**/*.wasm']
  }
})
