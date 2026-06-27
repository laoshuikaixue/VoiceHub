import { defineEventHandler } from 'h3'
import { handleOpenCardCodeDelete } from '~~/server/utils/card-code-delete-handler'

export default defineEventHandler(handleOpenCardCodeDelete)
