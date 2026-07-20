interface InitialPasswordUserState {
  requirePasswordChange?: boolean | null
}

interface StoredPasswordState {
  password?: string | null
  passwordChangedAt?: Date | string | null
}

export function canSetInitialPassword(
  user: InitialPasswordUserState,
  storedPassword: StoredPasswordState
): boolean {
  if (storedPassword.passwordChangedAt) return false
  return !!user.requirePasswordChange || !storedPassword.password
}
