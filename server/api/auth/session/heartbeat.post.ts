import { updateCurrentUserSessionActivity } from '~~/server/services/userSessionService'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ path?: string }>(event).catch(() => ({}))
  await updateCurrentUserSessionActivity(event, body?.path)
  return { success: true }
})
