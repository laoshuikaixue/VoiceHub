import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legacyPluginPlatformKey, pluginIdFromPlatform, pluginPlatformKey } from '../../server/utils/music-source-plugins/platform.ts'
import { extractPluginName } from '../../server/utils/music-source-plugins/runtime.ts'

test('插件平台键统一使用 plugin 前缀并兼容旧 musicfree 前缀', () => {
  assert.equal(pluginPlatformKey('b6f2f0d8-0000-4000-8000-000000000000'), 'plugin:b6f2f0d8-0000-4000-8000-000000000000')
  assert.equal(legacyPluginPlatformKey('旧插件'), 'musicfree:旧插件')
  assert.equal(pluginIdFromPlatform('plugin:b6f2f0d8-0000-4000-8000-000000000000'), 'b6f2f0d8-0000-4000-8000-000000000000')
  assert.equal(pluginIdFromPlatform('musicfree:旧插件'), '旧插件')
  assert.equal(pluginIdFromPlatform('netease'), null)
  assert.equal(pluginIdFromPlatform('musicfree'), null)
})

test('插件名称从脚本注释的 @name 读取', () => {
  assert.equal(extractPluginName('/**\n * @name 统一音乐源\n * @version 1.0.0\n */'), '统一音乐源')
  assert.equal(extractPluginName('/*!\n * @name: lx-玉宁熙-Pro\n */'), 'lx-玉宁熙-Pro')
  assert.equal(extractPluginName('/* @name：中文冒号 */'), '中文冒号')
  assert.equal(extractPluginName('module.exports={}'), '')
})
