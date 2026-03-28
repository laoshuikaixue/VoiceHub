ALTER TABLE "SystemSettings"
  ADD COLUMN "customOAuthEnabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN "customOAuthDisplayName" text,
  ADD COLUMN "customOAuthAuthorizeUrl" text,
  ADD COLUMN "customOAuthTokenUrl" text,
  ADD COLUMN "customOAuthUserInfoUrl" text,
  ADD COLUMN "customOAuthScope" text,
  ADD COLUMN "customOAuthClientId" text,
  ADD COLUMN "customOAuthClientSecret" text,
  ADD COLUMN "customOAuthUserIdField" text,
  ADD COLUMN "customOAuthUsernameField" text,
  ADD COLUMN "customOAuthNameField" text,
  ADD COLUMN "customOAuthEmailField" text,
  ADD COLUMN "customOAuthAvatarField" text;
