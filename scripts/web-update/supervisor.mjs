import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { appVersion, inspectPackage, isNewerVersion, runtimeFingerprint, unpackPackage } from './package.mjs'
import { backupDatabase } from './backup.mjs'
import { commandFile, publishJson, readJson, stateFile } from './state.mjs'

const appRoot = process.cwd()
const store = resolve(process.env.VOICEHUB_UPDATE_DIR || '/var/lib/voicehub-updates')
const publicKeyFile = process.env.VOICEHUB_UPDATE_PUBLIC_KEY
const base = { id: null, version: await appVersion(appRoot) }
const port = process.env.NITRO_PORT || process.env.PORT || '3000'
const runtime = publicKeyFile ? await runtimeFingerprint(appRoot) : null
const publicKey = publicKeyFile ? await readFile(publicKeyFile) : null
const probe = randomBytes(32).toString('hex')
const slotPattern = /^[a-f0-9]{64}$/
let stopping = false
let child

function start(slot) {
  if (slot.id !== null && !slotPattern.test(slot.id)) throw new Error('Invalid update slot')
  const root = slot.id === null ? appRoot : join(store, 'slots', slot.id)
  child = spawn(process.execPath, [join(root, '.output/server/index.mjs')], {
    cwd: appRoot,
    env: { ...process.env, VOICEHUB_UPDATE_DIR: store, VOICEHUB_UPDATE_RUNTIME: runtime ?? '', VOICEHUB_UPDATE_PROBE: probe },
    stdio: 'inherit'
  })
  child.on('error', error => console.error('[VoiceHub Update]', error))
}

function exited() {
  return !child.pid || child.exitCode !== null || child.signalCode !== null
}

async function stop() {
  if (exited()) return
  child.kill('SIGTERM')
  for (let attempt = 0; attempt < 40 && !exited(); attempt++) await delay(100)
  if (!exited()) child.kill('SIGKILL')
  while (!exited()) await delay(100)
}

async function healthy(slot) {
  for (let attempt = 0; attempt < 45 && !stopping && !exited(); attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/system/update-health`, {
        headers: { 'x-voicehub-update-probe': probe },
        signal: AbortSignal.timeout(1500)
      })
      if (response.ok && (await response.json()).version === slot.version) return true
    } catch {
      // 应用启动期间端口可能尚未开放。
    }
    await delay(1000)
  }
  return false
}

async function clearCommand(command) {
  if (command?.upload && /^[a-zA-Z0-9-]+$/.test(command.upload)) {
    await rm(join(store, 'uploads', command.upload), { force: true })
  }
  await rm(commandFile(store), { force: true })
}

for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true })
if (!publicKey) {
  start(base)
  while (!stopping && !exited()) await delay(300)
  if (stopping) await stop()
  process.exitCode = stopping ? 0 : 1
} else {
  await mkdir(join(store, 'uploads'), { recursive: true })
  const initial = { baseVersion: base.version, runtime, current: base, previous: null, status: 'idle' }
  let state = await readJson(stateFile(store), initial)
  const accept = async changes => {
    const next = { ...state, ...changes }
    await publishJson(stateFile(store), next)
    state = next
  }
  if (state.status === 'applying') {
    await accept({ status: 'failed', failure: 'switch' })
    await clearCommand(await readJson(commandFile(store)))
  } else {
    // 已处理但未及时删除的请求可能来自上次容器中断。
    const pending = await readJson(commandFile(store))
    if (pending && pending.id === state.lastId) await clearCommand(pending)
  }
  if (state.baseVersion !== base.version || state.runtime !== runtime) {
    await clearCommand(await readJson(commandFile(store)))
    await accept({ ...initial, lastId: null })
  }
  start(state.current)
  while (!stopping) {
    await delay(800)
    if (stopping) break
    if (exited()) throw new Error('VoiceHub application exited')
    const command = await readJson(commandFile(store))
    if (!command) continue
    const original = state.current
    let switched = false
    let failure = 'switch'
    try {
      await accept({ status: 'applying', failure: null, lastId: command.id })
      let candidate = state.previous
      if (command.action === 'install') {
        if (!/^[a-zA-Z0-9-]+$/.test(command.upload)) throw new Error('Invalid upload name')
        const path = join(store, 'uploads', command.upload)
        const manifest = await inspectPackage(path, publicKey, runtime)
        if (!isNewerVersion(manifest.version, original.version)) throw new Error('The package must upgrade the running version')
        candidate = { id: await unpackPackage(path, manifest, store, appRoot), version: manifest.version }
      }
      if (!candidate || (candidate.id === null && candidate.version !== base.version)) throw new Error('No compatible previous version')
      failure = 'backup'
      const backup = await backupDatabase(store, process.env.DATABASE_URL)
      await accept({ backup })
      failure = 'switch'
      if (stopping) break
      await stop()
      switched = true
      if (stopping) break
      start(candidate)
      if (!await healthy(candidate)) throw new Error('The candidate failed its health check')
      await accept({ current: candidate, previous: original, status: 'succeeded' })
    } catch (error) {
      if (failure === 'backup') console.error('[VoiceHub Update] PostgreSQL backup failed; the application was kept running')
      else console.error('[VoiceHub Update]', error)
      if (switched) {
        await stop()
        if (!stopping) start(original)
      }
      await accept({ status: 'failed', failure })
    } finally {
      await clearCommand(command)
    }
  }
  if (stopping) await stop()
}
