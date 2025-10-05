/**
 * 将HTTP URL转换为HTTPS
 * @param url - 要转换的URL
 * @returns 转换后的HTTPS URL
 */
export const convertToHttps = (url: string | null | undefined): string => {
    if (!url) return url || ''
    if (url.startsWith('http://')) {
        return url.replace('http://', 'https://')
    }
    return url
}

/**
 * 验证URL格式是否有效
 * @param url - 要验证的URL字符串
 * @returns 验证结果对象
 */
export const validateUrl = (url: string): { valid: boolean; error?: string } => {
    if (!url) return {valid: true} // 空URL视为有效（可选字段）

    if (typeof url !== 'string') {
        return {valid: false, error: 'URL必须是字符串类型'}
    }

    // 检查是否以http://或https://开头
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return {valid: false, error: 'URL必须以http://或https://开头'}
    }

    // 检查是否包含://结构
    if (!url.includes('://')) {
        return {valid: false, error: 'URL格式不正确，缺少://结构'}
    }

    try {
        // 使用URL构造函数验证基本格式
        new URL(url)
        return {valid: true}
    } catch {
        return {valid: false, error: 'URL格式不正确'}
    }
}

/**
 * 批量验证URL
 * @param urls - URL对象数组，包含url和type字段
 * @returns Promise<ValidationResult[]> - 验证结果数组
 */
export interface UrlValidationItem {
    url: string
    type?: 'image' | 'audio' // 保持兼容性，但不再使用
    name?: string // 用于标识URL的名称
}

export interface ValidationResult {
    url: string
    type?: 'image' | 'audio'
    name?: string
    valid: boolean
    error?: string
}

export const validateUrls = async (urls: UrlValidationItem[]): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = []

    for (const item of urls) {
        const result = validateUrl(item.url)

        results.push({
            url: item.url,
            type: item.type,
            name: item.name,
            valid: result.valid,
            error: result.error
        })
    }

    return results
}