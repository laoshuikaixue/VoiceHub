import { defineEventHandler } from 'h3'
import recipients from './card-codes/recipients.get'

// 复用轻量接收人查询，仅返回身份显示与组织字段。
export default defineEventHandler((event) => recipients(event))
