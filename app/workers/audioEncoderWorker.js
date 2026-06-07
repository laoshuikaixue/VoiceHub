import { createMp3Encoder } from 'wasm-media-encoders'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const normalizeStereo = (left, right, targetDb) => {
  const targetGain = Math.pow(10, targetDb / 20)
  let maxPeak = 0
  for (let i = 0; i < left.length; i++) {
    const l = Math.abs(left[i])
    const r = Math.abs(right[i])
    if (l > maxPeak) maxPeak = l
    if (r > maxPeak) maxPeak = r
  }
  if (maxPeak === 0) return
  const gain = targetGain / maxPeak
  for (let i = 0; i < left.length; i++) {
    left[i] *= gain
    right[i] *= gain
  }
}

const resampleLinear = (source, sourceRate, targetRate) => {
  if (sourceRate === targetRate) return source
  const ratio = targetRate / sourceRate
  const targetLength = Math.max(1, Math.floor(source.length * ratio))
  const output = new Float32Array(targetLength)
  for (let i = 0; i < targetLength; i++) {
    const origin = i / ratio
    const left = Math.floor(origin)
    const right = Math.min(source.length - 1, left + 1)
    const weight = origin - left
    output[i] = source[left] * (1 - weight) + source[right] * weight
  }
  return output
}

const interleave = (left, right) => {
  const result = new Float32Array(left.length + right.length)
  let index = 0
  for (let i = 0; i < left.length; i++) {
    result[index++] = left[i]
    result[index++] = right[i]
  }
  return result
}

const writeString = (view, offset, text) => {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

const floatTo16BitPCM = (view, offset, input) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = clamp(input[i], -1, 1)
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}

const writeWavHeader = (sampleRate, totalSamples) => {
  const numChannels = 2
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataSize = totalSamples * numChannels * bytesPerSample
  const buffer = new ArrayBuffer(44)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  return view
}

const encodeWavChunk = (left, right) => {
  const bytesPerSample = 2
  const numChannels = 2
  const buffer = new ArrayBuffer(left.length * numChannels * bytesPerSample)
  const view = new DataView(buffer)
  let offset = 0
  for (let i = 0; i < left.length; i++) {
    const l = clamp(left[i], -1, 1)
    const r = clamp(right[i], -1, 1)
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true)
    offset += 2
    view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true)
    offset += 2
  }
  return new Uint8Array(buffer)
}

const encodeWavBlob = (left, right, sampleRate) => {
  const interleaved = interleave(left, right)
  const bytesPerSample = 2
  const header = writeWavHeader(sampleRate, left.length)
  const buffer = new ArrayBuffer(44 + interleaved.length * bytesPerSample)
  const view = new DataView(buffer)
  new Uint8Array(buffer).set(new Uint8Array(header.buffer), 0)
  floatTo16BitPCM(view, 44, interleaved)
  return new Blob([view], { type: 'audio/wav' })
}

const encodeMp3Blob = async (left, right, sampleRate) => {
  const encoder = await createMp3Encoder()
  encoder.configure({
    sampleRate,
    channels: 2,
    bitrate: 192,
    outputSampleRate: sampleRate
  })
  const chunkSize = sampleRate * 2
  let processed = 0
  const total = left.length
  const chunks = []
  while (processed < total) {
    const end = Math.min(processed + chunkSize, total)
    const leftChunk = left.subarray(processed, end)
    const rightChunk = right.subarray(processed, end)
    const chunk = encoder.encode([leftChunk, rightChunk])
    if (chunk.length > 0) {
      const copy = new Uint8Array(chunk.length)
      copy.set(chunk)
      chunks.push(copy)
    }
    processed = end
    postMessage({
      type: 'progress',
      stage: 'encode',
      value: Math.round((processed / total) * 100)
    })
  }
  const finalized = encoder.finalize()
  if (finalized.length > 0) {
    const copy = new Uint8Array(finalized.length)
    copy.set(finalized)
    chunks.push(copy)
  }
  return new Blob(chunks, { type: 'audio/mp3' })
}

let streamState = null

const resetStreamState = () => {
  streamState = null
}

const ensureMp3StreamEncoder = async () => {
  if (!streamState.encoder) {
    const encoder = await createMp3Encoder()
    encoder.configure({
      sampleRate: streamState.sampleRate,
      channels: 2,
      bitrate: 192,
      outputSampleRate: streamState.sampleRate
    })
    streamState.encoder = encoder
  }
  return streamState.encoder
}

const appendEncodedChunk = (chunk) => {
  if (chunk.length === 0) return
  const copy = new Uint8Array(chunk.length)
  copy.set(chunk)
  streamState.chunks.push(copy)
}

const encodeStreamTrack = async (track, requestId) => {
  let left = new Float32Array(track.left)
  let right = new Float32Array(track.right)
  if (streamState.normalize) {
    normalizeStereo(left, right, streamState.targetDb)
  }
  if (track.sampleRate !== streamState.sampleRate) {
    left = resampleLinear(left, track.sampleRate, streamState.sampleRate)
    right = resampleLinear(right, track.sampleRate, streamState.sampleRate)
  }

  const chunkSize = streamState.sampleRate * 2
  let processed = 0
  while (processed < left.length) {
    const end = Math.min(processed + chunkSize, left.length)
    const leftChunk = left.subarray(processed, end)
    const rightChunk = right.subarray(processed, end)
    if (streamState.format === 'wav') {
      streamState.chunks.push(encodeWavChunk(leftChunk, rightChunk))
    } else {
      const encoder = await ensureMp3StreamEncoder()
      appendEncodedChunk(encoder.encode([leftChunk, rightChunk]))
    }
    processed = end
    postMessage({
      type: 'progress',
      stage: 'encode',
      value: Math.round((processed / left.length) * 100),
      requestId
    })
  }

  streamState.totalSamples += left.length
  postMessage({
    type: 'trackDone',
    requestId
  })
}

const finishStream = async (requestId) => {
  let blob
  if (streamState.format === 'wav') {
    blob = new Blob([writeWavHeader(streamState.sampleRate, streamState.totalSamples), ...streamState.chunks], {
      type: 'audio/wav'
    })
  } else {
    const encoder = await ensureMp3StreamEncoder()
    appendEncodedChunk(encoder.finalize())
    blob = new Blob(streamState.chunks, { type: 'audio/mp3' })
  }

  const sampleRate = streamState.sampleRate
  resetStreamState()
  postMessage({
    type: 'done',
    blob,
    sampleRate,
    requestId
  })
}

self.onmessage = async (event) => {
  const payload = event.data
  if (payload?.cmd === 'startStream') {
    resetStreamState()
    streamState = {
      format: payload.format === 'wav' ? 'wav' : 'mp3',
      normalize: Boolean(payload.normalize),
      targetDb: payload.targetDb,
      sampleRate: Math.min(payload.sampleRate || 44100, payload.format === 'mp3' ? 48000 : 96000),
      chunks: [],
      totalSamples: 0,
      encoder: null
    }
    postMessage({
      type: 'ready',
      requestId: payload.requestId
    })
    return
  }

  if (payload?.cmd === 'appendTrack') {
    try {
      if (!streamState) throw new Error('编码任务未初始化')
      await encodeStreamTrack(payload.track, payload.requestId)
    } catch (error) {
      postMessage({
        type: 'error',
        message: error?.message || '编码失败',
        requestId: payload.requestId
      })
    }
    return
  }

  if (payload?.cmd === 'finishStream') {
    try {
      if (!streamState) throw new Error('编码任务未初始化')
      await finishStream(payload.requestId)
    } catch (error) {
      postMessage({
        type: 'error',
        message: error?.message || '编码失败',
        requestId: payload.requestId
      })
    }
    return
  }

  if (payload?.cmd === 'cancelStream') {
    resetStreamState()
    return
  }

  if (payload?.cmd !== 'encode' || !payload.tracks?.length) return
  try {
    let baseSampleRate = Math.max(...payload.tracks.map((track) => track.sampleRate))
    if (payload.format === 'mp3' && baseSampleRate > 48000) {
      baseSampleRate = 48000
    }
    const normalizedTracks = payload.tracks.map((track, index) => {
      let left = new Float32Array(track.left)
      let right = new Float32Array(track.right)
      if (payload.normalize) {
        normalizeStereo(left, right, payload.targetDb)
      }
      if (track.sampleRate !== baseSampleRate) {
        left = resampleLinear(left, track.sampleRate, baseSampleRate)
        right = resampleLinear(right, track.sampleRate, baseSampleRate)
      }
      postMessage({
        type: 'progress',
        stage: 'prepare',
        value: Math.round(((index + 1) / payload.tracks.length) * 100)
      })
      return {
        left,
        right
      }
    })
    const totalLength = normalizedTracks.reduce((sum, item) => sum + item.left.length, 0)
    const mergedLeft = new Float32Array(totalLength)
    const mergedRight = new Float32Array(totalLength)
    let offset = 0
    for (let i = 0; i < normalizedTracks.length; i++) {
      const item = normalizedTracks[i]
      mergedLeft.set(item.left, offset)
      mergedRight.set(item.right, offset)
      offset += item.left.length
      postMessage({
        type: 'progress',
        stage: 'merge',
        value: Math.round(((i + 1) / normalizedTracks.length) * 100)
      })
    }
    let blob
    if (payload.format === 'wav') {
      postMessage({
        type: 'progress',
        stage: 'encode',
        value: 20
      })
      blob = encodeWavBlob(mergedLeft, mergedRight, baseSampleRate)
      postMessage({
        type: 'progress',
        stage: 'encode',
        value: 100
      })
    } else {
      blob = await encodeMp3Blob(mergedLeft, mergedRight, baseSampleRate)
    }
    postMessage({
      type: 'done',
      blob,
      sampleRate: baseSampleRate
    })
  } catch (error) {
    postMessage({
      type: 'error',
      message: error?.message || '编码失败'
    })
  }
}
