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
    // 缺参时回退为空串，避免把原始占位符（如 {0}）暴露给用户
    return args[argIndex] !== undefined ? String(args[argIndex]) : ''
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
 * ofetch 抛出的 FetchError.message 形如 `[POST] "/api/x": 401 ...`、`[GET] "...": <no response>`，
 * 属于面向开发者的技术串，绝不能作为用户可见文案；识别后跳过，交由上层本地化兜底处理。
 */
const isFetchEnvelopeMessage = (message: string): boolean =>
  /^\[[A-Za-z]+\]\s+".*":\s+/.test(message)

/**
 * Extract a human-readable message from a thrown error / failed `$fetch` response.
 * Superset of the previous `getThrownMessage` / `getErrorMessage` variants.
 * 会过滤掉 ofetch 的技术性包装串，避免其泄漏到用户界面。
 */
export const getThrownMessage = (err: any): string => {
  if (!err) return ''
  if (typeof err === 'string') return err
  const candidates = [
    err?.data?.message,
    err?.data?.statusMessage,
    err?.message,
    err?.statusMessage
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate && !isFetchEnvelopeMessage(candidate)) {
      return candidate
    }
  }
  return ''
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
 *  2. the server-provided `message` (简体中文默认文案, from `createApiError`), 已过滤 ofetch 技术包装串;
 *  3. the supplied `fallback` string;
 *  4. 本地化通用兜底文案（按当前语言）。
 *
 * This is the single client entry point that decouples server messages from a specific
 * language, superseding the hand-maintained mirror maps (card-code tables, `serverMessages`).
 */
export const useServerErrors = () => {
  const { serverErrors, currentLocale } = useLocale()

  const localize = (err: any, fallback = ''): string => {
    const code = extractErrorCode(err)
    if (code) {
      const entry = (serverErrors.value as Record<string, unknown> | undefined)?.[code]
      if (entry !== undefined && entry !== null) {
        return formatLocaleValue(entry, ...extractErrorParams(err))
      }
    }
    const thrown = getThrownMessage(err)
    if (thrown) return thrown
    if (fallback) return fallback
    // catch-all：码未命中、无干净消息、调用方也未给兜底时，返回本地化通用文案，
    // 避免向用户展示空白或 ofetch 原始技术串。
    return currentLocale.value === 'en-US'
      ? 'Request failed, please try again later.'
      : '请求失败，请稍后重试'
  }

  return { localize, extractErrorCode }
}
