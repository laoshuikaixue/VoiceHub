ALTER TABLE "SystemSettings" ADD COLUMN "oauthRedirectUri" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "oauthStateSecret" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "oauthProviders" text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "githubOAuthEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "githubClientId" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "githubClientSecret" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "casdoorOAuthEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "casdoorServerUrl" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "casdoorClientId" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "casdoorClientSecret" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "casdoorOrganizationName" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "googleOAuthEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "googleClientId" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "googleClientSecret" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthDisplayName" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthAuthorizeUrl" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthTokenUrl" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthUserInfoUrl" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthScope" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthClientId" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthClientSecret" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthUserIdField" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthUsernameField" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthNameField" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthEmailField" text;--> statement-breakpoint
ALTER TABLE "SystemSettings" ADD COLUMN "customOAuthAvatarField" text;