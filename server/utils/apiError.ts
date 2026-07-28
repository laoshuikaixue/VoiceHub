import { createError } from 'h3'

/**
 * 创建带「机器可读错误码」的 API 错误。
 *
 * 统一了此前分散在各处的 `createCardCodeError` 形态：
 * - `statusMessage` 存放稳定错误码（如 `CARD_CODE_INVALID_OR_USED`），
 * - `data.code` 同步携带该码，供客户端按 code 本地化，
 * - `message` 为默认文案：本项目服务端统一以简体中文书写，仅用于服务端日志，
 *   以及客户端在 `serverErrors` 词典取不到对应 code 时的兜底展示。
 *
 * 语言解耦以 `code` 为准：客户端 `useServerErrors().localize(err)` 优先按 `code` 查
 * `serverErrors` 词典（含中英文），未命中才回退到 `message`。因此界面显示的语言由词典决定，
 * `message` 本身用哪种语言不影响多语言展示。
 *
 * @param statusCode HTTP 状态码
 * @param code       稳定错误码（建议取自 SERVER_ERROR_CODES）
 * @param message    默认文案（简体中文；服务端日志与客户端兜底用）
 * @param data       附加数据；`params` 数组会在客户端作为占位符 `{0}`、`{1}` 的替换值
 */
export function createApiError(
  statusCode: number,
  code: string,
  message: string,
  data?: Record<string, unknown>
) {
  return createError({
    statusCode,
    statusMessage: code,
    message,
    data: { code, ...(data || {}) }
  })
}
