// 部署快照由 scripts/build-music-source-plugins.ts 写入 ./manifest.snapshot.ts（构建产物，不纳入版本控制）。
// 常驻部署不需要快照：prelude 为空时运行期由 preparePrelude() 现场构建。
export { pluginManifest } from './manifest.snapshot'
