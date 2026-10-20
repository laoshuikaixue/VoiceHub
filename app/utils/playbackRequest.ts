export const playbackAbortError = () => new DOMException('播放请求已取消', 'AbortError')

/** 可暂停的解析截止时间；等待用户选择不消耗网络预算。 */
export function createPlaybackRequest(timeout = 30000) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let remaining = timeout
  let started = 0
  const pause = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
    remaining = Math.max(0, remaining - (performance.now() - started))
  }
  const resume = () => {
    if (timer || controller.signal.aborted) return
    started = performance.now()
    timer = setTimeout(() => controller.abort(new DOMException('播放解析超时', 'TimeoutError')), remaining)
  }
  const dispose = () => { if (timer) clearTimeout(timer); timer = undefined }
  const cancel = () => { dispose(); controller.abort(playbackAbortError()) }
  resume()
  return { signal: controller.signal, pause, resume, dispose, cancel }
}

export function withPlaybackSignal<T>(task: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return task
  if (signal.aborted) return Promise.reject(signal.reason || playbackAbortError())
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || playbackAbortError())
    signal.addEventListener('abort', abort, { once: true })
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
