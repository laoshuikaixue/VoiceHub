import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { fileHash } from './package.mjs'

const exec = promisify(execFile)

function connectionEnvironment(databaseUrl) {
  const url = new URL(databaseUrl)
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2) {
    throw new Error('Invalid PostgreSQL connection')
  }
  const database = decodeURIComponent(url.pathname.slice(1))
  if (/[=\r\n]/.test(database)) throw new Error('Unsupported database name')
  const environment = {
    ...process.env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    PGCONNECT_TIMEOUT: '10',
    PGAPPNAME: 'voicehub-web-update'
  }
  for (const [name, variable] of Object.entries({
    sslmode: 'PGSSLMODE', sslrootcert: 'PGSSLROOTCERT', sslcert: 'PGSSLCERT', sslkey: 'PGSSLKEY',
    sslcrl: 'PGSSLCRL', target_session_attrs: 'PGTARGETSESSIONATTRS'
  })) {
    if (url.searchParams.has(name)) environment[variable] = url.searchParams.get(name)
  }
  return environment
}

export async function backupDatabase(store, databaseUrl) {
  const dir = join(store, 'backups')
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const staging = await mkdtemp(join(dir, '.incomplete-'))
  const suffix = staging.split('.incomplete-').at(-1)
  const name = `before-switch-${new Date().toISOString().replace(/[:.]/g, '-')}-${suffix}`
  const archive = join(staging, 'database.dump')
  try {
    const processOptions = { timeout: 15 * 60_000, maxBuffer: 16 * 1024 * 1024, env: connectionEnvironment(databaseUrl) }
    await exec('pg_dump', ['--format=custom', '--no-password', '--lock-wait-timeout=10s', '--file', archive], processOptions)
    if (!(await stat(archive)).size) throw new Error('Empty PostgreSQL archive')
    await chmod(archive, 0o600)
    await exec('pg_restore', ['--list', archive], processOptions)
    await writeFile(join(staging, 'SHA256SUMS.txt'), `${await fileHash(archive)}  database.dump\n`, { mode: 0o600 })
    await rename(staging, join(dir, name))
    return name
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
