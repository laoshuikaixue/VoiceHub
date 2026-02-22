import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.voicehub.app',
  productName: 'VoiceHub',
  copyright: 'Copyright © VoiceHub 2026',
  directories: {
    buildResources: 'build',
    output: 'dist-electron'
  },
  files: [
    'out/**',
    '!**/.vscode/*',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc,CHANGELOG.md,README.md}',
    '!{.env,.env.*,.npmrc,package-lock.json}'
  ],
  asarUnpack: [],
  win: {
    executableName: 'VoiceHub',
    icon: 'public/favicon.ico',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'arm64']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ]
  },
  nsis: {
    oneClick: false,
    artifactName: '${productName}-${version}-${arch}-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always',
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'public/favicon.ico',
    uninstallerIcon: 'public/favicon.ico'
  },
  portable: {
    artifactName: '${productName}-${version}-${arch}-portable.${ext}'
  },
  mac: {
    executableName: 'VoiceHub',
    icon: 'public/favicon.ico',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    identity: null,
    hardenedRuntime: false,
    notarize: false,
    gatekeeperAssess: false,
    darkModeSupport: true,
    category: 'public.app-category.music',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ]
  },
  linux: {
    executableName: 'voicehub',
    icon: 'public/favicon.ico',
    artifactName: '${name}-${version}-${arch}.${ext}',
    target: [
      {
        target: 'AppImage',
        arch: ['x64', 'arm64']
      },
      {
        target: 'deb',
        arch: ['x64', 'arm64']
      },
      {
        target: 'rpm',
        arch: ['x64', 'arm64']
      }
    ],
    category: 'Audio;Music;AudioVideo;'
  },
  npmRebuild: false,
  electronDownload: {
    mirror: 'https://npmmirror.com/mirrors/electron/'
  },
  publish: []
}

export default config
