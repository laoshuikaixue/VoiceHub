import { AsyncLocalStorage } from 'node:async_hooks'
import { getServerTimestamp } from '~~/server/utils/serverTime'

export type RequestDatabaseContext = {
  requestId: string
  route: string
  userId?: number | null
}

type QueryObservation = RequestDatabaseContext & {
  query: string
  normalizedQuery: string
  observedAt: number
}

const requestStorage = new AsyncLocalStorage<RequestDatabaseContext>()
const observations: QueryObservation[] = []
const MAX_OBSERVATIONS = 2000
const OBSERVATION_WINDOW_MS = 10 * 60 * 1000

export const normalizeDatabaseQuery = (query: unknown) => String(query || '')
  .replace(/\/\*[^]*?\*\//g, ' ')
  .replace(/--[^\r\n]*/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

export const enterRequestDatabaseContext = (context: RequestDatabaseContext) => {
  requestStorage.enterWith(context)
}

export const updateRequestDatabaseUser = (userId: number | null | undefined) => {
  const context = requestStorage.getStore()
  if (context) context.userId = userId ?? null
}

export const getRequestDatabaseContext = () => requestStorage.getStore() || null

export const recordDatabaseQueryStart = (query: unknown) => {
  const context = getRequestDatabaseContext()
  if (!context?.requestId) return
  const normalizedQuery = normalizeDatabaseQuery(query)
  if (!normalizedQuery) return
  const observedAt = getServerTimestamp()
  observations.push({ ...context, query: String(query), normalizedQuery, observedAt })
  if (observations.length > MAX_OBSERVATIONS) observations.splice(0, observations.length - MAX_OBSERVATIONS)
  const cutoff = observedAt - OBSERVATION_WINDOW_MS
  while (observations.length && observations[0].observedAt < cutoff) observations.shift()
}

const queryMatches = (left: string, right: string) => {
  if (!left || !right) return false
  if (left === right) return true
  const leftPrefix = left.slice(0, 180)
  const rightPrefix = right.slice(0, 180)
  return leftPrefix.length >= 40 && leftPrefix === rightPrefix
}

export const findDatabaseQueryContext = (query: unknown, startedAt?: unknown) => {
  const normalizedQuery = normalizeDatabaseQuery(query)
  if (!normalizedQuery) return null
  const cutoff = getServerTimestamp() - OBSERVATION_WINDOW_MS
  const targetTime = startedAt ? new Date(String(startedAt)).getTime() : null
  let match: QueryObservation | null = null
  for (let index = observations.length - 1; index >= 0; index -= 1) {
    const item = observations[index]
    if (item.observedAt < cutoff) break
    if (queryMatches(item.normalizedQuery, normalizedQuery)) {
      if (targetTime == null || !Number.isFinite(targetTime)) {
        match = item
        break
      }
      if (!match || Math.abs(item.observedAt - targetTime) < Math.abs(match.observedAt - targetTime)) match = item
    }
  }
  if (!match || (targetTime != null && Number.isFinite(targetTime) && Math.abs(match.observedAt - targetTime) > 5000)) return null
  return { route: match.route, requestId: match.requestId, userId: match.userId ?? null }
}
