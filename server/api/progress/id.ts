import { defineEventHandler } from 'h3'
import { generateProgressId } from './events'
 
export default defineEventHandler(() => {
  const id = generateProgressId()
  return { id }
}) 