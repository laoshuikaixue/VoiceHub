import { newQuickJSWASMModuleFromVariant, type QuickJSContext, type QuickJSHandle, type QuickJSRuntime } from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-singlefile-browser-release-sync'
import { createCipheriv, createHash, publicEncrypt, constants, randomBytes } from 'node:crypto'
import { inflate, deflate } from 'node:zlib'
import { promisify } from 'node:util'
import { MUSIC_PLUGIN_LIMITS as limits } from '../../config/constants.ts'
import { getServerTimestamp } from '../serverTime.ts'
import { requestNetwork } from './network.ts'
import { pluginError } from './errors.ts'
import type { PluginCapability, PluginProtocol } from './types.ts'

const loading = newQuickJSWASMModuleFromVariant(variant)
let active = 0

export function extractPluginName(source: string) {
  const match = source.match(/@name\s*[:：]?\s*([^\r\n*]+)/i)
  return match?.[1]?.trim().slice(0, 100) || ''
}

function dump(context: QuickJSContext, handle: QuickJSHandle) {
  const value = context.dump(handle)
  if (JSON.stringify(value)?.length > limits.responseBytes) throw pluginError('PLUGIN_LOAD_FAILED')
  return value
}

/** 每次任务独立堆和 HTTP 生命周期，异步回调不跨任务共享状态。 */
export async function runPlugin(options: {
  source: string; prelude: string; protocol: PluginProtocol; variables?: Record<string, string>
  action?: string; params?: unknown; signal?: AbortSignal; timeout?: number
}): Promise<{ capability: PluginCapability; result?: any }> {
  const controller = new AbortController()
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal
  const deadline = getServerTimestamp() + (options.timeout || limits.callMs)
  let timer: ReturnType<typeof setTimeout> | undefined
  let context: QuickJSContext | undefined
  let runtime: QuickJSRuntime | undefined
  let occupied = false
  let disposed = false
  let calls = 0
  const tasks = new Set<Promise<void>>()
  const waiting = new Set<any>()
  const controllers = new Map<number, AbortController>()
  try {
    // 占用计数必须紧邻 try，否则中途抛出会永久漏出并发槽
    if (active >= limits.concurrency) throw pluginError('PLUGIN_UNAVAILABLE', 503)
    active++
    occupied = true
    timer = setTimeout(() => controller.abort(), Math.max(1, deadline - getServerTimestamp()))
    const module = await loading
    runtime = module.newRuntime()
    runtime.setMemoryLimit(limits.memoryBytes)
    runtime.setMaxStackSize(512 * 1024)
    runtime.setInterruptHandler(() => signal.aborted || getServerTimestamp() >= deadline)
    context = runtime.newContext()
    const ctx = context
    const sync = ctx.newFunction('__hostSync', (methodHandle, argsHandle) => {
      try {
        const method = ctx.getString(methodHandle)
        const serialized = ctx.getString(argsHandle)
        if (serialized.length > limits.itemBytes) throw new Error('输入过大')
        const args = JSON.parse(serialized)
        let result: any = null
        if (method === 'abort') { controllers.get(Number(args))?.abort() }
        else if (method === 'random') {
          if (!Number.isInteger(args) || args < 0 || args > 65536) throw new Error('长度无效')
          result = Array.from(randomBytes(args))
        } else if (method === 'md5') result = createHash('md5').update(Buffer.from(args)).digest('hex')
        else if (method === 'aes') {
          const cipher = createCipheriv(String(args[1]), Buffer.from(args[2]), args[3] ? Buffer.from(args[3]) : null)
          result = Array.from(Buffer.concat([cipher.update(Buffer.from(args[0])), cipher.final()]))
        } else if (method === 'rsa') {
          const data = Buffer.from(args[0])
          result = Array.from(publicEncrypt({ key: String(args[1]), padding: constants.RSA_NO_PADDING }, Buffer.concat([Buffer.alloc(Math.max(0, 128 - data.length)), data])))
        } else if (method === 'log') { /* 宿主不采集插件日志，直接接受，避免插件的 console 输出打断执行 */ }
        else throw new Error('未知宿主能力')
        return ctx.newString(JSON.stringify(result))
      } catch { throw new Error('Host operation rejected') }
    })
    ctx.setProp(ctx.global, '__hostSync', sync); sync.dispose()
    const asyncBridge = ctx.newFunction('__hostAsync', (methodHandle, argsHandle) => {
      const method = ctx.getString(methodHandle)
      const serialized = ctx.getString(argsHandle)
      if (serialized.length > limits.responseBytes || ++calls > limits.requests) throw new Error('Host limit reached')
      const deferred = ctx.newPromise()
      waiting.add(deferred)
      const task = (async () => {
        try {
          const args = JSON.parse(serialized)
          let result: unknown
          if (method === 'http') {
            const child = new AbortController()
            controllers.set(args.id, child)
            const response = await requestNetwork(String(args.url), {
              method: args.method, headers: args.headers, body: args.body ? Uint8Array.from(args.body) : undefined,
              signal: AbortSignal.any([signal, child.signal, AbortSignal.timeout(Math.min(limits.callMs, Math.max(1, Number(args.timeout) || limits.callMs)))])
            })
            controllers.delete(args.id)
            result = { status: response.status, headers: response.headers, bytes: Array.from(response.bytes) }
          } else if (method === 'sleep') {
            await new Promise<void>((resolve, reject) => {
              const delay = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, Math.min(Number(args) || 0, limits.callMs))
              const cancel = () => { clearTimeout(delay); reject(pluginError('PLUGIN_TIMEOUT')) }
              signal.addEventListener('abort', cancel, { once: true })
              if (signal.aborted) cancel()
            })
            result = null
          } else if (method === 'inflate' || method === 'deflate') {
            const bytes = await promisify(method === 'inflate' ? inflate : deflate)(Buffer.from(args), { maxOutputLength: limits.responseBytes })
            result = Array.from(bytes)
          } else throw pluginError('PLUGIN_LOAD_FAILED')
          if (!disposed && !signal.aborted) {
            const handle = ctx.newString(JSON.stringify(result))
            deferred.resolve(handle); handle.dispose()
          }
        } catch {
          if (!disposed && !signal.aborted) { const error = ctx.newError('Host request failed'); deferred.reject(error); error.dispose() }
        }
      })().finally(() => tasks.delete(task))
      tasks.add(task)
      return deferred.handle
    })
    ctx.setProp(ctx.global, '__hostAsync', asyncBridge); asyncBridge.dispose()
    const evaluate = (code: string) => {
      const result = ctx.evalCode(code)
      if (result.error) { result.error.dispose(); throw pluginError(signal.aborted || getServerTimestamp() >= deadline ? 'PLUGIN_TIMEOUT' : 'PLUGIN_LOAD_FAILED') }
      return result.value
    }
    evaluate(options.prelude).dispose()
    evaluate(`globalThis.__variables=${JSON.stringify(options.variables || {})};lx.currentScriptInfo=${JSON.stringify({ name: extractPluginName(options.source) || 'VoiceHub', rawScript: options.source, version: '', description: '', author: '', homepage: '' })}`).dispose()
    evaluate(options.source).dispose()
    const awaitGuest = async (code: string) => {
      const handle = evaluate(code)
      try {
        while (true) {
          if (signal.aborted || getServerTimestamp() >= deadline) throw pluginError('PLUGIN_TIMEOUT')
          const jobs = runtime.executePendingJobs(16)
          if (jobs.error) { jobs.error.dispose(); throw pluginError('PLUGIN_LOAD_FAILED') }
          const state = ctx.getPromiseState(handle)
          if (state.type === 'fulfilled') { try { return dump(ctx, state.value) } finally { state.value.dispose() } }
          if (state.type === 'rejected') { state.error.dispose(); throw pluginError('PLUGIN_LOAD_FAILED') }
          await new Promise((resolve) => setTimeout(resolve, 2))
        }
      } finally { handle.dispose() }
    }
    const capability = await awaitGuest(`__inspect(${JSON.stringify(options.protocol)})`) as PluginCapability
    if (!capability || !['lx', 'musicfree'].includes(capability.protocol) || Object.keys(capability.sources || {}).length > 20) throw pluginError('PLUGIN_LOAD_FAILED')
    for (const value of Object.values(capability.sources)) {
      if (!value || !Array.isArray(value.actions) || !Array.isArray(value.qualities) || value.actions.length > 20 || value.qualities.length > 20 || [...value.actions, ...value.qualities].some((v) => typeof v !== 'string' || v.length > 100)) throw pluginError('PLUGIN_LOAD_FAILED')
    }
    const result = options.action ? await awaitGuest(`__invoke(${JSON.stringify(options.action)},${JSON.stringify(options.params || {})})`) : undefined
    return { capability, result }
  } finally {
    disposed = true
    if (timer) clearTimeout(timer)
    controller.abort()
    for (const child of controllers.values()) child.abort()
    for (const promise of waiting) { try { promise.dispose() } catch {} }
    // 分别释放，任一步抛出都不能漏掉另一个，否则 runtime 与其堆内存常驻
    if (context) { try { context.dispose() } catch {} }
    if (runtime) { try { runtime.dispose() } catch {} }
    if (occupied) active--
  }
}
