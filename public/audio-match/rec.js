/* AudioWorklet 处理器必须通过独立模块加载。 */
class TimedRecorder extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.max_length = 0
    this.recbuffer = new Float32Array()
    this.recording = false
    this.buf_index = 0
    this.port.onmessage = (event) => {
      switch (event.data.message) {
        case 'start':
          this.recordingId = event.data.recordingId
          this.max_length = Math.round(event.data.duration * sampleRate)
          this.recbuffer = new Float32Array(this.max_length)
          this.buf_index = 0
          this.recording = true
          break
        case 'stop':
          this.recording = false
          this.buf_index = 0
          break
      }
    }
  }
  process(inputs) {
    const channelL = inputs[0]?.[0]
    if (this.recording && channelL?.length) {
      const remaining = this.max_length - this.buf_index
      const length = Math.min(channelL.length, remaining)
      this.recbuffer.set(channelL.subarray(0, length), this.buf_index)
      this.buf_index += length
      this.port.postMessage({
        message: 'bufferhealth',
        recordingId: this.recordingId,
        health: this.buf_index / this.max_length
      })
      if (this.buf_index >= this.max_length) {
        this.recording = false
        this.buf_index = 0
        this.port.postMessage({
          message: 'finished',
          recordingId: this.recordingId,
          recording: this.recbuffer
        })
      }
    }
    return true
  }
}

registerProcessor('timed-recorder', TimedRecorder)
