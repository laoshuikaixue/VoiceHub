const formatLocaleString = (value: string, args: unknown[]) => {
  if (args.length === 0) return value
  return value.replace(/{(\d+)}/g, (match, index) =>
    args[Number(index)] !== undefined ? String(args[Number(index)]) : match
  )
}

export const useSafeLocale = <T extends Record<string, any>>(source: T): T => {
  if (source == null || typeof source !== 'object') return source

  return new Proxy(source, {
    get(target, prop) {
      const value = target[prop as keyof T]

      if (typeof value === 'function') return value

      if (typeof value === 'string') {
        const formatter = (...args: unknown[]) => formatLocaleString(value, args)
        formatter.toString = () => value
        formatter.valueOf = () => value
        return formatter
      }

      if (value && typeof value === 'object') {
        return useSafeLocale(value as Record<string, any>)
      }

      return value
    }
  }) as T
}
