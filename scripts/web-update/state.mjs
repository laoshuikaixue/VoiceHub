import { randomUUID } from 'node:crypto'
import { access, link, readFile, rm, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'

export const commandFile = store => join(store, 'command.json')
export const stateFile = store => join(store, 'state.json')

export async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

export async function updatePending(store) {
  if (!store) return false
  try {
    await access(commandFile(store))
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

export async function publishJson(path, value, replace = true) {
  const temp = `${path}.${randomUUID()}.tmp`
  await writeFile(temp, JSON.stringify(value), { flag: 'wx', mode: 0o600 })
  try {
    await (replace ? rename(temp, path) : link(temp, path))
  } finally {
    await rm(temp, { force: true })
  }
}
