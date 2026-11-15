import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'
import { songs as zhSongs } from '../../app/utils/locale/zh-CN.ts'
import { songs as enSongs } from '../../app/utils/locale/en-US.ts'

const filename = 'RequestForm.vue'
const component = readFileSync(
  new URL('../../app/components/Songs/RequestForm.vue', import.meta.url),
  'utf8'
)
const { descriptor } = parse(component, { filename })
const script = descriptor.scriptSetup!.content
const state = script.slice(
  script.indexOf('const showAudioMatchModal ='),
  script.indexOf('// 音源管理器')
)
const actions = script.slice(
  script.indexOf('const resetAudioMatchState ='),
  script.indexOf('const useAudioMatchResult =')
)

const deferred = <T = void>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

type MicrophoneStream = { getTracks: () => { stop: () => void }[] }
type HarnessOptions = {
  sampleRate?: number
  fallback?: boolean
  rejectLowSampleRate?: boolean
  requireMicrophoneFirst?: boolean
  microphone?: ReturnType<typeof deferred<MicrophoneStream>>
  module?: ReturnType<typeof deferred>
  response?: ReturnType<typeof deferred<unknown>>
  locale?: typeof zhSongs.requestForm | typeof enSongs.requestForm
}

const createHarness = (options: HarnessOptions = {}) => {
  const calls = {
    microphone: 0,
    contexts: [] as ({ sampleRate?: number } | undefined)[],
    fingerprints: [] as Float32Array[],
    requests: [] as [string, { body: { audioFP: string } }][],
    stopped: 0,
    rendered: [] as { channels: number; length: number; rate: number }[],
    inputRate: undefined as number | undefined,
    inputSamples: new Float32Array()
  }
  const timers = new Map<number, () => void>()
  let nextTimer = 0
  const stream = {
    getTracks: () => [
      {
        stop: () => {
          calls.stopped++
        }
      }
    ]
  }
  const createNode = () => ({ connect() {}, disconnect() {}, port: { postMessage() {} } })
  class AudioContextMock {
    sampleRate = options.sampleRate || 48000
    state = 'suspended'
    destination = {}
    audioWorklet = options.fallback
      ? undefined
      : { addModule: () => options.module?.promise || Promise.resolve() }
    constructor(config?: { sampleRate?: number }) {
      calls.contexts.push(config)
      if (options.rejectLowSampleRate && config?.sampleRate === 8000)
        throw new Error('不支持实时 8kHz')
    }
    async resume() {
      if (options.requireMicrophoneFirst && !calls.microphone)
        throw new Error('授权前无法恢复音频上下文')
      this.state = 'running'
    }
    async close() {
      this.state = 'closed'
    }
    createGain() {
      return { ...createNode(), gain: { value: 1 } }
    }
    createMediaStreamSource() {
      return createNode()
    }
    createScriptProcessor() {
      return createNode()
    }
  }
  class OfflineAudioContextMock {
    constructor(channels: number, length: number, rate: number) {
      calls.rendered.push({ channels, length, rate })
    }
    destination = {}
    createBuffer(_channels: number, length: number, rate: number) {
      calls.inputRate = rate
      const data = new Float32Array(length)
      calls.inputSamples = data
      return { getChannelData: () => data }
    }
    createBufferSource() {
      return { ...createNode(), start() {}, buffer: null }
    }
    async startRendering() {
      const data = new Float32Array(calls.rendered.at(-1)!.length)
      return { getChannelData: () => data }
    }
  }
  const window = {
    AudioContext: AudioContextMock,
    OfflineAudioContext: OfflineAudioContextMock,
    GenerateFP: async (recording: Float32Array) => {
      calls.fingerprints.push(recording)
      return 'fingerprint'
    }
  }
  const sandbox = {
    window,
    navigator: {
      mediaDevices: {
        getUserMedia: () => {
          calls.microphone++
          return options.microphone?.promise || Promise.resolve(stream)
        }
      }
    },
    AudioWorkletNode: class {
      connect() {}
      disconnect() {}
      port = { postMessage() {} }
    },
    Float32Array,
    AbortController,
    ref: (value: unknown) => ({ value }),
    locale: { value: options.locale || zhSongs.requestForm },
    callLocale: (key: keyof typeof zhSongs.requestForm, _fallback: string, ...args: unknown[]) => {
      const value = (options.locale || zhSongs.requestForm)[key]
      return typeof value === 'function' ? Reflect.apply(value, undefined, args) : value
    },
    localizeServerError: (err: Error, fallback: string) => err?.message || fallback,
    AUDIO_MATCH_DURATION: Number(script.match(/const AUDIO_MATCH_DURATION = (\d+)/)![1]),
    setTimeout: (callback: () => void) => {
      timers.set(++nextTimer, callback)
      return nextTimer
    },
    clearTimeout: (id: number) => timers.delete(id),
    console: { error() {} },
    $fetch: async (...args: [string, { body: { audioFP: string } }]) => {
      calls.requests.push(args)
      return options.response?.promise || { result: [{ song: { id: 1, name: '测试歌曲' } }] }
    }
  }
  const api = runInNewContext(
    `${state}\n${actions.replaceAll('import.meta.client', 'true')}\n({
    openAudioMatchModal, closeAudioMatchModal, startAudioMatchRecording, stopAudioMatchRecording,
    handleAudioMatchFingerprint, audioMatchPreparing, audioMatchRecording, audioMatchError, audioMatchStatus,
    audioMatchResults, audioMatchProcessing, loadAudioMatchScript, getRecordingId: () => audioMatchRecordingId, getContext: () => audioMatchContext, getRecorder: () => audioMatchRecorderNode
  })`,
    sandbox
  )
  return { api, calls, timers, stream, sandbox }
}

test('实时音频上下文使用设备默认采样率，支持拒绝 8kHz 的设备', async () => {
  const { api, calls } = createHarness({ rejectLowSampleRate: true })
  await api.openAudioMatchModal()
  assert.equal(calls.microphone, 1)
  assert.equal(api.audioMatchError.value, '')
  assert.equal(api.getContext().sampleRate, 48000)
})

test('先发起麦克风授权，再恢复音频上下文', async () => {
  const { api, calls } = createHarness({ requireMicrophoneFirst: true })
  const opening = api.openAudioMatchModal()
  assert.equal(calls.microphone, 1)
  await opening
  assert.equal(api.audioMatchError.value, '')
})

test('48kHz 录音转换为 8kHz 后生成指纹', async () => {
  const { api, calls } = createHarness()
  await api.openAudioMatchModal()
  await api.handleAudioMatchFingerprint(new Float32Array(48000 * 3))
  assert.equal(calls.inputRate, 48000)
  assert.deepEqual(calls.rendered, [{ channels: 1, length: 24000, rate: 8000 }])
  assert.equal(calls.fingerprints[0].length, 24000)
  assert.equal(calls.requests[0][1].body.audioFP, 'fingerprint')
})

test('关闭弹窗后才获准的麦克风流立即释放', async () => {
  const microphone = deferred<MicrophoneStream>()
  const { api, calls, stream } = createHarness({ microphone })
  const opening = api.openAudioMatchModal()
  await Promise.resolve()
  await Promise.resolve()
  await api.closeAudioMatchModal()
  microphone.resolve(stream)
  await opening
  assert.equal(calls.stopped, 1)
  assert.equal(api.getContext(), null)
  assert.equal(api.audioMatchStatus.value, '')
})

test('麦克风授权完成后清除超时计时器', async () => {
  const { api, timers } = createHarness()
  await api.openAudioMatchModal()
  assert.equal(timers.size, 0)
})

test('授权超时后显示提示，迟到的麦克风流立即释放', async () => {
  const microphone = deferred<MicrophoneStream>()
  const { api, calls, timers, stream } = createHarness({ microphone })
  const opening = api.openAudioMatchModal()
  timers.values().next().value!()
  await opening
  assert.equal(api.audioMatchError.value, zhSongs.requestForm.microphoneTimeout)
  microphone.resolve(stream)
  await Promise.resolve()
  assert.equal(calls.stopped, 1)
  assert.equal(api.getContext(), null)
  assert.equal(api.audioMatchPreparing.value, false)
})

for (const locale of [zhSongs.requestForm, enSongs.requestForm]) {
  for (const [name, key] of [
    ['NotAllowedError', 'microphonePermissionDenied'],
    ['NotFoundError', 'microphoneNotFound'],
    ['NotReadableError', 'microphoneBusy']
  ]) {
    test(`麦克风错误 ${name} 使用本地化提示：${locale.startAudioMatch}`, async () => {
      const microphone = deferred<MicrophoneStream>()
      const { api, timers } = createHarness({ microphone, locale })
      const opening = api.openAudioMatchModal()
      microphone.reject(Object.assign(new Error('浏览器原始错误'), { name }))
      await opening
      assert.equal(api.audioMatchError.value, locale[key as keyof typeof locale])
      assert.equal(timers.size, 0)
    })
  }
}

test('重复点击打开按钮仅发起一次授权', async () => {
  const microphone = deferred<MicrophoneStream>()
  const { api, calls, stream } = createHarness({ microphone })
  const opening = api.openAudioMatchModal()
  await api.openAudioMatchModal()
  assert.equal(calls.microphone, 1)
  microphone.resolve(stream)
  await opening
})

test('录音模块加载期间关闭弹窗不会恢复已关闭的会话', async () => {
  const module = deferred()
  const { api, calls } = createHarness({ module })
  const opening = api.openAudioMatchModal()
  await new Promise(setImmediate)
  await api.closeAudioMatchModal()
  module.resolve()
  await opening
  assert.equal(api.getRecorder(), null)
  assert.equal(api.audioMatchStatus.value, '')
  assert.equal(calls.stopped, 1)
})

test('重新打开后旧授权不会覆盖新会话', async () => {
  const microphone = deferred<MicrophoneStream>()
  const { api, calls, stream, sandbox } = createHarness({ microphone })
  const first = api.openAudioMatchModal()
  await api.closeAudioMatchModal()
  sandbox.navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream)
  await api.openAudioMatchModal()
  const context = api.getContext()
  microphone.resolve(stream)
  await first
  assert.equal(calls.stopped, 1)
  assert.equal(api.getContext(), context)
  assert.equal(context.state, 'running')
  assert.equal(api.audioMatchStatus.value, zhSongs.requestForm.microphoneReady)
})

test('旧上下文异步关闭不会清空新上下文', async () => {
  const closing = deferred()
  const { api } = createHarness()
  await api.openAudioMatchModal()
  api.getContext().close = () => closing.promise
  const close = api.closeAudioMatchModal()
  await api.openAudioMatchModal()
  const context = api.getContext()
  closing.resolve()
  await close
  assert.equal(api.getContext(), context)
})

test('失败会话清理完成后不向重新打开的弹窗写入旧错误', async () => {
  const microphone = deferred<MicrophoneStream>()
  const closing = deferred()
  const { api, stream, sandbox } = createHarness({ microphone })
  const first = api.openAudioMatchModal()
  api.getContext().close = () => closing.promise
  microphone.reject(Object.assign(new Error('旧授权失败'), { name: 'NotAllowedError' }))
  await new Promise(setImmediate)
  await api.closeAudioMatchModal()
  sandbox.navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream)
  await api.openAudioMatchModal()
  closing.resolve()
  await first
  assert.equal(api.audioMatchError.value, '')
  assert.equal(api.audioMatchStatus.value, zhSongs.requestForm.microphoneReady)
})

test('录音模块加载失败时降级到兼容录音器', async () => {
  const module = deferred()
  const { api, calls } = createHarness({ module })
  const opening = api.openAudioMatchModal()
  module.reject(new Error('录音模块加载失败'))
  await opening
  assert.equal(calls.stopped, 0)
  assert.equal(typeof api.getRecorder().onaudioprocess, 'function')
  await api.startAudioMatchRecording()
  assert.equal(api.audioMatchRecording.value, true)
})

for (const sampleRate of [8000, 44100]) {
  test(`${sampleRate}Hz 录音保持三秒指纹输入长度`, async () => {
    const { api, calls } = createHarness({ sampleRate })
    await api.openAudioMatchModal()
    await api.handleAudioMatchFingerprint(new Float32Array(sampleRate * 3))
    assert.equal(calls.fingerprints[0].length, 24000)
    assert.equal(calls.rendered.length, sampleRate === 8000 ? 0 : 1)
  })
}

test('兼容录音器按设备采样率录满三秒并保留末块数据', async () => {
  const { api, calls } = createHarness({ fallback: true })
  await api.openAudioMatchModal()
  await api.startAudioMatchRecording()
  const input = new Float32Array(4096).fill(1)
  for (let count = 0; count < Math.ceil(144000 / input.length); count++) {
    api.getRecorder().onaudioprocess({ inputBuffer: { getChannelData: () => input } })
  }
  await new Promise(setImmediate)
  assert.equal(api.audioMatchRecording.value, false)
  assert.equal(calls.inputSamples.length, 144000)
  assert.equal(calls.inputSamples.at(-1), 1)
  assert.equal(calls.fingerprints[0].length, 24000)
})

test('停止兼容录音器后不再继续采集和识别', async () => {
  const { api, calls } = createHarness({ fallback: true })
  await api.openAudioMatchModal()
  await api.startAudioMatchRecording()
  api.stopAudioMatchRecording()
  const input = new Float32Array(4096)
  for (let count = 0; count < 40; count++) {
    api.getRecorder().onaudioprocess({ inputBuffer: { getChannelData: () => input } })
  }
  assert.equal(api.audioMatchRecording.value, false)
  assert.equal(calls.fingerprints.length, 0)
})

test('关闭弹窗后忽略迟到的识别响应', async () => {
  const response = deferred<unknown>()
  const { api, calls } = createHarness({ response })
  await api.openAudioMatchModal()
  const recognizing = api.handleAudioMatchFingerprint(new Float32Array(144000))
  await new Promise(setImmediate)
  assert.equal(calls.requests.length, 1)
  await api.closeAudioMatchModal()
  response.resolve({ result: [{ song: { id: 1, name: '过期结果' } }] })
  await recognizing
  assert.equal(api.audioMatchResults.value.length, 0)
  assert.equal(api.audioMatchStatus.value, '')
})

type WorkletRecorder = {
  port: { onmessage: (event: { data: { message: string; duration?: number } }) => void }
  process: (inputs: Float32Array[][]) => boolean
  recording: boolean
}
type WorkletMessage = { message: string; recording?: Float32Array }

const createWorklet = (sampleRate: number) => {
  let Processor!: new () => WorkletRecorder
  const messages: WorkletMessage[] = []
  runInNewContext(
    readFileSync(new URL('../../public/audio-match/rec.js', import.meta.url), 'utf8'),
    {
      sampleRate,
      Float32Array,
      AudioWorkletProcessor: class {
        port = { onmessage: null, postMessage: (message: WorkletMessage) => messages.push(message) }
      },
      registerProcessor: (_name: string, processor: new () => WorkletRecorder) => {
        Processor = processor
      }
    }
  )
  const recorder = new Processor()
  recorder.port.onmessage({ data: { message: 'start', duration: 3 } })
  return { recorder, messages }
}

test('AudioWorklet 使用实际采样率，恰好录满时返回完整数据', () => {
  const { recorder, messages } = createWorklet(48000)
  assert.doesNotThrow(() => recorder.process([[]]))
  const input = new Float32Array(128).fill(1)
  for (let count = 0; count < 1125; count++) recorder.process([[input]])
  const finished = messages.filter((message) => message.message === 'finished')
  assert.equal(finished.length, 1)
  assert.equal(finished[0].recording!.length, 144000)
  assert.equal(finished[0].recording!.at(-1), 1)
  assert.equal(recorder.recording, false)
})

test('AudioWorklet 保留不足整块的末尾采样并响应停止指令', () => {
  const { recorder, messages } = createWorklet(44100)
  const input = new Float32Array(128).fill(1)
  for (let count = 0; count < Math.ceil(132300 / 128); count++) recorder.process([[input]])
  assert.equal(messages.at(-1)!.recording!.length, 132300)
  assert.equal(messages.at(-1)!.recording!.at(-1), 1)
  recorder.port.onmessage({ data: { message: 'start', duration: 3 } })
  recorder.port.onmessage({ data: { message: 'stop' } })
  assert.equal(recorder.recording, false)
})

test('修改后的 Vue 脚本和模板均可编译，中英文词典键一致', () => {
  assert.doesNotThrow(() => compileScript(descriptor, { id: filename }))
  assert.deepEqual(
    compileTemplate({ source: descriptor.template!.content, filename, id: filename }).errors,
    []
  )
  assert.deepEqual(Object.keys(zhSongs.requestForm).sort(), Object.keys(enSongs.requestForm).sort())
})

test('停止后重录忽略上一轮排队的 Worklet 消息', async () => {
  const { api, calls } = createHarness()
  await api.openAudioMatchModal()
  await api.startAudioMatchRecording()
  const oldId = api.getRecordingId()
  api.stopAudioMatchRecording()
  await api.startAudioMatchRecording()
  await api.getRecorder().port.onmessage({ data: { message: 'finished', recordingId: oldId, recording: new Float32Array(144000) } })
  assert.equal(calls.requests.length, 0)
  assert.equal(api.audioMatchRecording.value, true)
  await api.getRecorder().port.onmessage({ data: { message: 'finished', recordingId: api.getRecordingId(), recording: new Float32Array(144000) } })
  assert.equal(calls.requests.length, 1)
})

test('旧 resume 拒绝不污染重新打开的会话', async () => {
  const { api } = createHarness()
  await api.openAudioMatchModal()
  const pending = deferred()
  const context = api.getContext()
  context.state = 'suspended'
  context.resume = () => pending.promise
  const starting = api.startAudioMatchRecording()
  await api.closeAudioMatchModal()
  await api.openAudioMatchModal()
  pending.reject(new Error('旧上下文错误'))
  await starting
  assert.equal(api.audioMatchError.value, '')
  assert.equal(api.audioMatchStatus.value, zhSongs.requestForm.microphoneReady)
})

test('resume 等待期间重复点击只开始一轮录音', async () => {
  const { api } = createHarness()
  await api.openAudioMatchModal()
  const pending = deferred()
  const context = api.getContext()
  let resumes = 0
  context.state = 'suspended'
  context.resume = () => { resumes++; return pending.promise }
  const starting = api.startAudioMatchRecording()
  await api.startAudioMatchRecording()
  assert.equal(resumes, 1)
  pending.resolve()
  await starting
  assert.equal(api.audioMatchRecording.value, true)
})

test('无采样输入时退出录音并显示错误', async () => {
  const { api, timers } = createHarness()
  await api.openAudioMatchModal()
  await api.startAudioMatchRecording()
  timers.values().next().value!()
  assert.equal(api.audioMatchRecording.value, false)
  assert.equal(api.audioMatchStatus.value, '')
  assert.equal(api.audioMatchError.value, zhSongs.requestForm.microphoneBusy)
})

test('关闭弹窗取消在途识别请求', async () => {
  const response = deferred<unknown>()
  const { api, calls } = createHarness({ response })
  await api.openAudioMatchModal()
  const matching = api.handleAudioMatchFingerprint(new Float32Array(144000))
  await new Promise(setImmediate)
  const options = calls.requests[0][1] as { signal?: AbortSignal; timeout?: number; retry?: number }
  assert.equal(options.timeout, 20000)
  assert.equal(options.retry, 0)
  await api.closeAudioMatchModal()
  assert.equal(options.signal?.aborted, true)
  response.resolve({ result: [] })
  await matching
})

test('脚本并发等待同一次加载，失败后重新插入脚本', async () => {
  const { api, sandbox } = createHarness()
  const scripts: { dataset: Record<string, string>; remove(): void; onerror?: () => void; onload?: () => void }[] = []
  Object.assign(sandbox, { document: {
    querySelector: () => scripts[0],
    createElement: () => ({ dataset: {}, remove() { scripts.splice(scripts.indexOf(this), 1) } }),
    head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) }
  } })
  const first = api.loadAudioMatchScript('/test.js')
  const second = api.loadAudioMatchScript('/test.js')
  assert.equal(first, second)
  scripts[0].onerror!()
  await assert.rejects(first)
  assert.equal(scripts.length, 0)
  const retry = api.loadAudioMatchScript('/test.js')
  scripts[0].onload!()
  await retry
  assert.equal(scripts.length, 1)
})

test('真实 WASM 可初始化并连续生成指纹', async () => {
  const runtime = readFileSync(new URL('../../public/audio-match/afp.js', import.meta.url), 'utf8')
  const binary = readFileSync(new URL('../../public/audio-match/afp.wasm.js', import.meta.url), 'utf8')
  const result = await runInNewContext(`${binary}\n${runtime}\n(async () => {
    const pcm = new Float32Array(24000)
    for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin(i * 0.3)
    return [await GenerateFP(pcm), await GenerateFP(pcm)]
  })()`, { setTimeout, clearTimeout, console: { info() {}, log() {}, warn() {}, error() {} }, atob, btoa })
  assert.equal(typeof result[0], 'string')
  assert.ok(result[0].length > 0)
  assert.equal(result[0], result[1])
})

test('WASM 初始化失败后清空缓存并允许重试', async () => {
  const runtime = readFileSync(new URL('../../public/audio-match/afp.js', import.meta.url), 'utf8')
  const binary = readFileSync(new URL('../../public/audio-match/afp.wasm.js', import.meta.url), 'utf8')
  let attempts = 0
  const wasm = Object.create(WebAssembly)
  wasm.instantiate = (...args: Parameters<typeof WebAssembly.instantiate>) => {
    if (++attempts === 1) return Promise.reject(new Error('模拟 WASM 加载失败'))
    return Reflect.apply(WebAssembly.instantiate, WebAssembly, args)
  }
  const result = await runInNewContext(`${binary}\n${runtime}\n(async () => {
    let failed = false
    try { await GenerateFP(new Float32Array(24000)) } catch { failed = true }
    return [failed, typeof await GenerateFP(new Float32Array(24000))]
  })()`, { WebAssembly: wasm, setTimeout, clearTimeout, console: { info() {}, log() {}, warn() {}, error() {} }, atob, btoa })
  assert.equal(result[0], true)
  assert.equal(result[1], 'string')
  assert.equal(attempts, 2)
})

test('WASM 实例缺少所需导出时拒绝初始化并允许重试', async () => {
  const runtime = readFileSync(new URL('../../public/audio-match/afp.js', import.meta.url), 'utf8')
  const binary = readFileSync(new URL('../../public/audio-match/afp.wasm.js', import.meta.url), 'utf8')
  let attempts = 0
  const wasm = Object.create(WebAssembly)
  wasm.instantiate = (...args: Parameters<typeof WebAssembly.instantiate>) => {
    if (++attempts === 1) return Promise.resolve({ instance: { exports: {} } })
    return Reflect.apply(WebAssembly.instantiate, WebAssembly, args)
  }
  const result = await runInNewContext(`${binary}\n${runtime}\n(async () => {
    let failed = false
    try { await GenerateFP(new Float32Array(24000)) } catch { failed = true }
    return [failed, typeof await GenerateFP(new Float32Array(24000))]
  })()`, { WebAssembly: wasm, setTimeout, clearTimeout, console: { info() {}, log() {}, warn() {}, error() {} }, atob, btoa })
  assert.equal(result[0], true)
  assert.equal(result[1], 'string')
  assert.equal(attempts, 2)
})

test('识别请求超时后退出处理并取消网络请求', async () => {
  const response = deferred<unknown>()
  const { api, calls, timers } = createHarness({ response })
  await api.openAudioMatchModal()
  const matching = api.handleAudioMatchFingerprint(new Float32Array(144000))
  await new Promise(setImmediate)
  timers.values().next().value!()
  await matching
  assert.equal(api.audioMatchProcessing.value, false)
  assert.equal(api.audioMatchError.value, zhSongs.requestForm.audioMatchFailed)
  assert.equal((calls.requests[0][1] as { signal?: AbortSignal }).signal?.aborted, true)
})

test('麦克风断开时释放会话并可重新授权', async () => {
  const { api, sandbox } = createHarness()
  let ended!: () => void
  sandbox.navigator.mediaDevices.getUserMedia = () => Promise.resolve({ getTracks: () => [{ stop() {}, addEventListener: (_event: string, callback: () => void) => { ended = callback } }] })
  await api.openAudioMatchModal()
  await api.startAudioMatchRecording()
  ended()
  assert.equal(api.audioMatchRecording.value, false)
  assert.equal(api.getContext(), null)
  assert.equal(api.audioMatchError.value, zhSongs.requestForm.microphoneNotFound)
  await api.startAudioMatchRecording()
  assert.equal(api.audioMatchRecording.value, true)
})

test('关闭重开后旧的初始化重试不会自动启动新会话录音', async () => {
  const failedMicrophone = deferred<MicrophoneStream>()
  const { api, sandbox, stream } = createHarness({ microphone: failedMicrophone })
  const opening = api.openAudioMatchModal()
  failedMicrophone.reject(Object.assign(new Error('权限拒绝'), { name: 'NotAllowedError' }))
  await opening
  const microphone = deferred<MicrophoneStream>()
  sandbox.navigator.mediaDevices.getUserMedia = () => microphone.promise
  const retry = api.startAudioMatchRecording()
  await api.closeAudioMatchModal()
  sandbox.navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream)
  await api.openAudioMatchModal()
  const context = api.getContext()
  microphone.resolve(stream)
  await retry
  assert.equal(api.getContext(), context)
  assert.equal(api.audioMatchRecording.value, false)
  assert.equal(api.audioMatchStatus.value, zhSongs.requestForm.microphoneReady)
})

test('恢复播放被拒绝时不误报为麦克风权限拒绝', async () => {
  const { api } = createHarness()
  await api.openAudioMatchModal()
  const context = api.getContext()
  context.state = 'suspended'
  context.resume = () => Promise.reject(Object.assign(new Error('播放被阻止'), { name: 'NotAllowedError' }))
  await api.startAudioMatchRecording()
  assert.equal(api.audioMatchError.value, zhSongs.requestForm.audioMatchInitFailed)
  assert.equal(api.audioMatchPreparing.value, false)
})

test('首次初始化恢复播放失败时不误报麦克风权限', async () => {
  const { api, sandbox, calls } = createHarness()
  sandbox.window.AudioContext.prototype.resume = () => Promise.reject(
    Object.assign(new Error('播放被阻止'), { name: 'NotAllowedError' })
  )
  await api.openAudioMatchModal()
  assert.equal(api.audioMatchError.value, zhSongs.requestForm.audioMatchInitFailed)
  assert.equal(api.audioMatchPreparing.value, false)
  assert.equal(calls.stopped, 1)
})
