DO $$ BEGIN
  CREATE TYPE "payment_order_status" AS ENUM ('PENDING','PAID','COMPLETED','EXPIRED','CANCELLED','FAILED','REFUND_REQUESTED','REFUNDING','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PaymentSettings" (
  "id" serial PRIMARY KEY,
  "enabled" boolean NOT NULL DEFAULT false,
  "currency" varchar(3) NOT NULL DEFAULT 'CNY',
  "productNamePrefix" text NOT NULL DEFAULT 'VoiceHub 点歌券',
  "productNameSuffix" text NOT NULL DEFAULT '',
  "minAmountCents" integer NOT NULL DEFAULT 1,
  "maxAmountCents" integer,
  "dailyLimitCents" integer,
  "balanceRechargeMultiplier" numeric(12,4) NOT NULL DEFAULT '1',
  "subscriptionUsdToCnyRate" numeric(12,4) NOT NULL DEFAULT '0',
  "rechargeFeeRate" numeric(8,4) NOT NULL DEFAULT '0',
  "orderTimeoutMinutes" integer NOT NULL DEFAULT 30,
  "maxPendingOrders" integer NOT NULL DEFAULT 3,
  "loadBalanceStrategy" varchar(20) NOT NULL DEFAULT 'round-robin',
  "visibleMethods" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "helpText" text,
  "helpImageUrl" text,
  "cancelLimitEnabled" boolean NOT NULL DEFAULT true,
  "cancelWindowMinutes" integer NOT NULL DEFAULT 60,
  "cancelWindowUnit" varchar(10) NOT NULL DEFAULT 'minute',
  "cancelWindowMode" varchar(10) NOT NULL DEFAULT 'rolling',
  "cancelMaxCount" integer NOT NULL DEFAULT 5,
  "alipayForceQrCode" boolean NOT NULL DEFAULT false,
  "alipayMobileDeepLink" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "PaymentPlan" (
  "id" serial PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "priceCents" integer NOT NULL,
  "originalPriceCents" integer,
  "currency" varchar(3) NOT NULL DEFAULT 'CNY',
  "cardCount" integer NOT NULL DEFAULT 1,
  "validityValue" integer NOT NULL DEFAULT 30,
  "validityUnit" varchar(10) NOT NULL DEFAULT 'day',
  "features" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "forSale" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "PaymentPlan" ADD COLUMN IF NOT EXISTS "validityValue" integer NOT NULL DEFAULT 30;
ALTER TABLE "PaymentPlan" ADD COLUMN IF NOT EXISTS "validityUnit" varchar(10) NOT NULL DEFAULT 'day';
CREATE INDEX IF NOT EXISTS "payment_plan_sale_sort_idx" ON "PaymentPlan" ("forSale","sortOrder");

CREATE TABLE IF NOT EXISTS "PaymentProviderInstance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerKey" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "configEncrypted" text NOT NULL,
  "supportedMethods" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "paymentMode" varchar(20) NOT NULL DEFAULT '',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "limits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "refundEnabled" boolean NOT NULL DEFAULT false,
  "allowUserRefund" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "payment_provider_key_idx" ON "PaymentProviderInstance" ("providerKey");
CREATE INDEX IF NOT EXISTS "payment_provider_enabled_sort_idx" ON "PaymentProviderInstance" ("enabled","sortOrder");

CREATE TABLE IF NOT EXISTS "PaymentOrder" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "outTradeNo" varchar(64) NOT NULL UNIQUE,
  "userId" integer NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "userName" varchar(100) NOT NULL,
  "userEmail" varchar(255),
  "planId" integer REFERENCES "PaymentPlan"("id") ON DELETE SET NULL,
  "planName" varchar(100) NOT NULL,
  "cardCount" integer NOT NULL,
  "amountCents" integer NOT NULL,
  "payAmountCents" integer NOT NULL,
  "feeRate" integer NOT NULL DEFAULT 0,
  "currency" varchar(3) NOT NULL DEFAULT 'CNY',
  "paymentMethod" varchar(30) NOT NULL,
  "providerInstanceId" uuid REFERENCES "PaymentProviderInstance"("id") ON DELETE SET NULL,
  "providerKey" varchar(30) NOT NULL,
  "providerSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "paymentTradeNo" varchar(128),
  "payUrl" text,
  "qrCode" text,
  "clientSecret" text,
  "status" "payment_order_status" NOT NULL DEFAULT 'PENDING',
  "refundAmountCents" integer NOT NULL DEFAULT 0,
  "refundReason" text,
  "refundId" varchar(128),
  "refundRequestedAt" timestamptz,
  "refundedAt" timestamptz,
  "expiresAt" timestamptz NOT NULL,
  "paidAt" timestamptz,
  "completedAt" timestamptz,
  "failedAt" timestamptz,
  "failedReason" text,
  "clientIp" varchar(64),
  "sourceUrl" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "payment_order_user_created_idx" ON "PaymentOrder" ("userId","createdAt");
CREATE INDEX IF NOT EXISTS "payment_order_status_expires_idx" ON "PaymentOrder" ("status","expiresAt");
CREATE INDEX IF NOT EXISTS "payment_order_provider_paid_idx" ON "PaymentOrder" ("providerInstanceId","paidAt");

CREATE TABLE IF NOT EXISTS "PaymentOrderCard" (
  "id" serial PRIMARY KEY,
  "orderId" uuid NOT NULL REFERENCES "PaymentOrder"("id") ON DELETE CASCADE,
  "cardCodeId" integer NOT NULL REFERENCES "CardCode"("id") ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "payment_order_card_unique" UNIQUE ("orderId","cardCodeId")
);
CREATE INDEX IF NOT EXISTS "payment_order_card_code_idx" ON "PaymentOrderCard" ("cardCodeId");

CREATE TABLE IF NOT EXISTS "PaymentAuditLog" (
  "id" serial PRIMARY KEY,
  "orderId" uuid NOT NULL REFERENCES "PaymentOrder"("id") ON DELETE CASCADE,
  "action" varchar(50) NOT NULL,
  "detail" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "operator" varchar(100) NOT NULL DEFAULT 'system',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "payment_audit_order_idx" ON "PaymentAuditLog" ("orderId","createdAt");
