/**
 * 简单的日志工具
 */

const isDev = process.env.NODE_ENV === 'development'

export const logger = {
  info: (tag: string, ...args: any[]) => {
    console.log(`[${tag}]`, ...args)
  },
  
  warn: (tag: string, ...args: any[]) => {
    console.warn(`[${tag}]`, ...args)
  },
  
  error: (tag: string, ...args: any[]) => {
    console.error(`[${tag}]`, ...args)
  },
  
  debug: (tag: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[${tag}]`, ...args)
    }
  }
}
