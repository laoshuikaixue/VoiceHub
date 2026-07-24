import { createError } from 'h3'

/**
 * 创建带「机器可读错误码」的 API 错误。
 *
 * 统一了此前分散在各处的 `createCardCodeError` 形态：
 * - `statusMessage` 存放稳定错误码（如 `CARD_CODE_INVALID_OR_USED`），
 * - `data.code` 同步携带该码，供客户端按 code 本地化，
 * - `message` 为英文默认文案，作为客户端取不到本地化词条时的兜底。
 *
 * 客户端通过 `useServerErrors().localize(err)` 优先按 `code` 查 `serverErrors` 词典，
 * 未命中再回退到 `message`，从而把服务端消息与具体语言解耦。
 *
 * @param statusCode HTTP 状态码
 * @param code       稳定错误码（建议取自 SERVER_ERROR_CODES）
 * @param message    英文默认文案（兜底）
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
