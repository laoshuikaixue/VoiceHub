import type { MaybeRefOrGetter } from 'vue'
import { useLocale } from '~/utils/locale'

/**
 * Shared locale-access helpers.
 *
 * Historically ~30 components each re-implemented their own accessor
 * (`callLocale`, `getLocaleMessage`, `getNestedMessage`, `formatLocaleValue`,
 * `getThrownMessage`, `formatString`, ...). These are the single source of truth.
 *
 * Two families:
 *  - Standalone helpers (`formatLocaleValue`, `getThrownMessage`) that operate on an
 *    already-resolved value / error object and need no locale source.
 *  - `useLocaleText(source)` which binds a locale section (raw object or a
 *    `useSafeLocale` proxy) and exposes key/path lookups (`t`, `msg`, `nested`)
 *    plus the `format` / `errMessage` conveniences.
 *
 * Substitution supports `{0}`, `{1}`, ... positional placeholders. `format`/`t`
 * additionally accept the `{count}` alias (→ arg 0) used by a couple of pluralized
 * strings.
 */

/** Replace `{0}`, `{1}`, ... plus the `{count}` alias (→ arg 0) in a template string. */
const substituteWithCount = (template: string, args: unknown[]): string =>
  template.replace(/{(\d+)}|{count}/g, (match, index) => {
    const argIndex = match === '{count}' ? 0 : Number(index)
    return args[argIndex] !== undefined ? String(args[argIndex]) : match
  })

/**
 * Resolve an already-obtained locale value to a display string.
 * - function  → call it with `args` (locale formatter)
 * - string    → positional `{n}` substitution
 * - otherwise → the value itself, or `''`
 *
 * Matches the dominant `formatLocaleValue(value, ...args)` variant used across the app.
 */
export const formatLocaleValue = (value: unknown, ...args: unknown[]): string => {
  if (typeof value === 'function') return (value as (...a: unknown[]) => unknown)(...args) as string
  if (typeof value === 'string') return substituteWithCount(value, args)
  return (value as string) ?? ''
}

/** Alias kept for call sites that used the `formatLocale` name (identical semantics). */
export const formatLocale = formatLocaleValue

/**
 * Extract a human-readable message from a thrown error / failed `$fetch` response.
 * Superset of the previous `getThrownMessage` / `getErrorMessage` variants.
 */
export const getThrownMessage = (err: any): string => {
  if (!err) return ''
  if (typeof err === 'string') return err
  return (
    err?.data?.message ||
    err?.data?.statusMessage ||
    err?.message ||
    err?.statusMessage ||
    ''
  )
}

/** Alias kept for call sites that used the `getErrorMessage` name. */
export const getErrorMessage = getThrownMessage

export const useLocaleText = (
  source: MaybeRefOrGetter<Record<string, any> | null | undefined>
) => {
  /** Resolve a value at `path` ("a" or "a.b.c") within the bound locale source. */
  const lookup = (path: string): unknown => {
    const base = toValue(source)
    return String(path)
      .split('.')
      .reduce<any>((target, key) => (target == null ? undefined : target[key]), base)
  }

  /**
   * key/path → localized string with `{n}`/`{count}` substitution and a fallback.
   * Replaces the various `callLocale(key, fallback, ...args)` implementations.
   */
  const t = (path: string, fallback = '', ...args: unknown[]): string => {
    const value = lookup(path)
    if (typeof value === 'function') return (value as (...a: unknown[]) => unknown)(...args) as string || fallback
    if (typeof value === 'string') return substituteWithCount(value, args) || fallback
    return (value as string) || fallback
  }

  /** flat key → localized string, no fallback. Replaces `getLocaleMessage(key, ...args)`. */
  const msg = (key: string, ...args: unknown[]): string => t(key, '', ...args)

  /** two-level section+key → localized string. Replaces `getNestedMessage(section, key, ...args)`. */
  const nested = (section: string, key: string, ...args: unknown[]): string =>
    t(`${section}.${key}`, '', ...args)

  /**
   * Resolved value → localized string with a fallback and `{count}` support.
   * Replaces `formatLocaleValue(value, fallback, ...args)` (the fallback-bearing variant).
   */
  const format = (value: unknown, fallback = '', ...args: unknown[]): string => {
    if (typeof value === 'function') return (value as (...a: unknown[]) => unknown)(...args) as string || fallback
    if (typeof value === 'string') return substituteWithCount(value, args) || fallback
    return (value as string) || fallback
  }

  return { t, msg, nested, format, errMessage: getThrownMessage, lookup }
}

/**
 * Extract the stable machine-readable error code from a thrown error / failed `$fetch`.
 * Errors created via `server/utils/apiError.ts#createApiError` carry the code in both
 * `statusMessage` and `data.code`; Nuxt/`$fetch` nests the server payload under `err.data`,
 * so we probe both depths. Mirrors the ad-hoc `getCardCodeErrorCode` this replaces.
 */
export const extractErrorCode = (err: any): string => {
  if (!err) return ''
  return (
    err?.data?.data?.code ||
    err?.data?.code ||
    err?.data?.statusMessage ||
    err?.statusMessage ||
    ''
  )
}

/** Positional substitution params optionally carried on the error payload (`data.params`). */
const extractErrorParams = (err: any): unknown[] => {
  const params = err?.data?.data?.params ?? err?.data?.params
  return Array.isArray(params) ? params : []
}

/**
 * Code-aware localization for server-thrown errors.
 *
 * Resolution order:
 *  1. `serverErrors[code]` dictionary entry in the current locale (with `{n}` substitution
 *     from `err.data.params`), falling back to zh-CN via the dictionary merge;
 *  2. the server-provided `message` (English default from `createApiError`);
 *  3. the supplied `fallback` string.
 *
 * This is the single client entry point that decouples server messages from a specific
 * language, superseding the hand-maintained mirror maps (card-code tables, `serverMessages`).
 */
export const useServerErrors = () => {
  const { serverErrors } = useLocale()

  const localize = (err: any, fallback = ''): string => {
    const code = extractErrorCode(err)
    if (code) {
      const entry = (serverErrors.value as Record<string, unknown> | undefined)?.[code]
      if (entry !== undefined && entry !== null) {
        return formatLocaleValue(entry, ...extractErrorParams(err))
      }
    }
    return getThrownMessage(err) || fallback
  }

  return { localize, extractErrorCode }
}
