import { createApiError } from '../apiError.ts'
import { SERVER_ERROR_CODES } from '../../config/constants.ts'

export function pluginError(code: keyof typeof SERVER_ERROR_CODES, status = 502) {
  return createApiError(status, SERVER_ERROR_CODES[code], code)
}
