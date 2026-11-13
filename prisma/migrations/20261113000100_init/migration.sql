-- Rasa Undangan — initial schema (versioned migration 20261113000100_init).
-- Dijalankan oleh scripts/migrate.ts di dalam transaksi per file.
-- Semua tabel operasional memuat "tenantId" + index; isolasi juga dipaksa
-- oleh src/lib/tenant.ts (Prisma $extends) dan src/server/context.ts (RBAC).

CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN','RESELLER','USER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE','INVITED','SUSPENDED');
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED','BANNED','EXPIRED');
CREATE TYPE "MemberRole" AS ENUM ('TENANT_ADMIN','EVENT_OWNER','CO_HOST','EDITOR','CHECKIN_STAFF','VIEWER');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE "EventType" AS ENUM ('WEDDING','KHITANAN','AQIQAH','BIRTHDAY','CORPORATE','SEMINAR','SYUKURAN','OTHER');
CREATE TYPE "RsvpStatus" AS ENUM ('ATTENDING','DECLINED','MAYBE');
CREATE TYPE "BlastChannel" AS ENUM ('WHATSAPP','EMAIL','SMS');
CREATE TYPE "BlastStatus" AS ENUM ('DRAFT','SCHEDULED','PROCESSING','COMPLETED','FAILED','CANCELLED');
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED','SENT','DELIVERED','READ','REPLIED','FAILED','OPTED_OUT');
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP','EMAIL','IN_APP');
CREATE TYPE "WishStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','PENDING','PAID','FAILED','REFUNDED','EXPIRED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING','ACTIVE','PAST_DUE','GRACE','EXPIRED','CANCELLED');
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT','PUBLISHED','UNPUBLISHED');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN','RESOLVED','DISMISSED');

CREATE TABLE "Tenant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "customDomain" TEXT,
  "subdomain" TEXT,
  "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
  "planId" TEXT NOT NULL,
  "logoUrl" TEXT,
  "faviconUrl" TEXT,
  "branding" JSONB NOT NULL DEFAULT '{}',
  "themeConfig" JSONB NOT NULL DEFAULT '{}',
  "locale" TEXT NOT NULL DEFAULT 'id',
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "trialEndsAt" TIMESTAMP(3),
  "graceUntil" TIMESTAMP(3),
  "suspendedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE INDEX "Tenant_planId_idx" ON "Tenant"("planId");

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "name" TEXT NOT NULL,
  "phoneEncrypted" TEXT,
  "phoneMasked" TEXT,
  "phoneHash" TEXT,
  "avatarUrl" TEXT,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "emailVerifiedAt" TIMESTAMP(3),
  "locale" TEXT NOT NULL DEFAULT 'id',
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "MemberRole" NOT NULL,
  "eventId" TEXT,
  "invitedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Membership_tenantId_userId_role_eventId_key" ON "Membership"("tenantId","userId","role","eventId");
CREATE INDEX "Membership_tenantId_userId_idx" ON "Membership"("tenantId","userId");
CREATE INDEX "Membership_tenantId_eventId_idx" ON "Membership"("tenantId","eventId");

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "csrfSecret" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "impersonatorId" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE TABLE "VerificationToken" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "identifier" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "codeHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "meta" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");
CREATE INDEX "VerificationToken_identifier_purpose_idx" ON "VerificationToken"("identifier","purpose");
CREATE INDEX "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt");

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "monthlyPrice" INTEGER NOT NULL DEFAULT 0,
  "yearlyPrice" INTEGER NOT NULL DEFAULT 0,
  "trialDays" INTEGER NOT NULL DEFAULT 14,
  "limits" JSONB NOT NULL DEFAULT '{}',
  "features" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "graceUntil" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "autoRenew" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Subscription_tenantId_status_idx" ON "Subscription"("tenantId","status");

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "planId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "discount" INTEGER NOT NULL DEFAULT 0,
  "tax" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "provider" TEXT NOT NULL DEFAULT 'MOCK',
  "providerRef" TEXT,
  "couponCode" TEXT,
  "meta" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId","status");

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "providerRef" TEXT,
  "status" TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Transaction_tenantId_invoiceId_idx" ON "Transaction"("tenantId","invoiceId");

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'PERCENT',
  "value" INTEGER NOT NULL,
  "maxRedemptions" INTEGER NOT NULL DEFAULT 0,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "appliesToPlanIds" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

CREATE TABLE "CouponRedemption" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "discountApplied" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CouponRedemption_tenantId_couponId_idx" ON "CouponRedemption"("tenantId","couponId");

CREATE TABLE "Referral" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "referredTenantId" TEXT,
  "commissionPercent" INTEGER NOT NULL DEFAULT 10,
  "totalEarned" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");

CREATE TABLE "Payout" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payout_referralId_idx" ON "Payout"("referralId");

CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "EventType" NOT NULL DEFAULT 'WEDDING',
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "themeId" TEXT NOT NULL DEFAULT 'elegant-ivory',
  "themeConfig" JSONB NOT NULL DEFAULT '{}',
  "sections" JSONB NOT NULL DEFAULT '[]',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "meta" JSONB NOT NULL DEFAULT '{}',
  "coverImageUrl" TEXT,
  "publishedAt" TIMESTAMP(3),
  "indexable" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_tenantId_status_idx" ON "Event"("tenantId","status");
CREATE INDEX "Event_tenantId_createdAt_idx" ON "Event"("tenantId","createdAt");

CREATE TABLE "EventVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventVersion_eventId_version_key" ON "EventVersion"("eventId","version");
CREATE INDEX "EventVersion_tenantId_eventId_idx" ON "EventVersion"("tenantId","eventId");

CREATE TABLE "EventSchedule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "venueName" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "mapsUrl" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "note" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventSchedule_tenantId_eventId_idx" ON "EventSchedule"("tenantId","eventId");

CREATE TABLE "Guest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phoneEncrypted" TEXT,
  "phoneMasked" TEXT,
  "phoneHash" TEXT,
  "email" TEXT,
  "token" TEXT NOT NULL,
  "qrPayload" TEXT NOT NULL,
  "groupLabel" TEXT NOT NULL DEFAULT 'Umum',
  "tags" JSONB NOT NULL DEFAULT '[]',
  "paxAllocated" INTEGER NOT NULL DEFAULT 1,
  "paxConfirmed" INTEGER NOT NULL DEFAULT 0,
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "notes" TEXT,
  "seatNumber" TEXT,
  "tableNumber" TEXT,
  "blacklisted" BOOLEAN NOT NULL DEFAULT false,
  "optOut" BOOLEAN NOT NULL DEFAULT false,
  "walkIn" BOOLEAN NOT NULL DEFAULT false,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastOpenedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Guest_token_key" ON "Guest"("token");
CREATE UNIQUE INDEX "Guest_eventId_phoneHash_key" ON "Guest"("eventId","phoneHash");
CREATE UNIQUE INDEX "Guest_qrPayload_key" ON "Guest"("qrPayload");
CREATE INDEX "Guest_tenantId_eventId_idx" ON "Guest"("tenantId","eventId");
CREATE INDEX "Guest_eventId_groupLabel_idx" ON "Guest"("eventId","groupLabel");
CREATE INDEX "Guest_eventId_name_idx" ON "Guest"("eventId","name");

CREATE TABLE "RsvpForm" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '[]',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "deadlineAt" TIMESTAMP(3),
  "paxQuotaPerGuest" INTEGER NOT NULL DEFAULT 5,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "thankYouMessage" TEXT NOT NULL DEFAULT 'Terima kasih! Konfirmasi kehadiran Anda sudah kami terima.',
  "redirectUrl" TEXT,
  "locales" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RsvpForm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RsvpForm_eventId_key" ON "RsvpForm"("eventId");
CREATE INDEX "RsvpForm_tenantId_idx" ON "RsvpForm"("tenantId");

CREATE TABLE "Rsvp" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "status" "RsvpStatus" NOT NULL,
  "pax" INTEGER NOT NULL DEFAULT 1,
  "answers" JSONB NOT NULL DEFAULT '{}',
  "sessionId" TEXT,
  "mealChoice" TEXT,
  "attendanceNote" TEXT,
  "editTokenHash" TEXT NOT NULL,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "ipHash" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "Rsvp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Rsvp_eventId_guestId_key" ON "Rsvp"("eventId","guestId");
CREATE UNIQUE INDEX "Rsvp_editTokenHash_key" ON "Rsvp"("editTokenHash");
CREATE INDEX "Rsvp_tenantId_eventId_status_idx" ON "Rsvp"("tenantId","eventId","status");

CREATE TABLE "GuestVisit" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "guestId" TEXT,
  "sectionKey" TEXT NOT NULL DEFAULT 'cover',
  "path" TEXT NOT NULL,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "referrerHash" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestVisit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestVisit_tenantId_eventId_createdAt_idx" ON "GuestVisit"("tenantId","eventId","createdAt");
CREATE INDEX "GuestVisit_eventId_sectionKey_idx" ON "GuestVisit"("eventId","sectionKey");

CREATE TABLE "Wish" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "guestId" TEXT,
  "authorName" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "WishStatus" NOT NULL DEFAULT 'PENDING',
  "reply" TEXT,
  "ipHash" TEXT,
  "moderatedAt" TIMESTAMP(3),
  "moderatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Wish_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Wish_tenantId_eventId_status_idx" ON "Wish"("tenantId","eventId","status");

CREATE TABLE "GuestBookEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "guestId" TEXT,
  "name" TEXT NOT NULL,
  "message" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestBookEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestBookEntry_tenantId_eventId_idx" ON "GuestBookEntry"("tenantId","eventId");

CREATE TABLE "CheckIn" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "station" TEXT NOT NULL DEFAULT 'loket-1',
  "deviceId" TEXT NOT NULL DEFAULT 'web',
  "actorId" TEXT,
  "method" TEXT NOT NULL DEFAULT 'QR',
  "syncedFromOffline" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CheckIn_eventId_guestId_key" ON "CheckIn"("eventId","guestId");
CREATE INDEX "CheckIn_tenantId_eventId_at_idx" ON "CheckIn"("tenantId","eventId","at");

CREATE TABLE "SeatingTable" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 10,
  "shape" TEXT NOT NULL DEFAULT 'ROUND',
  "position" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeatingTable_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SeatingTable_tenantId_eventId_idx" ON "SeatingTable"("tenantId","eventId");

CREATE TABLE "Blast" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "channel" "BlastChannel" NOT NULL DEFAULT 'WHATSAPP',
  "name" TEXT NOT NULL,
  "templateBody" TEXT NOT NULL,
  "filters" JSONB NOT NULL DEFAULT '{}',
  "scheduledAt" TIMESTAMP(3),
  "status" "BlastStatus" NOT NULL DEFAULT 'DRAFT',
  "throttlePerMinute" INTEGER NOT NULL DEFAULT 60,
  "total" INTEGER NOT NULL DEFAULT 0,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "Blast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Blast_tenantId_eventId_status_idx" ON "Blast"("tenantId","eventId","status");

CREATE TABLE "BlastMessage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "blastId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "toMasked" TEXT,
  "body" TEXT NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
  "error" TEXT,
  "providerMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "repliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlastMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BlastMessage_tenantId_blastId_status_idx" ON "BlastMessage"("tenantId","blastId","status");
CREATE INDEX "BlastMessage_blastId_guestId_idx" ON "BlastMessage"("blastId","guestId");

CREATE TABLE "Reminder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "blastId" TEXT,
  "channel" "BlastChannel" NOT NULL DEFAULT 'WHATSAPP',
  "offsetDays" INTEGER NOT NULL,
  "templateBody" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "jobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Reminder_tenantId_eventId_status_idx" ON "Reminder"("tenantId","eventId","status");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "toMasked" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_tenantId_userId_readAt_idx" ON "Notification"("tenantId","userId","readAt");

CREATE TABLE "NotificationLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "channel" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "toMasked" TEXT,
  "templateKey" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL,
  "response" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationLog_tenantId_createdAt_idx" ON "NotificationLog"("tenantId","createdAt");

CREATE TABLE "ApiKey" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "secretEncrypted" TEXT NOT NULL,
  "scopes" JSONB NOT NULL DEFAULT '[]',
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");

CREATE TABLE "Webhook" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secretEncrypted" TEXT NOT NULL,
  "events" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Webhook_tenantId_active_idx" ON "Webhook"("tenantId","active");

CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "webhookId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signature" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebhookDelivery_tenantId_status_nextRetryAt_idx" ON "WebhookDelivery"("tenantId","status","nextRetryAt");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId","createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId","createdAt");

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");
CREATE INDEX "MediaAsset_tenantId_idx" ON "MediaAsset"("tenantId");

CREATE TABLE "Template" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'Umum',
  "tags" JSONB NOT NULL DEFAULT '[]',
  "themeId" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "previewUrl" TEXT,
  "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Template_code_key" ON "Template"("code");
CREATE INDEX "Template_status_category_idx" ON "Template"("status","category");

CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Announcement_active_publishedAt_idx" ON "Announcement"("active","publishedAt");

CREATE TABLE "FeatureFlag" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "enabledGlobally" BOOLEAN NOT NULL DEFAULT false,
  "tenantOverrides" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

CREATE TABLE "SystemSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "Comment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sectionKey" TEXT,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Comment_tenantId_eventId_idx" ON "Comment"("tenantId","eventId");

CREATE TABLE "ReportAbuse" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "eventId" TEXT,
  "reporterEmail" TEXT,
  "reason" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT '',
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportAbuse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReportAbuse_status_createdAt_idx" ON "ReportAbuse"("status","createdAt");

CREATE TABLE "QuotaUsage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "used" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotaUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuotaUsage_tenantId_metric_period_key" ON "QuotaUsage"("tenantId","metric","period");

-- Foreign keys untuk integritas tenant (ON DELETE CASCADE = GDPR delete aman).
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rsvp" ADD CONSTRAINT "Rsvp_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Blast" ADD CONSTRAINT "Blast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlastMessage" ADD CONSTRAINT "BlastMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventVersion" ADD CONSTRAINT "EventVersion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSchedule" ADD CONSTRAINT "EventSchedule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
