import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, open, readFile, readdir, rename, rm, symlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const magic = Buffer.from('VOICEHUB-VTCSY-UPDATE-1\n')
const digestPattern = /^[a-f0-9]{64}$/
const versionPattern = /^\d+\.\d+\.\d+\.\d+(?:-[a-z]+)?$/
const headerLimit = 8192
export const updateLimit = 512 * 1024 * 1024

export class UpdatePackageError extends Error {}

export function isNewerVersion(target, current) {
  if (!versionPattern.test(target) || !versionPattern.test(current)) return false
  const [targetBase, targetRevision = ''] = target.split('-')
  const [currentBase, currentRevision = ''] = current.split('-')
  const parts = currentBase.split('.')
  for (const [index, digit] of targetBase.split('.').entries()) {
    const difference = BigInt(digit) - BigInt(parts[index])
    if (difference !== 0n) return difference > 0n
  }
  if (targetRevision.length !== currentRevision.length) return targetRevision.length > currentRevision.length
  return targetRevision > currentRevision
}

export async function appVersion(root) {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const version = pkg.vtcsyRevision ? `${pkg.version}-${pkg.vtcsyRevision}` : pkg.version
  if (!versionPattern.test(version)) throw new Error('Invalid VTCSY version')
  return version
}

async function hashFiles(hash, root, relative) {
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const path = `${relative}/${entry.name}`
    if (entry.isDirectory()) await hashFiles(hash, root, path)
    else if (entry.isFile()) hash.update(path).update('\0').update(await readFile(join(root, path))).update('\0')
    else throw new Error('Unexpected runtime compatibility entry')
  }
}

export async function runtimeFingerprint(root) {
  const hash = createHash('sha256')
  hash.update(`voicehub-v1:${process.platform}:${process.arch}:${process.versions.node.split('.')[0]}\0`)
  hash.update(await readFile(join(root, 'pnpm-lock.yaml'))).update('\0')
  await hashFiles(hash, root, 'app/drizzle/migrations')
  return hash.digest('hex')
}

export async function fileHash(path, start = 0) {
  const hash = createHash('sha256')
  for await (const data of createReadStream(path, { start })) hash.update(data)
  return hash.digest('hex')
}

export async function createPackage(root, output, keyFile) {
  const tmp = await mkdtemp(join(tmpdir(), 'voicehub-pack-'))
  const archive = join(tmp, 'app.tar.gz')
  try {
    const key = createPrivateKey(await readFile(keyFile))
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('Only Ed25519 is supported')
    await readFile(join(root, '.output/server/index.mjs'), { flag: 'r' })
    await exec('tar', ['-czf', archive, '-C', root, '.output'])
    const manifest = Buffer.from(JSON.stringify({
      version: await appVersion(root),
      runtime: await runtimeFingerprint(root),
      sha256: await fileHash(archive)
    }))
    const header = Buffer.from(JSON.stringify({
      manifest: manifest.toString('base64'),
      signature: sign(null, manifest, key).toString('base64')
    }))
    const length = Buffer.alloc(4)
    length.writeUInt32BE(header.length)
    await pipeline(Readable.from((async function* () {
      yield magic
      yield length
      yield header
      yield* createReadStream(archive)
    })()), new Transform({
      transform(data, _encoding, callback) {
        this.bytes = (this.bytes ?? 0) + data.length
        callback(this.bytes > updateLimit ? new Error('Update package exceeds size limit') : null, data)
      }
    }), createWriteStream(resolve(output), { flags: 'wx', mode: 0o600 }))
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

export async function inspectPackage(path, publicKey, runtime) {
  const invalid = () => new UpdatePackageError('Invalid update package')
  const file = await open(path)
  let manifest
  let start
  try {
    const stat = await file.stat()
    const prefix = Buffer.alloc(magic.length + 4)
    if (stat.size > updateLimit || (await file.read(prefix)).bytesRead !== prefix.length || !prefix.subarray(0, magic.length).equals(magic)) throw invalid()
    const length = prefix.readUInt32BE(magic.length)
    start = prefix.length + length
    if (!length || length > headerLimit || start >= stat.size) throw invalid()
    const headerBytes = Buffer.alloc(length)
    if ((await file.read(headerBytes)).bytesRead !== length) throw invalid()
    try {
      const header = JSON.parse(headerBytes.toString())
      const signed = Buffer.from(header.manifest, 'base64')
      const key = createPublicKey(publicKey)
      if (key.asymmetricKeyType !== 'ed25519' || !verify(null, signed, key, Buffer.from(header.signature, 'base64'))) throw invalid()
      manifest = JSON.parse(signed.toString())
      if (!versionPattern.test(manifest.version) || !digestPattern.test(manifest.sha256) || !digestPattern.test(manifest.runtime)) throw invalid()
    } catch {
      throw invalid()
    }
  } finally {
    await file.close()
  }
  if (manifest.runtime !== runtime) throw new UpdatePackageError('Runtime or database schema is incompatible')
  if (await fileHash(path, start) !== manifest.sha256) throw invalid()
  return { ...manifest, start }
}

export async function unpackPackage(path, manifest, store, appRoot) {
  const destination = join(store, 'slots', manifest.sha256)
  await mkdir(dirname(destination), { recursive: true })
  const staging = await mkdtemp(join(dirname(destination), '.stage-'))
  try {
    const archive = join(staging, 'app.tar.gz')
    await pipeline(createReadStream(path, { start: manifest.start }), createWriteStream(archive, { flags: 'wx' }))
    if (await fileHash(archive) !== manifest.sha256) throw new UpdatePackageError('Package changed during staging')
    const output = join(staging, 'app')
    await mkdir(output)
    await exec('tar', ['-xozf', archive, '-C', output])
    const entry = await open(join(output, '.output/server/index.mjs'))
    await entry.close()
    await symlink(join(appRoot, 'node_modules'), join(output, 'node_modules'), 'dir')
    try {
      await rename(output, destination)
    } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error
    }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
  return manifest.sha256
}
