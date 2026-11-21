export const ORGANIZATION_LABEL_FIELDS = ['organizationLabelZh', 'organizationLabelEn'] as const
export const ORGANIZATION_LABEL_MAX_LENGTH = 24

export function parseOrganizationLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const label = value.trim()
  if ([...label].length > ORGANIZATION_LABEL_MAX_LENGTH || /[<>\r\n\t\p{Cc}\p{Cf}⟪⟫]/u.test(label)) return null
  return label
}

export function organizationLabels(source?: Record<string, unknown> | null) {
  const zh = parseOrganizationLabel(source?.organizationLabelZh) || '班级'
  const en = parseOrganizationLabel(source?.organizationLabelEn) || 'Class'
  const lower = en.replace(/^\p{Lu}/u, first => first.toLowerCase())
  const plural = (word: string) =>
    /[^aeiou]y$/i.test(word) ? `${word.slice(0, -1)}ies` : /(?:s|x|z|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`
  return { zh, en, lower, plural: plural(en), pluralLower: plural(lower) }
}

type Labels = ReturnType<typeof organizationLabels>
const tokenPattern = /⟪org\.(zh|en|lower|plural|pluralLower)⟫/g

export function applyOrganizationLabels<T>(value: T, labels: Labels): T {
  if (typeof value === 'string') {
    return value.replace(tokenPattern, (_, key: keyof Labels) => labels[key]) as T
  }
  if (typeof value === 'function') {
    return ((...args: unknown[]) => applyOrganizationLabels(value(...args), labels)) as T
  }
  if (Array.isArray(value)) return value.map(item => applyOrganizationLabels(item, labels)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, applyOrganizationLabels(item, labels)])) as T
  }
  return value
}
