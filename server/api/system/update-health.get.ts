import { sql } from 'drizzle-orm'
import { timingSafeEqual } from 'node:crypto'
import { db } from '~/drizzle/db'
import pkg from '~~/package.json'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const expected = process.env.VOICEHUB_UPDATE_PROBE
  const provided = getHeader(event, 'x-voicehub-update-probe')
  if (!expected || !provided || Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    setResponseStatus(event, 404)
    return null
  }
  try {
    await db.execute(sql`SELECT 1`)
    return { version: pkg.version }
  } catch {
    setResponseStatus(event, 503)
    return { version: null }
  }
})
