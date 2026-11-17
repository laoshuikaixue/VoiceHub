import type { H3Event } from 'h3'
import { setHeader } from 'h3'

/**
 * 日志导出：CSV 与原始 JSON Lines 两种格式。
 * CSV 带 BOM 并防公式注入；JSONL 保留完整原始字段，便于外部工具分析。
 */

export const LOG_EXPORT_FORMATS = ['csv', 'jsonl'] as const
export type LogExportFormat = (typeof LOG_EXPORT_FORMATS)[number]

export function readExportFormat(value: unknown): LogExportFormat {
  return value === 'jsonl' ? 'jsonl' : 'csv'
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = value instanceof Date ? value.toISOString() : String(value)
  if (/^[=+\-@]/.test(text)) text = `\t${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCsv(header: readonly string[], rows: readonly unknown[][]): string {
  const lines = [header.map(escapeCsvCell).join(',')]
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(','))
  return '\ufeff' + lines.join('\n')
}

export function buildJsonLines(rows: readonly unknown[]): string {
  if (!rows.length) return ''
  return rows.map((row) => JSON.stringify(row)).join('\n') + '\n'
}

export function setLogDownloadHeaders(
  event: H3Event,
  format: LogExportFormat,
  filename: string
): void {
  setHeader(
    event,
    'Content-Type',
    format === 'jsonl' ? 'application/x-ndjson; charset=utf-8' : 'text/csv; charset=utf-8'
  )
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  setHeader(event, 'Cache-Control', 'no-store')
}
