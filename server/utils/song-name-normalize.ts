export function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b(feat\.?|ft\.?)\b/gi, '')
    .replace(/[&＆]/g, 'and')
    .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉""''、，。！？：；～·]/g, '')
    .trim()
}