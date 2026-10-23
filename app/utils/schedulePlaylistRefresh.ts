export interface ScheduleRefreshOptions<T> {
  load: (signal: AbortSignal) => Promise<T>
  apply: (value: T) => void
  failed: (error: unknown, terminal: boolean) => void
}

// 所有刷新入口共用串行请求；取消后即使请求忽略 AbortSignal，也不会提交旧结果。
export function createSchedulePlaylistRefresh<T>(options: ScheduleRefreshOptions<T>) {
  let generation = 0
  let active = false
  let running = false
  let queued = false
  let controller: AbortController | null = null

  const refresh = async () => {
    if (!active) return
    if (running) {
      generation++
      queued = true
      controller?.abort()
      return
    }
    const version = generation
    const request = new AbortController()
    controller = request
    running = true
    queued = false
    try {
      const value = await options.load(request.signal)
      if (!active || version !== generation) return
      options.apply(value)
    } catch (error) {
      if (!active || version !== generation || request.signal.aborted) return
      const detail = error as { statusCode?: number; status?: number; response?: { status?: number } } | null
      const status = detail?.statusCode || detail?.status || detail?.response?.status
      const terminal = status === 401 || status === 403
      if (terminal) active = false
      options.failed(error, terminal)
    } finally {
      running = false
      if (controller === request) controller = null
      if (active && (queued || version !== generation)) void refresh()
    }
  }

  const stop = () => {
    generation++
    active = false
    queued = false
    controller?.abort()
  }

  const start = () => {
    stop()
    active = true
    void refresh()
  }

  return { start, stop, refresh }
}
