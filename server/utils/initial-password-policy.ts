interface InitialPasswordUserState {
  requirePasswordChange?: boolean | null
}

interface StoredPasswordState {
  password?: string | null
  passwordChangedAt?: Date | string | null
}

export interface PasswordSetupState {
  hasSetPassword: boolean
  needsInitialPasswordSetup: boolean
}

export function getPasswordSetupState(
  storedPassword: StoredPasswordState,
  requirePasswordChange: boolean
): PasswordSetupState {
  const hasSetPassword = !!storedPassword.password
  return {
    hasSetPassword,
    needsInitialPasswordSetup:
      !storedPassword.passwordChangedAt && (requirePasswordChange || !hasSetPassword)
  }
}

export function canSetInitialPassword(
  user: InitialPasswordUserState,
  storedPassword: StoredPasswordState
): boolean {
  return getPasswordSetupState(storedPassword, !!user.requirePasswordChange)
    .needsInitialPasswordSetup
}
