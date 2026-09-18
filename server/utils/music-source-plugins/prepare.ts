import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { MUSIC_PLUGIN_LIMITS } from '../../config/constants.ts'
import { requestNetwork } from './network.ts'
import { pluginError } from './errors.ts'

let preparing: Promise<string> | undefined
// 构建工具会按字面量文本替换 process.env 下的 NODE_ENV，命中 define 的键名会让 esbuild 收到非法标识符，故拼接键名
const nodeEnvKey = ['process', 'env', 'NODE_ENV'].join('.')
export function preparePrelude(): Promise<string> {
  return preparing ||= (async () => {
    const buffer = await build({ stdin: { contents: 'export { Buffer } from "buffer"', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: '__guestBuffer', platform: 'browser', minify: true })
    const result = await build({
    entryPoints: [resolve(process.cwd(), 'server/utils/music-source-plugins/guest.js')],
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', minify: true,
    define: { [nodeEnvKey]: '"production"' },
    plugins: [{ name: 'guest-no-node', setup(builder) {
      builder.onResolve({ filter: /^(node:)?crypto$/ }, () => ({ path: 'crypto', namespace: 'guest-empty' }))
      builder.onLoad({ filter: /.*/, namespace: 'guest-empty' }, () => ({ contents: 'export default {}' }))
    } }]
    })
    return buffer.outputFiles![0]!.text + '\nglobalThis.Buffer=__guestBuffer.Buffer;\n' + result.outputFiles![0]!.text
  })().catch((error) => { preparing = undefined; throw error })
}

export function codeHash(source: string) { return createHash('sha256').update(source).digest('hex') }

export async function downloadScript(url: string, signal?: AbortSignal) {
  const result = await requestNetwork(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }, MUSIC_PLUGIN_LIMITS.scriptBytes)
  if (result.status !== 200) throw pluginError('PLUGIN_LOAD_FAILED')
  const source = result.bytes.toString('utf8').replace(/^\uFEFF/, '')
  if (!source.trim() || /^\s*(<!doctype|<html)/i.test(source)) throw pluginError('PLUGIN_LOAD_FAILED')
  return { source, hash: codeHash(source) }
}
