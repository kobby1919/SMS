-- Fresh installations only. Do not apply to an existing school database.
-- Canonical Prisma schema plus recovered SQL-only safety constraints. No seeds.

BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Day" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- CreateEnum
CREATE TYPE "SchoolPeriodType" AS ENUM ('TEACHING', 'BREAK', 'ASSEMBLY', 'LUNCH', 'CLOSING', 'OTHER');

-- CreateEnum
CREATE TYPE "TimetablePublicationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceFollowUpStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_REASON', 'REASON_PROVIDED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "Term" AS ENUM ('TERM_1', 'TERM_2', 'TERM_3');

-- CreateEnum
CREATE TYPE "SyllabusStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "FeeCategory" AS ENUM ('TUITION', 'LEVY', 'EXAM', 'FEEDING', 'TRANSPORT', 'UNIFORM', 'LIBRARY', 'SPORTS', 'OTHER');

-- CreateEnum
CREATE TYPE "FeeBillingFrequency" AS ENUM ('TERM', 'MONTHLY', 'WEEKLY', 'DAILY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "FeeStructureStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERPAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH', 'MTN_MOMO', 'VODAFONE_CASH', 'AIRTELTIGO_MONEY', 'BANK_TRANSFER', 'CHEQUE', 'POS', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'PENDING_PROVIDER', 'CHECKOUT_CREATED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentCorrectionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentCorrectionType" AS ENUM ('WRONG_AMOUNT', 'WRONG_STUDENT', 'DUPLICATE_PAYMENT', 'WRONG_METHOD', 'WRONG_REFERENCE', 'PAYMENT_BOUNCED', 'RECEIPT_CANCELLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentCorrectionRequestedAction" AS ENUM ('REVERSE_PAYMENT', 'REPLACE_PAYMENT', 'MOVE_PAYMENT', 'MARK_DUPLICATE', 'FIX_REFERENCE_OR_METHOD', 'CANCEL_RECEIPT');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('SCHOLARSHIP', 'SIBLING', 'STAFF_CHILD', 'BURSARY', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('FEE_STRUCTURE_CREATED', 'FEE_STRUCTURE_PUBLISHED', 'FEE_STRUCTURE_DELETED', 'BILL_GENERATED', 'BILL_WAIVED', 'PAYMENT_RECORDED', 'PAYMENT_REVERSED', 'PAYMENT_CORRECTION_REQUESTED', 'PAYMENT_CORRECTION_APPROVED', 'PAYMENT_CORRECTION_REJECTED', 'PAYMENT_CORRECTION_APPLIED', 'PAYMENT_CORRECTION_CANCELLED', 'DISCOUNT_APPLIED', 'DISCOUNT_REMOVED', 'FINANCE_QUERY_OPENED', 'FINANCE_QUERY_RESOLVED');

-- CreateEnum
CREATE TYPE "FinanceQueryReason" AS ENUM ('ALREADY_PAID', 'WRONG_AMOUNT', 'NEED_CLARIFICATION', 'RECEIPT_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceQueryStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WaitlistRole" AS ENUM ('HEADMASTER', 'ADMINISTRATOR', 'TEACHER', 'OTHER');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SCHOOL_CREATED');

-- CreateEnum
CREATE TYPE "SchoolOnboardingStatus" AS ENUM ('PENDING_SETUP', 'PROFILE_DONE', 'ACADEMIC_DONE', 'USERS_DONE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SchoolInviteRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "TeacherInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ParentInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TeacherInviteType" AS ENUM ('SUBJECT_TEACHER', 'CLASS_TEACHER', 'BOTH');

-- CreateEnum
CREATE TYPE "TeacherInviteAuditAction" AS ENUM ('INVITE_CREATED', 'INVITE_SENT', 'INVITE_RESENT', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_ACCEPTED');

-- CreateEnum
CREATE TYPE "ParentAccessAuditAction" AS ENUM ('PARENT_INVITED', 'PARENT_ACCOUNT_ACTIVATED', 'CHILD_LINKED', 'CHILD_REMOVED', 'ACCESS_REVOKED', 'ACCESS_RESTORED', 'CHILD_TRANSFERRED', 'CHILD_GRADUATED', 'EMAIL_CHANGED');

-- CreateEnum
CREATE TYPE "ParentInviteAuditAction" AS ENUM ('INVITE_CREATED', 'INVITE_SENT', 'INVITE_RESENT', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_ACCEPTED');

-- CreateEnum
CREATE TYPE "BursarStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT_SCHOOL');

-- CreateEnum
CREATE TYPE "CollectorStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT_SCHOOL');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('INCOMPLETE_SETUP', 'ACTIVE', 'TRANSFERRED', 'GRADUATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('INVITED', 'ACTIVE', 'INCOMPLETE_SETUP', 'SUSPENDED', 'LEFT_SCHOOL');

-- CreateEnum
CREATE TYPE "BursarInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CollectorInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "BursarInviteAuditAction" AS ENUM ('INVITE_CREATED', 'INVITE_SENT', 'INVITE_RESENT', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_ACCEPTED');

-- CreateEnum
CREATE TYPE "CollectorInviteAuditAction" AS ENUM ('INVITE_CREATED', 'INVITE_SENT', 'INVITE_RESENT', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_ACCEPTED');

-- CreateEnum
CREATE TYPE "DailyCollectionAuditAction" AS ENUM ('COLLECTOR_CREATED', 'COLLECTOR_UPDATED', 'COLLECTOR_SUSPENDED', 'COLLECTOR_REACTIVATED', 'COLLECTOR_LEFT_SCHOOL', 'COLLECTION_TYPE_CREATED', 'COLLECTION_TYPE_UPDATED', 'COLLECTION_TYPE_DEACTIVATED', 'COLLECTION_TYPE_REACTIVATED', 'COLLECTOR_ASSIGNED', 'COLLECTOR_UNASSIGNED', 'SESSION_OPENED', 'ENTRY_MARKED', 'SESSION_SUBMITTED', 'SESSION_CONFIRMED', 'SESSION_FLAGGED');

-- CreateEnum
CREATE TYPE "DailyCollectionSessionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'CONFIRMED', 'FLAGGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DailyCollectionEntryStatus" AS ENUM ('UNPAID', 'PAID', 'EXCUSED');

-- CreateEnum
CREATE TYPE "OnboardingAuditAction" AS ENUM ('WAITLIST_APPROVED', 'WAITLIST_REJECTED', 'SCHOOL_CREATED', 'INVITE_CREATED', 'INVITE_SENT', 'INVITE_RESENT', 'INVITE_REVOKED', 'INVITE_ACCEPTED', 'PROFILE_UPDATED', 'DEFAULT_ACADEMICS_CREATED', 'IMPORT_RECORDED', 'MIGRATION_INVENTORY_RECORDED', 'MIGRATION_UPLOAD_STAGED', 'MIGRATION_UPLOAD_CANCELLED', 'MIGRATION_UPLOAD_EXPIRED', 'MIGRATION_RECONCILIATION_APPROVED', 'MIGRATION_RECOVERY_RECORDED', 'ONBOARDING_COMPLETED');

-- CreateEnum
CREATE TYPE "FinanceJobType" AS ENUM ('GENERATE_BILLS', 'GENERATE_RECEIPT_PDF', 'GENERATE_DAILY_REPORT', 'SEND_PAYMENT_RECEIPT', 'SEND_PAYMENT_REMINDER', 'RECOMPUTE_FINANCE_SUMMARY', 'PROCESS_PAYMENT_WEBHOOK');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'HUBTEL', 'EXPRESSPAY', 'THETELLER', 'STRIPE', 'MANUAL', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentFeePayerRule" AS ENUM ('SCHOOL_ABSORBS', 'PARENT_PAYS');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "CAActivityType" AS ENUM ('MIDTERM_EXAM', 'CLASS_TEST', 'CLASS_EXERCISE', 'QUIZ', 'HOMEWORK', 'PROJECT', 'PRACTICAL', 'PARTICIPATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CABucketAggregationMode" AS ENUM ('AVERAGE_TO_BUCKET', 'SUM_ACTIVITIES');

-- CreateEnum
CREATE TYPE "ReportPublicationStatus" AS ENUM ('SUBMITTED', 'REJECTED', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "ExamEntryStatus" AS ENUM ('LOCKED', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ParentNotificationType" AS ENUM ('DAILY_SUMMARY', 'ATTENDANCE', 'ASSESSMENT', 'ASSIGNMENT', 'ANNOUNCEMENT', 'CONTACT', 'BILL', 'PAYMENT');

-- CreateEnum
CREATE TYPE "ParentNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "AppNotificationRecipientType" AS ENUM ('ADMIN', 'TEACHER', 'PARENT', 'BURSAR', 'OWNER');

-- CreateEnum
CREATE TYPE "AppNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AppNotificationCategory" AS ENUM ('FINANCE', 'ACADEMIC', 'ATTENDANCE', 'ACCOUNTABILITY', 'GENERAL');

-- CreateEnum
CREATE TYPE "AppNotificationType" AS ENUM ('WEEKLY_FINANCE_SUMMARY', 'DAILY_FINANCE_REPORT', 'PARENT_DAILY_SUMMARY', 'PAYMENT_CORRECTION', 'FINANCE_QUERY', 'ATTENDANCE_ALERT', 'ACCOUNTABILITY_ALERT', 'REPORT_CARD', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AppNotificationDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AppNotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppNotificationAuditEvent" AS ENUM ('NOTIFICATION_CREATED', 'DELIVERY_QUEUED', 'DELIVERY_SENT', 'DELIVERY_DELIVERED', 'DELIVERY_FAILED', 'DELIVERY_RETRY_SCHEDULED', 'DELIVERY_RETRY_REQUESTED', 'DELIVERY_CANCELLED', 'DELIVERY_DEFERRED', 'NOTIFICATION_READ');

-- CreateEnum
CREATE TYPE "ParentDeliveryChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ParentTeacherContactChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ParentTeacherContactCategory" AS ENUM ('ATTENDANCE', 'ACADEMIC_SUPPORT', 'HOMEWORK', 'FINANCE', 'WELLBEING', 'GENERAL');

-- CreateEnum
CREATE TYPE "ParentTeacherContactStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESPONDED', 'ESCALATED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParentTeacherContactMessageSender" AS ENUM ('PARENT', 'TEACHER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ParentTeacherContactRouteTarget" AS ENUM ('SUBJECT_TEACHER', 'CLASS_TEACHER', 'SELECTED_TEACHER', 'SCHOOL_OFFICE');

-- CreateEnum
CREATE TYPE "ParentDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE', 'MISSING', 'EXCUSED');

-- CreateEnum
CREATE TYPE "ParentSummaryCadence" AS ENUM ('DAILY', 'WEEKLY', 'BOTH', 'OFF');

-- CreateEnum
CREATE TYPE "ParentStudentRelationshipStatus" AS ENUM ('ACTIVE', 'REMOVED', 'TRANSFERRED', 'REVOKED', 'GRADUATED');

-- CreateEnum
CREATE TYPE "ParentStudentRelationshipRole" AS ENUM ('PRIMARY_GUARDIAN', 'GUARDIAN', 'EMERGENCY_CONTACT', 'FINANCE_CONTACT', 'PICKUP_AUTHORIZED');

-- CreateEnum
CREATE TYPE "TeacherObligationType" AS ENUM ('ATTENDANCE', 'CA_SCORE_PUBLISHING', 'HOMEWORK_CHECKING', 'SYLLABUS_PROGRESS', 'EXAM_ENTRY', 'CORRECTION_REVIEW');

-- CreateEnum
CREATE TYPE "TeacherObligationStatus" AS ENUM ('PENDING', 'COMPLETED', 'COMPLETED_LATE', 'MISSED', 'ESCALATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherObligationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TeacherReminderStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "TeacherEscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TeacherCorrectionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherAccountabilityAuditAction" AS ENUM ('OBLIGATION_CREATED', 'OBLIGATION_COMPLETED', 'OBLIGATION_COMPLETED_LATE', 'OBLIGATION_MISSED', 'OBLIGATION_ESCALATED', 'OBLIGATION_CANCELLED', 'REMINDER_QUEUED', 'REMINDER_SENT', 'REMINDER_FAILED', 'ESCALATION_CREATED', 'ESCALATION_ACKNOWLEDGED', 'ESCALATION_RESOLVED', 'ESCALATION_DISMISSED', 'CORRECTION_REQUESTED', 'CORRECTION_APPROVED', 'CORRECTION_REJECTED', 'CORRECTION_NEEDS_MORE_INFO', 'CORRECTION_CANCELLED', 'SETTINGS_UPDATED');

-- CreateEnum
CREATE TYPE "MigrationUploadStatus" AS ENUM ('VALIDATED', 'IMPORTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "legalName" TEXT,
    "displayName" TEXT,
    "shortName" TEXT,
    "emailFromName" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "contactEmail" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "onboardingStatus" "SchoolOnboardingStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "setupStep" TEXT,
    "setupCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bursar" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "BursarStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "Bursar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collector" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "CollectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "Collector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "admissionNumber" TEXT,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT NOT NULL,
    "img" TEXT,
    "bloodType" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classJoinedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "parentId" TEXT NOT NULL,
    "classId" INTEGER NOT NULL,
    "gradeId" INTEGER NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "img" TEXT,
    "bloodType" TEXT,
    "sex" "UserSex",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxClasses" INTEGER NOT NULL DEFAULT 5,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL DEFAULT 'MALE',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudentRelationship" (
    "id" TEXT NOT NULL,
    "status" "ParentStudentRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" "ParentStudentRelationshipRole" NOT NULL DEFAULT 'PRIMARY_GUARDIAN',
    "canViewFees" BOOLEAN NOT NULL DEFAULT true,
    "canViewReports" BOOLEAN NOT NULL DEFAULT true,
    "canMessageSchool" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "ParentStudentRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPaymentSetting" (
    "id" TEXT NOT NULL,
    "onlinePaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYSTACK',
    "publicKey" TEXT,
    "encryptedSecretKey" TEXT,
    "encryptedWebhookSecret" TEXT,
    "acceptedPaymentMethods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[],
    "settlementAccountReference" TEXT,
    "feePayerRule" "PaymentFeePayerRule" NOT NULL DEFAULT 'SCHOOL_ABSORBS',
    "configuredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolPaymentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolNotificationSetting" (
    "id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
    "openingTime" TEXT NOT NULL DEFAULT '07:30',
    "closingTime" TEXT NOT NULL DEFAULT '15:00',
    "summaryCadence" "ParentSummaryCadence" NOT NULL DEFAULT 'WEEKLY',
    "dailySummarySendTime" TEXT NOT NULL DEFAULT '15:15',
    "weeklySummarySendDay" TEXT NOT NULL DEFAULT 'FRIDAY',
    "weeklySummarySendTime" TEXT NOT NULL DEFAULT '15:15',
    "activeDays" TEXT[] DEFAULT ARRAY['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']::TEXT[],
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "urgentAlertsImmediate" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT NOT NULL DEFAULT '20:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '06:00',
    "lastDailySummaryRunAt" TIMESTAMP(3),
    "lastWeeklySummaryRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolNotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotificationSetting" (
    "id" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
    "sendWeeklyFinanceSummaryToAdmins" BOOLEAN NOT NULL DEFAULT true,
    "sendDailyFinanceReportToAdmins" BOOLEAN NOT NULL DEFAULT false,
    "sendParentSummariesByEmail" BOOLEAN NOT NULL DEFAULT true,
    "sendParentSummariesBySms" BOOLEAN NOT NULL DEFAULT false,
    "sendParentSummariesByWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT NOT NULL DEFAULT '20:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '06:00',
    "highPriorityOverridesQuietHours" BOOLEAN NOT NULL DEFAULT true,
    "urgentPriorityOverridesChannels" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "AppNotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotificationPreference" (
    "id" TEXT NOT NULL,
    "recipientType" "AppNotificationRecipientType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "highPriorityOverridesQuietHours" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "AppNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCommunicationPolicy" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowParentTeacherMessaging" BOOLEAN NOT NULL DEFAULT false,
    "allowInAppMessages" BOOLEAN NOT NULL DEFAULT true,
    "allowEmailMessages" BOOLEAN NOT NULL DEFAULT true,
    "allowSmsMessages" BOOLEAN NOT NULL DEFAULT false,
    "allowWhatsappMessages" BOOLEAN NOT NULL DEFAULT false,
    "exposeTeacherPhone" BOOLEAN NOT NULL DEFAULT false,
    "exposeTeacherEmail" BOOLEAN NOT NULL DEFAULT false,
    "requireParentReason" BOOLEAN NOT NULL DEFAULT true,
    "requireTeacherResponse" BOOLEAN NOT NULL DEFAULT true,
    "contactStartTime" TEXT NOT NULL DEFAULT '07:00',
    "contactEndTime" TEXT NOT NULL DEFAULT '17:00',
    "quietHoursStart" TEXT NOT NULL DEFAULT '20:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '06:00',
    "responseSlaHours" INTEGER NOT NULL DEFAULT 24,
    "escalationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "escalateAfterHours" INTEGER NOT NULL DEFAULT 48,
    "urgentBypassesQuietHours" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolCommunicationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCommunicationRoute" (
    "id" TEXT NOT NULL,
    "category" "ParentTeacherContactCategory" NOT NULL,
    "target" "ParentTeacherContactRouteTarget" NOT NULL DEFAULT 'SUBJECT_TEACHER',
    "selectedTeacherId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolCommunicationRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPeriodTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SchoolPeriodType" NOT NULL DEFAULT 'TEACHING',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolPeriodTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetablePublication" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TimetablePublicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "TimetablePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedTimetableLesson" (
    "id" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "day" "Day" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "subjectName" TEXT NOT NULL,
    "classId" INTEGER NOT NULL,
    "className" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "periodTemplateId" TEXT,
    "periodTemplateName" TEXT,
    "periodTemplateType" "SchoolPeriodType",
    "periodStartTime" TEXT,
    "periodEndTime" TEXT,
    "periodOrder" INTEGER,

    CONSTRAINT "PublishedTimetableLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAccountabilitySetting" (
    "id" TEXT NOT NULL,
    "attendanceOpenMinutesBeforeLesson" INTEGER NOT NULL DEFAULT 10,
    "attendanceGraceMinutesAfterLesson" INTEGER NOT NULL DEFAULT 10,
    "attendanceEscalateMinutesAfterLesson" INTEGER NOT NULL DEFAULT 30,
    "allowEarlyAttendanceMarking" BOOLEAN NOT NULL DEFAULT true,
    "requireLateAttendanceNote" BOOLEAN NOT NULL DEFAULT true,
    "requireAttendanceCorrectionReason" BOOLEAN NOT NULL DEFAULT true,
    "caScorePublishWindowSchoolDays" INTEGER NOT NULL DEFAULT 3,
    "caReminderAfterSchoolDays" INTEGER NOT NULL DEFAULT 2,
    "caEscalateAfterSchoolDays" INTEGER NOT NULL DEFAULT 4,
    "homeworkCheckWindowSchoolDays" INTEGER NOT NULL DEFAULT 2,
    "homeworkEscalateAfterSchoolDays" INTEGER NOT NULL DEFAULT 3,
    "syllabusUpdateExpectation" TEXT NOT NULL DEFAULT 'SAME_DAY',
    "teacherCloseoutTime" TEXT NOT NULL DEFAULT '16:00',
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "escalationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "correctionApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "TeacherAccountabilitySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherObligation" (
    "id" TEXT NOT NULL,
    "type" "TeacherObligationType" NOT NULL,
    "status" "TeacherObligationStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TeacherObligationPriority" NOT NULL DEFAULT 'NORMAL',
    "sourceModel" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "expectedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "TeacherObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherReminder" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "dedupeKey" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TeacherReminderStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,

    CONSTRAINT "TeacherReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherEscalation" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TeacherEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "escalatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,

    CONSTRAINT "TeacherEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherCorrectionRequest" (
    "id" TEXT NOT NULL,
    "sourceModel" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "TeacherCorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "TeacherCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAccountabilityAuditLog" (
    "id" TEXT NOT NULL,
    "action" "TeacherAccountabilityAuditAction" NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "sourceModel" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,

    CONSTRAINT "TeacherAccountabilityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentNotificationPreference" (
    "id" TEXT NOT NULL,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "urgentAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "preferredChannel" "ParentDeliveryChannel" NOT NULL DEFAULT 'WHATSAPP',
    "fallbackChannel" "ParentDeliveryChannel" NOT NULL DEFAULT 'SMS',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,

    CONSTRAINT "ParentNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "recipientType" "AppNotificationRecipientType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "AppNotificationType" NOT NULL,
    "category" "AppNotificationCategory" NOT NULL,
    "priority" "AppNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "payload" JSONB,
    "sourceModel" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotificationDelivery" (
    "id" TEXT NOT NULL,
    "channel" "AppNotificationDeliveryChannel" NOT NULL,
    "status" "AppNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "destination" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,

    CONSTRAINT "AppNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotificationAuditLog" (
    "id" TEXT NOT NULL,
    "event" "AppNotificationAuditEvent" NOT NULL,
    "channel" "AppNotificationDeliveryChannel",
    "fromStatus" "AppNotificationDeliveryStatus",
    "toStatus" "AppNotificationDeliveryStatus",
    "provider" TEXT,
    "destination" TEXT,
    "providerMessageId" TEXT,
    "message" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "deliveryId" TEXT,

    CONSTRAINT "AppNotificationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentNotification" (
    "id" TEXT NOT NULL,
    "type" "ParentNotificationType" NOT NULL,
    "priority" "ParentNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "payload" JSONB,
    "sourceModel" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentNotificationDeliveryLog" (
    "id" TEXT NOT NULL,
    "channel" "ParentDeliveryChannel" NOT NULL,
    "status" "ParentDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" TEXT,
    "provider" TEXT,
    "messagePreview" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "notificationId" TEXT,

    CONSTRAINT "ParentNotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentTeacherContactRequest" (
    "id" TEXT NOT NULL,
    "category" "ParentTeacherContactCategory" NOT NULL,
    "preferredChannel" "ParentTeacherContactChannel" NOT NULL DEFAULT 'IN_APP',
    "priority" "ParentNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ParentTeacherContactStatus" NOT NULL DEFAULT 'PENDING',
    "responseDueAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastParentMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTeacherResponseAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "ParentTeacherContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentTeacherContactMessage" (
    "id" TEXT NOT NULL,
    "senderRole" "ParentTeacherContactMessageSender" NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "internalOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "parentId" TEXT,
    "teacherId" TEXT,
    "studentId" TEXT,

    CONSTRAINT "ParentTeacherContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentActivityEvent" (
    "id" TEXT NOT NULL,
    "type" "ParentNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "payload" JSONB,
    "sourceModel" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" SERIAL NOT NULL,
    "level" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "section" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "supervisorId" TEXT,
    "gradeId" INTEGER NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "day" "Day" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "subjectId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    "periodTemplateId" TEXT,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "lessonId" INTEGER NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "homeworkSequence" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "lessonId" INTEGER NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" SERIAL NOT NULL,
    "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "note" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "assignmentId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "checkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" SERIAL NOT NULL,
    "score" INTEGER NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "examId" INTEGER,
    "assignmentId" INTEGER,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "present" BOOLEAN NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "arrivalTime" TEXT,
    "followUpStatus" "AttendanceFollowUpStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "followUpNote" TEXT,
    "correctionCount" INTEGER NOT NULL DEFAULT 0,
    "lastCorrectedAt" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "studentId" TEXT NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" "AttendanceStatus",
    "newStatus" "AttendanceStatus",
    "previousNote" TEXT,
    "newNote" TEXT,
    "previousArrivalTime" TEXT,
    "newArrivalTime" TEXT,
    "previousFollowUp" "AttendanceFollowUpStatus",
    "newFollowUp" "AttendanceFollowUpStatus",
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "attendanceId" INTEGER,
    "studentId" TEXT,
    "lessonId" INTEGER,

    CONSTRAINT "AttendanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "classId" INTEGER,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "expiresAt" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "classId" INTEGER,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAConfig" (
    "id" SERIAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    "currentTerm" "Term" NOT NULL DEFAULT 'TERM_1',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "classworkWeight" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "examWeight" DOUBLE PRECISION NOT NULL DEFAULT 70.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "CAConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CABucket" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CAActivityType" NOT NULL,
    "aggregationMode" "CABucketAggregationMode" NOT NULL DEFAULT 'AVERAGE_TO_BUCKET',
    "allocationMarks" DECIMAL(8,2) NOT NULL,
    "term" "Term" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "classId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CABucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAActivity" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CAActivityType" NOT NULL,
    "rawMaxScore" DECIMAL(8,2) NOT NULL,
    "allocationMarks" DECIMAL(8,2),
    "activityDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "bucketId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CAActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAActivityScore" (
    "id" SERIAL NOT NULL,
    "rawScore" DECIMAL(8,2) NOT NULL,
    "normalizedContribution" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "comment" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "activityId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CAActivityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CAAuditLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CAAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuousAssessment" (
    "id" SERIAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "classworkScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "examScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "examRecordedAt" TIMESTAMP(3),
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT 'F9',
    "gradePoint" INTEGER NOT NULL DEFAULT 9,
    "remarks" TEXT NOT NULL DEFAULT '',
    "configId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContinuousAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardPublication" (
    "id" SERIAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "status" "ReportPublicationStatus" NOT NULL DEFAULT 'UNPUBLISHED',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "unpublishedAt" TIMESTAMP(3),
    "unpublishedBy" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "classId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamEntryWindow" (
    "id" SERIAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "status" "ExamEntryStatus" NOT NULL DEFAULT 'LOCKED',
    "openedAt" TIMESTAMP(3),
    "openedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "notes" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "classId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamEntryWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Syllabus" (
    "id" SERIAL NOT NULL,
    "description" TEXT,
    "status" "SyllabusStatus" NOT NULL DEFAULT 'DRAFT',
    "term" "Term" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "subjectId" INTEGER NOT NULL,
    "gradeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusTopic" (
    "id" SERIAL NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "durationWeeks" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtopics" TEXT[],
    "objectives" TEXT[],
    "coreCompetencies" TEXT[],
    "teachingResources" TEXT,
    "syllabusId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusTopicProgress" (
    "id" SERIAL NOT NULL,
    "coveredDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "syllabusTopicId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyllabusTopicProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "academicYear" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "status" "FeeStructureStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "gradeId" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" "FeeCategory" NOT NULL,
    "billingFrequency" "FeeBillingFrequency" NOT NULL DEFAULT 'TERM',
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "feeStructureId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCollectionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "category" "FeeCategory" NOT NULL DEFAULT 'FEEDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresBursarConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "DailyCollectionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCollectionTypeCollector" (
    "id" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "collectorId" TEXT NOT NULL,
    "collectionTypeId" TEXT NOT NULL,

    CONSTRAINT "DailyCollectionTypeCollector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCollectionSession" (
    "id" TEXT NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "status" "DailyCollectionSessionStatus" NOT NULL DEFAULT 'OPEN',
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "reportedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "confirmedAmount" DECIMAL(10,2),
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "mismatchReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "collectorId" TEXT NOT NULL,
    "collectionTypeId" TEXT NOT NULL,

    CONSTRAINT "DailyCollectionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCollectionEntry" (
    "id" TEXT NOT NULL,
    "status" "DailyCollectionEntryStatus" NOT NULL DEFAULT 'UNPAID',
    "amountExpected" DECIMAL(10,2) NOT NULL,
    "amountCollected" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "markedAt" TIMESTAMP(3),
    "markedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,

    CONSTRAINT "DailyCollectionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCollectionAuditLog" (
    "id" TEXT NOT NULL,
    "action" "DailyCollectionAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "collectorId" TEXT,
    "collectionTypeId" TEXT,

    CONSTRAINT "DailyCollectionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentBill" (
    "id" SERIAL NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "studentId" TEXT NOT NULL,
    "feeStructureId" INTEGER NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLineItem" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "studentBillId" INTEGER NOT NULL,
    "feeItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "checkoutUrl" TEXT,
    "providerSessionId" TEXT,
    "providerAuthorization" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payerEmail" TEXT,
    "payerName" TEXT,
    "lastError" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntentLine" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentIntentId" TEXT NOT NULL,
    "studentBillId" INTEGER NOT NULL,

    CONSTRAINT "PaymentIntentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidBy" TEXT NOT NULL,
    "referenceNo" TEXT,
    "externalProvider" "PaymentProvider",
    "externalReference" TEXT,
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "studentBillId" INTEGER NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCorrectionRequest" (
    "id" SERIAL NOT NULL,
    "type" "PaymentCorrectionType" NOT NULL,
    "requestedAction" "PaymentCorrectionRequestedAction" NOT NULL,
    "status" "PaymentCorrectionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reason" TEXT NOT NULL,
    "proposedChange" TEXT,
    "evidenceRef" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "originalPaymentId" INTEGER NOT NULL,
    "studentBillId" INTEGER NOT NULL,
    "correctedPaymentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReversal" (
    "id" SERIAL NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedBy" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "paymentId" INTEGER NOT NULL,

    CONSTRAINT "PaymentReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" SERIAL NOT NULL,
    "type" "DiscountType" NOT NULL,
    "status" "DiscountStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2),
    "percentage" DECIMAL(5,2),
    "approvedBy" TEXT NOT NULL,
    "removedBy" TEXT,
    "removeReason" TEXT,
    "removedAt" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',
    "studentBillId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "lastCounter" INTEGER NOT NULL DEFAULT 0,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAuditLog" (
    "id" SERIAL NOT NULL,
    "action" "AuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL DEFAULT 'default-school',

    CONSTRAINT "FinanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceQuery" (
    "id" SERIAL NOT NULL,
    "reason" "FinanceQueryReason" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FinanceQueryStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentBillId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJob" (
    "id" TEXT NOT NULL,
    "type" "FinanceJobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "FinanceJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "schoolId" TEXT,
    "paymentId" INTEGER,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WaitlistRole" NOT NULL,
    "message" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolInvite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SchoolInviteRole" NOT NULL DEFAULT 'ADMIN',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherInvite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "teacherType" "TeacherInviteType" NOT NULL,
    "staffId" TEXT,
    "employmentType" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "TeacherInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "acceptedTeacherId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentInvite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "ParentInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "acceptedParentId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentInviteStudent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentInviteStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentInviteAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "action" "ParentInviteAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentInviteAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BursarInvite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "staffId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "BursarInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "acceptedBursarId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BursarInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BursarInviteAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "action" "BursarInviteAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BursarInviteAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorInvite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "staffId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "CollectorInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "acceptedCollectorId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorInviteAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "action" "CollectorInviteAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectorInviteAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAccessAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT,
    "studentId" TEXT,
    "inviteId" TEXT,
    "relationshipId" TEXT,
    "action" "ParentAccessAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentAccessAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherInviteAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "action" "TeacherInviteAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherInviteAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingAuditLog" (
    "id" SERIAL NOT NULL,
    "schoolId" TEXT,
    "waitlistId" TEXT,
    "inviteId" TEXT,
    "action" "OnboardingAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationStagedUpload" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "areaKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "inventoryVersion" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "encryptedPayload" TEXT,
    "encryptedResult" TEXT,
    "status" "MigrationUploadStatus" NOT NULL DEFAULT 'VALIDATED',
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "MigrationStagedUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SubjectToTeacher" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SubjectToTeacher_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE INDEX "Admin_schoolId_idx" ON "Admin"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Bursar_username_key" ON "Bursar"("username");

-- CreateIndex
CREATE INDEX "Bursar_schoolId_idx" ON "Bursar"("schoolId");

-- CreateIndex
CREATE INDEX "Bursar_schoolId_status_idx" ON "Bursar"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Bursar_schoolId_createdAt_idx" ON "Bursar"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bursar_schoolId_email_key" ON "Bursar"("schoolId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Collector_username_key" ON "Collector"("username");

-- CreateIndex
CREATE INDEX "Collector_schoolId_idx" ON "Collector"("schoolId");

-- CreateIndex
CREATE INDEX "Collector_schoolId_status_idx" ON "Collector"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Collector_schoolId_createdAt_idx" ON "Collector"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Collector_schoolId_email_key" ON "Collector"("schoolId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_username_key" ON "Student"("username");

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE INDEX "Student_schoolId_classId_idx" ON "Student"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Student_parentId_idx" ON "Student"("parentId");

-- CreateIndex
CREATE INDEX "Student_schoolId_parentId_idx" ON "Student"("schoolId", "parentId");

-- CreateIndex
CREATE INDEX "Student_schoolId_createdAt_idx" ON "Student"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_username_key" ON "Teacher"("username");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_status_idx" ON "Teacher"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_createdAt_idx" ON "Teacher"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_username_key" ON "Parent"("username");

-- CreateIndex
CREATE INDEX "Parent_schoolId_idx" ON "Parent"("schoolId");

-- CreateIndex
CREATE INDEX "Parent_schoolId_createdAt_idx" ON "Parent"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentStudentRelationship_schoolId_parentId_status_idx" ON "ParentStudentRelationship"("schoolId", "parentId", "status");

-- CreateIndex
CREATE INDEX "ParentStudentRelationship_schoolId_studentId_status_idx" ON "ParentStudentRelationship"("schoolId", "studentId", "status");

-- CreateIndex
CREATE INDEX "ParentStudentRelationship_schoolId_status_updatedAt_idx" ON "ParentStudentRelationship"("schoolId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentRelationship_schoolId_parentId_studentId_key" ON "ParentStudentRelationship"("schoolId", "parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPaymentSetting_schoolId_key" ON "SchoolPaymentSetting"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolPaymentSetting_schoolId_onlinePaymentsEnabled_idx" ON "SchoolPaymentSetting"("schoolId", "onlinePaymentsEnabled");

-- CreateIndex
CREATE INDEX "SchoolPaymentSetting_provider_idx" ON "SchoolPaymentSetting"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolNotificationSetting_schoolId_key" ON "SchoolNotificationSetting"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AppNotificationSetting_schoolId_key" ON "AppNotificationSetting"("schoolId");

-- CreateIndex
CREATE INDEX "AppNotifPref_recipient_idx" ON "AppNotificationPreference"("schoolId", "recipientType", "recipientId");

-- CreateIndex
CREATE INDEX "AppNotifPref_role_updated_idx" ON "AppNotificationPreference"("schoolId", "recipientType", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppNotifPref_recipient_key" ON "AppNotificationPreference"("schoolId", "recipientType", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCommunicationPolicy_schoolId_key" ON "SchoolCommunicationPolicy"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolCommunicationRoute_schoolId_target_idx" ON "SchoolCommunicationRoute"("schoolId", "target");

-- CreateIndex
CREATE INDEX "SchoolCommunicationRoute_schoolId_selectedTeacherId_idx" ON "SchoolCommunicationRoute"("schoolId", "selectedTeacherId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCommunicationRoute_schoolId_category_key" ON "SchoolCommunicationRoute"("schoolId", "category");

-- CreateIndex
CREATE INDEX "SchoolPeriodTemplate_schoolId_type_isActive_idx" ON "SchoolPeriodTemplate"("schoolId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPeriodTemplate_schoolId_name_key" ON "SchoolPeriodTemplate"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPeriodTemplate_schoolId_order_key" ON "SchoolPeriodTemplate"("schoolId", "order");

-- CreateIndex
CREATE INDEX "TimetablePublication_schoolId_status_publishedAt_idx" ON "TimetablePublication"("schoolId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePublication_schoolId_version_key" ON "TimetablePublication"("schoolId", "version");

-- CreateIndex
CREATE INDEX "PublishedTimetableLesson_schoolId_publicationId_idx" ON "PublishedTimetableLesson"("schoolId", "publicationId");

-- CreateIndex
CREATE INDEX "PublishedTimetableLesson_schoolId_classId_day_idx" ON "PublishedTimetableLesson"("schoolId", "classId", "day");

-- CreateIndex
CREATE INDEX "PublishedTimetableLesson_schoolId_teacherId_day_idx" ON "PublishedTimetableLesson"("schoolId", "teacherId", "day");

-- CreateIndex
CREATE INDEX "PublishedTimetableLesson_schoolId_subjectId_idx" ON "PublishedTimetableLesson"("schoolId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedTimetableLesson_publicationId_sourceId_key" ON "PublishedTimetableLesson"("publicationId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAccountabilitySetting_schoolId_key" ON "TeacherAccountabilitySetting"("schoolId");

-- CreateIndex
CREATE INDEX "TeacherObligation_schoolId_teacherId_status_expectedAt_idx" ON "TeacherObligation"("schoolId", "teacherId", "status", "expectedAt");

-- CreateIndex
CREATE INDEX "TeacherObligation_schoolId_type_status_expectedAt_idx" ON "TeacherObligation"("schoolId", "type", "status", "expectedAt");

-- CreateIndex
CREATE INDEX "TeacherObligation_schoolId_status_expectedAt_idx" ON "TeacherObligation"("schoolId", "status", "expectedAt");

-- CreateIndex
CREATE INDEX "TeacherObligation_schoolId_sourceModel_sourceId_idx" ON "TeacherObligation"("schoolId", "sourceModel", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherObligation_schoolId_teacherId_sourceKey_key" ON "TeacherObligation"("schoolId", "teacherId", "sourceKey");

-- CreateIndex
CREATE INDEX "TeacherReminder_schoolId_obligationId_status_idx" ON "TeacherReminder"("schoolId", "obligationId", "status");

-- CreateIndex
CREATE INDEX "TeacherReminder_schoolId_teacherId_status_scheduledAt_idx" ON "TeacherReminder"("schoolId", "teacherId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "TeacherReminder_schoolId_status_scheduledAt_idx" ON "TeacherReminder"("schoolId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherReminder_schoolId_dedupeKey_key" ON "TeacherReminder"("schoolId", "dedupeKey");

-- CreateIndex
CREATE INDEX "TeacherEscalation_schoolId_teacherId_status_escalatedAt_idx" ON "TeacherEscalation"("schoolId", "teacherId", "status", "escalatedAt");

-- CreateIndex
CREATE INDEX "TeacherEscalation_schoolId_status_escalatedAt_idx" ON "TeacherEscalation"("schoolId", "status", "escalatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherEscalation_schoolId_obligationId_key" ON "TeacherEscalation"("schoolId", "obligationId");

-- CreateIndex
CREATE INDEX "TeacherCorrectionRequest_schoolId_status_createdAt_idx" ON "TeacherCorrectionRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherCorrectionRequest_schoolId_teacherId_status_createdA_idx" ON "TeacherCorrectionRequest"("schoolId", "teacherId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherCorrectionRequest_schoolId_sourceModel_sourceId_idx" ON "TeacherCorrectionRequest"("schoolId", "sourceModel", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherCorrectionRequest_schoolId_teacherId_sourceKey_field_key" ON "TeacherCorrectionRequest"("schoolId", "teacherId", "sourceKey", "fieldName");

-- CreateIndex
CREATE INDEX "TeacherAccountabilityAuditLog_schoolId_teacherId_createdAt_idx" ON "TeacherAccountabilityAuditLog"("schoolId", "teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherAccountabilityAuditLog_schoolId_action_createdAt_idx" ON "TeacherAccountabilityAuditLog"("schoolId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherAccountabilityAuditLog_schoolId_sourceModel_sourceId_idx" ON "TeacherAccountabilityAuditLog"("schoolId", "sourceModel", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentNotificationPreference_parentId_key" ON "ParentNotificationPreference"("parentId");

-- CreateIndex
CREATE INDEX "ParentNotificationPreference_schoolId_preferredChannel_idx" ON "ParentNotificationPreference"("schoolId", "preferredChannel");

-- CreateIndex
CREATE INDEX "ParentNotificationPreference_schoolId_dailySummaryEnabled_idx" ON "ParentNotificationPreference"("schoolId", "dailySummaryEnabled");

-- CreateIndex
CREATE INDEX "ParentNotificationPreference_schoolId_weeklySummaryEnabled_idx" ON "ParentNotificationPreference"("schoolId", "weeklySummaryEnabled");

-- CreateIndex
CREATE INDEX "AppNotif_recipient_read_created_idx" ON "AppNotification"("schoolId", "recipientType", "recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotif_recipient_created_idx" ON "AppNotification"("schoolId", "recipientType", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotif_category_created_idx" ON "AppNotification"("schoolId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotif_type_created_idx" ON "AppNotification"("schoolId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotif_source_idx" ON "AppNotification"("schoolId", "sourceModel", "sourceId");

-- CreateIndex
CREATE INDEX "AppNotif_expires_idx" ON "AppNotification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppNotif_id_school_key" ON "AppNotification"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AppNotif_school_idempotency_key" ON "AppNotification"("schoolId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AppNotifDelivery_worker_idx" ON "AppNotificationDelivery"("schoolId", "status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifDelivery_history_idx" ON "AppNotificationDelivery"("notificationId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifDelivery_provider_msg_idx" ON "AppNotificationDelivery"("schoolId", "provider", "providerMessageId");

-- CreateIndex
CREATE INDEX "AppNotifDelivery_failure_idx" ON "AppNotificationDelivery"("schoolId", "status", "failedAt");

-- CreateIndex
CREATE INDEX "AppNotifDelivery_channel_status_idx" ON "AppNotificationDelivery"("schoolId", "channel", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppNotifDelivery_once_per_destination" ON "AppNotificationDelivery"("notificationId", "channel", "destination");

-- CreateIndex
CREATE INDEX "AppNotifAudit_notification_idx" ON "AppNotificationAuditLog"("schoolId", "notificationId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifAudit_delivery_idx" ON "AppNotificationAuditLog"("schoolId", "deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifAudit_event_idx" ON "AppNotificationAuditLog"("schoolId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifAudit_channel_idx" ON "AppNotificationAuditLog"("schoolId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotifAudit_provider_msg_idx" ON "AppNotificationAuditLog"("schoolId", "provider", "providerMessageId");

-- CreateIndex
CREATE INDEX "ParentNotification_schoolId_parentId_readAt_occurredAt_idx" ON "ParentNotification"("schoolId", "parentId", "readAt", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentNotification_schoolId_parentId_type_occurredAt_idx" ON "ParentNotification"("schoolId", "parentId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentNotification_schoolId_studentId_occurredAt_idx" ON "ParentNotification"("schoolId", "studentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentNotification_schoolId_parentId_sourceKey_key" ON "ParentNotification"("schoolId", "parentId", "sourceKey");

-- CreateIndex
CREATE INDEX "ParentNotificationDeliveryLog_schoolId_status_attemptedAt_idx" ON "ParentNotificationDeliveryLog"("schoolId", "status", "attemptedAt");

-- CreateIndex
CREATE INDEX "ParentNotificationDeliveryLog_schoolId_parentId_attemptedAt_idx" ON "ParentNotificationDeliveryLog"("schoolId", "parentId", "attemptedAt");

-- CreateIndex
CREATE INDEX "ParentNotificationDeliveryLog_schoolId_channel_attemptedAt_idx" ON "ParentNotificationDeliveryLog"("schoolId", "channel", "attemptedAt");

-- CreateIndex
CREATE INDEX "ParentNotificationDeliveryLog_notificationId_idx" ON "ParentNotificationDeliveryLog"("notificationId");

-- CreateIndex
CREATE INDEX "ParentTeacherContactRequest_schoolId_parentId_status_create_idx" ON "ParentTeacherContactRequest"("schoolId", "parentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ParentTeacherContactRequest_schoolId_teacherId_status_respo_idx" ON "ParentTeacherContactRequest"("schoolId", "teacherId", "status", "responseDueAt");

-- CreateIndex
CREATE INDEX "ParentTeacherContactRequest_schoolId_studentId_createdAt_idx" ON "ParentTeacherContactRequest"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentTeacherContactRequest_schoolId_status_responseDueAt_idx" ON "ParentTeacherContactRequest"("schoolId", "status", "responseDueAt");

-- CreateIndex
CREATE INDEX "ParentTeacherContactMessage_schoolId_requestId_createdAt_idx" ON "ParentTeacherContactMessage"("schoolId", "requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentTeacherContactMessage_schoolId_teacherId_createdAt_idx" ON "ParentTeacherContactMessage"("schoolId", "teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentTeacherContactMessage_schoolId_parentId_createdAt_idx" ON "ParentTeacherContactMessage"("schoolId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentActivityEvent_schoolId_parentId_occurredAt_idx" ON "ParentActivityEvent"("schoolId", "parentId", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentActivityEvent_schoolId_studentId_occurredAt_idx" ON "ParentActivityEvent"("schoolId", "studentId", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentActivityEvent_schoolId_teacherId_occurredAt_idx" ON "ParentActivityEvent"("schoolId", "teacherId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentActivityEvent_schoolId_parentId_sourceKey_key" ON "ParentActivityEvent"("schoolId", "parentId", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_schoolId_level_key" ON "Grade"("schoolId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_schoolId_order_key" ON "Grade"("schoolId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Class_schoolId_name_key" ON "Class"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_name_key" ON "Subject"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Lesson_schoolId_teacherId_idx" ON "Lesson"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "Lesson_schoolId_classId_idx" ON "Lesson"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "Lesson_schoolId_periodTemplateId_idx" ON "Lesson"("schoolId", "periodTemplateId");

-- CreateIndex
CREATE INDEX "Lesson_teacherId_classId_day_idx" ON "Lesson"("teacherId", "classId", "day");

-- CreateIndex
CREATE INDEX "Lesson_schoolId_teacherId_classId_day_idx" ON "Lesson"("schoolId", "teacherId", "classId", "day");

-- CreateIndex
CREATE INDEX "Lesson_schoolId_day_idx" ON "Lesson"("schoolId", "day");

-- CreateIndex
CREATE INDEX "Exam_schoolId_startTime_idx" ON "Exam"("schoolId", "startTime");

-- CreateIndex
CREATE INDEX "Exam_schoolId_lessonId_idx" ON "Exam"("schoolId", "lessonId");

-- CreateIndex
CREATE INDEX "Assignment_schoolId_dueDate_idx" ON "Assignment"("schoolId", "dueDate");

-- CreateIndex
CREATE INDEX "Assignment_schoolId_lessonId_idx" ON "Assignment"("schoolId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_schoolId_lessonId_homeworkSequence_key" ON "Assignment"("schoolId", "lessonId", "homeworkSequence");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_studentId_status_idx" ON "HomeworkSubmission"("schoolId", "studentId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_assignmentId_status_idx" ON "HomeworkSubmission"("schoolId", "assignmentId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_checkedAt_idx" ON "HomeworkSubmission"("schoolId", "checkedAt");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_schoolId_checkedById_idx" ON "HomeworkSubmission"("schoolId", "checkedById");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_schoolId_assignmentId_studentId_key" ON "HomeworkSubmission"("schoolId", "assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "Result_schoolId_studentId_idx" ON "Result"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Result_schoolId_examId_idx" ON "Result"("schoolId", "examId");

-- CreateIndex
CREATE INDEX "Result_schoolId_assignmentId_idx" ON "Result"("schoolId", "assignmentId");

-- CreateIndex
CREATE INDEX "Result_schoolId_createdAt_idx" ON "Result"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_lessonId_date_idx" ON "Attendance"("schoolId", "lessonId", "date");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_date_status_idx" ON "Attendance"("schoolId", "date", "status");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_followUpStatus_date_idx" ON "Attendance"("schoolId", "followUpStatus", "date");

-- CreateIndex
CREATE INDEX "Attendance_studentId_date_status_idx" ON "Attendance"("studentId", "date", "status");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_studentId_date_idx" ON "Attendance"("schoolId", "studentId", "date");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_studentId_date_status_idx" ON "Attendance"("schoolId", "studentId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_schoolId_studentId_lessonId_date_key" ON "Attendance"("schoolId", "studentId", "lessonId", "date");

-- CreateIndex
CREATE INDEX "AttendanceAuditLog_schoolId_createdAt_idx" ON "AttendanceAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceAuditLog_schoolId_attendanceId_idx" ON "AttendanceAuditLog"("schoolId", "attendanceId");

-- CreateIndex
CREATE INDEX "AttendanceAuditLog_schoolId_studentId_createdAt_idx" ON "AttendanceAuditLog"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_schoolId_startTime_idx" ON "Event"("schoolId", "startTime");

-- CreateIndex
CREATE INDEX "Event_schoolId_classId_idx" ON "Event"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_date_idx" ON "Announcement"("schoolId", "date");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_classId_idx" ON "Announcement"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_priority_date_idx" ON "Announcement"("schoolId", "priority", "date");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_expiresAt_idx" ON "Announcement"("schoolId", "expiresAt");

-- CreateIndex
CREATE INDEX "CAConfig_schoolId_isActive_idx" ON "CAConfig"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CAConfig_schoolId_academicYear_key" ON "CAConfig"("schoolId", "academicYear");

-- CreateIndex
CREATE INDEX "CABucket_schoolId_classId_subjectId_term_academicYear_idx" ON "CABucket"("schoolId", "classId", "subjectId", "term", "academicYear");

-- CreateIndex
CREATE INDEX "CABucket_schoolId_createdBy_idx" ON "CABucket"("schoolId", "createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "CABucket_schoolId_classId_subjectId_term_academicYear_name_key" ON "CABucket"("schoolId", "classId", "subjectId", "term", "academicYear", "name");

-- CreateIndex
CREATE INDEX "CAActivity_schoolId_classId_subjectId_activityDate_idx" ON "CAActivity"("schoolId", "classId", "subjectId", "activityDate");

-- CreateIndex
CREATE INDEX "CAActivity_schoolId_teacherId_activityDate_idx" ON "CAActivity"("schoolId", "teacherId", "activityDate");

-- CreateIndex
CREATE INDEX "CAActivity_schoolId_bucketId_idx" ON "CAActivity"("schoolId", "bucketId");

-- CreateIndex
CREATE UNIQUE INDEX "CAActivity_bucketId_type_sequence_key" ON "CAActivity"("bucketId", "type", "sequence");

-- CreateIndex
CREATE INDEX "CAActivityScore_schoolId_studentId_idx" ON "CAActivityScore"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "CAActivityScore_schoolId_activityId_idx" ON "CAActivityScore"("schoolId", "activityId");

-- CreateIndex
CREATE INDEX "CAActivityScore_schoolId_recordedBy_updatedAt_idx" ON "CAActivityScore"("schoolId", "recordedBy", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CAActivityScore_activityId_studentId_key" ON "CAActivityScore"("activityId", "studentId");

-- CreateIndex
CREATE INDEX "CAAuditLog_schoolId_createdAt_idx" ON "CAAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "CAAuditLog_schoolId_actorId_createdAt_idx" ON "CAAuditLog"("schoolId", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "CAAuditLog_schoolId_entityType_entityId_idx" ON "CAAuditLog"("schoolId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ContinuousAssessment_schoolId_studentId_idx" ON "ContinuousAssessment"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "ContinuousAssessment_schoolId_classId_term_academicYear_idx" ON "ContinuousAssessment"("schoolId", "classId", "term", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuousAssessment_schoolId_studentId_subjectId_classId_t_key" ON "ContinuousAssessment"("schoolId", "studentId", "subjectId", "classId", "term", "academicYear");

-- CreateIndex
CREATE INDEX "ReportCardPublication_schoolId_status_publishedAt_idx" ON "ReportCardPublication"("schoolId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "ReportCardPublication_schoolId_classId_status_idx" ON "ReportCardPublication"("schoolId", "classId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardPublication_schoolId_classId_term_academicYear_key" ON "ReportCardPublication"("schoolId", "classId", "term", "academicYear");

-- CreateIndex
CREATE INDEX "ExamEntryWindow_schoolId_classId_status_idx" ON "ExamEntryWindow"("schoolId", "classId", "status");

-- CreateIndex
CREATE INDEX "ExamEntryWindow_schoolId_status_updatedAt_idx" ON "ExamEntryWindow"("schoolId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamEntryWindow_schoolId_classId_term_academicYear_key" ON "ExamEntryWindow"("schoolId", "classId", "term", "academicYear");

-- CreateIndex
CREATE INDEX "Syllabus_schoolId_status_idx" ON "Syllabus"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Syllabus_schoolId_gradeId_term_academicYear_idx" ON "Syllabus"("schoolId", "gradeId", "term", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Syllabus_schoolId_subjectId_gradeId_term_academicYear_key" ON "Syllabus"("schoolId", "subjectId", "gradeId", "term", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusTopicProgress_schoolId_syllabusTopicId_classId_key" ON "SyllabusTopicProgress"("schoolId", "syllabusTopicId", "classId");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_status_idx" ON "FeeStructure"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_schoolId_gradeId_term_academicYear_key" ON "FeeStructure"("schoolId", "gradeId", "term", "academicYear");

-- CreateIndex
CREATE INDEX "FeeItem_feeStructureId_billingFrequency_idx" ON "FeeItem"("feeStructureId", "billingFrequency");

-- CreateIndex
CREATE INDEX "DailyCollectionType_schoolId_isActive_idx" ON "DailyCollectionType"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "DailyCollectionType_schoolId_category_idx" ON "DailyCollectionType"("schoolId", "category");

-- CreateIndex
CREATE INDEX "DailyCollectionType_schoolId_createdAt_idx" ON "DailyCollectionType"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCollectionType_schoolId_name_key" ON "DailyCollectionType"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCollectionType_schoolId_normalizedName_key" ON "DailyCollectionType"("schoolId", "normalizedName");

-- CreateIndex
CREATE INDEX "DailyCollectionTypeCollector_schoolId_collectorId_idx" ON "DailyCollectionTypeCollector"("schoolId", "collectorId");

-- CreateIndex
CREATE INDEX "DailyCollectionTypeCollector_schoolId_collectionTypeId_idx" ON "DailyCollectionTypeCollector"("schoolId", "collectionTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCollectionTypeCollector_collectorId_collectionTypeId_key" ON "DailyCollectionTypeCollector"("collectorId", "collectionTypeId");

-- CreateIndex
CREATE INDEX "DailyCollectionSession_schoolId_status_collectionDate_idx" ON "DailyCollectionSession"("schoolId", "status", "collectionDate");

-- CreateIndex
CREATE INDEX "DailyCollectionSession_schoolId_collectorId_collectionDate_idx" ON "DailyCollectionSession"("schoolId", "collectorId", "collectionDate");

-- CreateIndex
CREATE INDEX "DailyCollectionSession_schoolId_collectionTypeId_collection_idx" ON "DailyCollectionSession"("schoolId", "collectionTypeId", "collectionDate");

-- CreateIndex
CREATE INDEX "DailyCollectionSession_schoolId_createdAt_idx" ON "DailyCollectionSession"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCollectionSession_schoolId_collectionTypeId_collectorI_key" ON "DailyCollectionSession"("schoolId", "collectionTypeId", "collectorId", "collectionDate");

-- CreateIndex
CREATE INDEX "DailyCollectionEntry_schoolId_sessionId_idx" ON "DailyCollectionEntry"("schoolId", "sessionId");

-- CreateIndex
CREATE INDEX "DailyCollectionEntry_schoolId_studentId_idx" ON "DailyCollectionEntry"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "DailyCollectionEntry_schoolId_collectorId_createdAt_idx" ON "DailyCollectionEntry"("schoolId", "collectorId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyCollectionEntry_schoolId_status_createdAt_idx" ON "DailyCollectionEntry"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCollectionEntry_sessionId_studentId_key" ON "DailyCollectionEntry"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "DailyCollectionAuditLog_schoolId_createdAt_idx" ON "DailyCollectionAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyCollectionAuditLog_schoolId_action_createdAt_idx" ON "DailyCollectionAuditLog"("schoolId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "DailyCollectionAuditLog_schoolId_collectorId_createdAt_idx" ON "DailyCollectionAuditLog"("schoolId", "collectorId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyCollectionAuditLog_schoolId_collectionTypeId_createdAt_idx" ON "DailyCollectionAuditLog"("schoolId", "collectionTypeId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentBill_schoolId_status_idx" ON "StudentBill"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StudentBill_schoolId_dueDate_idx" ON "StudentBill"("schoolId", "dueDate");

-- CreateIndex
CREATE INDEX "StudentBill_schoolId_feeStructureId_idx" ON "StudentBill"("schoolId", "feeStructureId");

-- CreateIndex
CREATE INDEX "StudentBill_schoolId_studentId_idx" ON "StudentBill"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "StudentBill_schoolId_status_studentId_idx" ON "StudentBill"("schoolId", "status", "studentId");

-- CreateIndex
CREATE INDEX "StudentBill_schoolId_status_feeStructureId_idx" ON "StudentBill"("schoolId", "status", "feeStructureId");

-- CreateIndex
CREATE INDEX "StudentBill_feeStructureId_idx" ON "StudentBill"("feeStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBill_schoolId_studentId_feeStructureId_key" ON "StudentBill"("schoolId", "studentId", "feeStructureId");

-- CreateIndex
CREATE INDEX "PaymentIntent_schoolId_parentId_status_createdAt_idx" ON "PaymentIntent"("schoolId", "parentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_schoolId_studentId_status_createdAt_idx" ON "PaymentIntent"("schoolId", "studentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_schoolId_status_expiresAt_idx" ON "PaymentIntent"("schoolId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_provider_providerSessionId_idx" ON "PaymentIntent"("provider", "providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_schoolId_reference_key" ON "PaymentIntent"("schoolId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_schoolId_idempotencyKey_key" ON "PaymentIntent"("schoolId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentIntentLine_studentBillId_idx" ON "PaymentIntentLine"("studentBillId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntentLine_paymentIntentId_studentBillId_key" ON "PaymentIntentLine"("paymentIntentId", "studentBillId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_paymentDate_idx" ON "Payment"("schoolId", "paymentDate");

-- CreateIndex
CREATE INDEX "Payment_schoolId_status_idx" ON "Payment"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Payment_schoolId_paymentDate_status_idx" ON "Payment"("schoolId", "paymentDate", "status");

-- CreateIndex
CREATE INDEX "Payment_schoolId_externalProvider_idx" ON "Payment"("schoolId", "externalProvider");

-- CreateIndex
CREATE INDEX "Payment_studentBillId_idx" ON "Payment"("studentBillId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_schoolId_receiptNumber_key" ON "Payment"("schoolId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_schoolId_externalProvider_externalReference_key" ON "Payment"("schoolId", "externalProvider", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_schoolId_idempotencyKey_key" ON "Payment"("schoolId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentCorrectionRequest_schoolId_status_requestedAt_idx" ON "PaymentCorrectionRequest"("schoolId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "PaymentCorrectionRequest_schoolId_requestedBy_requestedAt_idx" ON "PaymentCorrectionRequest"("schoolId", "requestedBy", "requestedAt");

-- CreateIndex
CREATE INDEX "PaymentCorrectionRequest_schoolId_originalPaymentId_idx" ON "PaymentCorrectionRequest"("schoolId", "originalPaymentId");

-- CreateIndex
CREATE INDEX "PaymentCorrectionRequest_schoolId_studentBillId_idx" ON "PaymentCorrectionRequest"("schoolId", "studentBillId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReversal_paymentId_key" ON "PaymentReversal"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentReversal_schoolId_reversedAt_idx" ON "PaymentReversal"("schoolId", "reversedAt");

-- CreateIndex
CREATE INDEX "Discount_schoolId_status_createdAt_idx" ON "Discount"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Discount_schoolId_studentBillId_status_idx" ON "Discount"("schoolId", "studentBillId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptCounter_schoolId_year_key" ON "ReceiptCounter"("schoolId", "year");

-- CreateIndex
CREATE INDEX "FinanceAuditLog_schoolId_createdAt_idx" ON "FinanceAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceAuditLog_schoolId_action_idx" ON "FinanceAuditLog"("schoolId", "action");

-- CreateIndex
CREATE INDEX "FinanceQuery_schoolId_status_createdAt_idx" ON "FinanceQuery"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceQuery_schoolId_parentId_createdAt_idx" ON "FinanceQuery"("schoolId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceQuery_schoolId_studentBillId_status_idx" ON "FinanceQuery"("schoolId", "studentBillId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceJob_idempotencyKey_key" ON "FinanceJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceJob_schoolId_status_runAfter_idx" ON "FinanceJob"("schoolId", "status", "runAfter");

-- CreateIndex
CREATE INDEX "FinanceJob_type_status_idx" ON "FinanceJob"("type", "status");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_schoolId_status_receivedAt_idx" ON "PaymentWebhookEvent"("schoolId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_provider_status_idx" ON "PaymentWebhookEvent"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_createdAt_idx" ON "WaitlistEntry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolInvite_tokenHash_key" ON "SchoolInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "SchoolInvite_schoolId_email_idx" ON "SchoolInvite"("schoolId", "email");

-- CreateIndex
CREATE INDEX "SchoolInvite_schoolId_revokedAt_idx" ON "SchoolInvite"("schoolId", "revokedAt");

-- CreateIndex
CREATE INDEX "SchoolInvite_expiresAt_idx" ON "SchoolInvite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInvite_tokenHash_key" ON "TeacherInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "TeacherInvite_schoolId_email_idx" ON "TeacherInvite"("schoolId", "email");

-- CreateIndex
CREATE INDEX "TeacherInvite_schoolId_status_expiresAt_idx" ON "TeacherInvite"("schoolId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "TeacherInvite_schoolId_teacherType_idx" ON "TeacherInvite"("schoolId", "teacherType");

-- CreateIndex
CREATE INDEX "TeacherInvite_schoolId_createdAt_idx" ON "TeacherInvite"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInvite_expiresAt_idx" ON "TeacherInvite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentInvite_tokenHash_key" ON "ParentInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ParentInvite_schoolId_email_idx" ON "ParentInvite"("schoolId", "email");

-- CreateIndex
CREATE INDEX "ParentInvite_schoolId_status_expiresAt_idx" ON "ParentInvite"("schoolId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ParentInvite_schoolId_createdAt_idx" ON "ParentInvite"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentInvite_expiresAt_idx" ON "ParentInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "ParentInviteStudent_schoolId_inviteId_idx" ON "ParentInviteStudent"("schoolId", "inviteId");

-- CreateIndex
CREATE INDEX "ParentInviteStudent_schoolId_studentId_idx" ON "ParentInviteStudent"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentInviteStudent_inviteId_studentId_key" ON "ParentInviteStudent"("inviteId", "studentId");

-- CreateIndex
CREATE INDEX "ParentInviteAuditLog_schoolId_createdAt_idx" ON "ParentInviteAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentInviteAuditLog_inviteId_createdAt_idx" ON "ParentInviteAuditLog"("inviteId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentInviteAuditLog_schoolId_action_createdAt_idx" ON "ParentInviteAuditLog"("schoolId", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BursarInvite_tokenHash_key" ON "BursarInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "BursarInvite_schoolId_email_idx" ON "BursarInvite"("schoolId", "email");

-- CreateIndex
CREATE INDEX "BursarInvite_schoolId_status_expiresAt_idx" ON "BursarInvite"("schoolId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "BursarInvite_schoolId_createdAt_idx" ON "BursarInvite"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "BursarInvite_expiresAt_idx" ON "BursarInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "BursarInviteAuditLog_schoolId_createdAt_idx" ON "BursarInviteAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "BursarInviteAuditLog_inviteId_createdAt_idx" ON "BursarInviteAuditLog"("inviteId", "createdAt");

-- CreateIndex
CREATE INDEX "BursarInviteAuditLog_schoolId_action_createdAt_idx" ON "BursarInviteAuditLog"("schoolId", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectorInvite_tokenHash_key" ON "CollectorInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CollectorInvite_schoolId_email_idx" ON "CollectorInvite"("schoolId", "email");

-- CreateIndex
CREATE INDEX "CollectorInvite_schoolId_status_expiresAt_idx" ON "CollectorInvite"("schoolId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "CollectorInvite_schoolId_createdAt_idx" ON "CollectorInvite"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectorInvite_expiresAt_idx" ON "CollectorInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "CollectorInviteAuditLog_schoolId_createdAt_idx" ON "CollectorInviteAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectorInviteAuditLog_inviteId_createdAt_idx" ON "CollectorInviteAuditLog"("inviteId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectorInviteAuditLog_schoolId_action_createdAt_idx" ON "CollectorInviteAuditLog"("schoolId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAccessAuditLog_schoolId_createdAt_idx" ON "ParentAccessAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAccessAuditLog_schoolId_parentId_createdAt_idx" ON "ParentAccessAuditLog"("schoolId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAccessAuditLog_schoolId_studentId_createdAt_idx" ON "ParentAccessAuditLog"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAccessAuditLog_schoolId_action_createdAt_idx" ON "ParentAccessAuditLog"("schoolId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAccessAuditLog_relationshipId_createdAt_idx" ON "ParentAccessAuditLog"("relationshipId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAccessAuditLog_inviteId_createdAt_idx" ON "ParentAccessAuditLog"("inviteId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInviteAuditLog_schoolId_createdAt_idx" ON "TeacherInviteAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInviteAuditLog_inviteId_createdAt_idx" ON "TeacherInviteAuditLog"("inviteId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInviteAuditLog_schoolId_action_createdAt_idx" ON "TeacherInviteAuditLog"("schoolId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingAuditLog_schoolId_createdAt_idx" ON "OnboardingAuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingAuditLog_action_createdAt_idx" ON "OnboardingAuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationStagedUpload_batchId_key" ON "MigrationStagedUpload"("batchId");

-- CreateIndex
CREATE INDEX "MigrationStagedUpload_schoolId_createdAt_idx" ON "MigrationStagedUpload"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "MigrationStagedUpload_status_expiresAt_idx" ON "MigrationStagedUpload"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "_SubjectToTeacher_B_index" ON "_SubjectToTeacher"("B");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bursar" ADD CONSTRAINT "Bursar_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collector" ADD CONSTRAINT "Collector_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentRelationship" ADD CONSTRAINT "ParentStudentRelationship_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentRelationship" ADD CONSTRAINT "ParentStudentRelationship_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentRelationship" ADD CONSTRAINT "ParentStudentRelationship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPaymentSetting" ADD CONSTRAINT "SchoolPaymentSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolNotificationSetting" ADD CONSTRAINT "SchoolNotificationSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationSetting" ADD CONSTRAINT "AppNotificationSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationPreference" ADD CONSTRAINT "AppNotificationPreference_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCommunicationPolicy" ADD CONSTRAINT "SchoolCommunicationPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCommunicationRoute" ADD CONSTRAINT "SchoolCommunicationRoute_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCommunicationRoute" ADD CONSTRAINT "SchoolCommunicationRoute_selectedTeacherId_fkey" FOREIGN KEY ("selectedTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPeriodTemplate" ADD CONSTRAINT "SchoolPeriodTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetablePublication" ADD CONSTRAINT "TimetablePublication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedTimetableLesson" ADD CONSTRAINT "PublishedTimetableLesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedTimetableLesson" ADD CONSTRAINT "PublishedTimetableLesson_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "TimetablePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAccountabilitySetting" ADD CONSTRAINT "TeacherAccountabilitySetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherObligation" ADD CONSTRAINT "TeacherObligation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherObligation" ADD CONSTRAINT "TeacherObligation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReminder" ADD CONSTRAINT "TeacherReminder_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReminder" ADD CONSTRAINT "TeacherReminder_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReminder" ADD CONSTRAINT "TeacherReminder_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "TeacherObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEscalation" ADD CONSTRAINT "TeacherEscalation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEscalation" ADD CONSTRAINT "TeacherEscalation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEscalation" ADD CONSTRAINT "TeacherEscalation_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "TeacherObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCorrectionRequest" ADD CONSTRAINT "TeacherCorrectionRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCorrectionRequest" ADD CONSTRAINT "TeacherCorrectionRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAccountabilityAuditLog" ADD CONSTRAINT "TeacherAccountabilityAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAccountabilityAuditLog" ADD CONSTRAINT "TeacherAccountabilityAuditLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotificationPreference" ADD CONSTRAINT "ParentNotificationPreference_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotificationPreference" ADD CONSTRAINT "ParentNotificationPreference_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotificationDelivery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationDelivery" ADD CONSTRAINT "AppNotificationDelivery_notificationId_schoolId_fkey" FOREIGN KEY ("notificationId", "schoolId") REFERENCES "AppNotification"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationAuditLog" ADD CONSTRAINT "AppNotificationAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationAuditLog" ADD CONSTRAINT "AppNotificationAuditLog_notificationId_schoolId_fkey" FOREIGN KEY ("notificationId", "schoolId") REFERENCES "AppNotification"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotificationAuditLog" ADD CONSTRAINT "AppNotificationAuditLog_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "AppNotificationDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotification" ADD CONSTRAINT "ParentNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotification" ADD CONSTRAINT "ParentNotification_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotification" ADD CONSTRAINT "ParentNotification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotificationDeliveryLog" ADD CONSTRAINT "ParentNotificationDeliveryLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotificationDeliveryLog" ADD CONSTRAINT "ParentNotificationDeliveryLog_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentNotificationDeliveryLog" ADD CONSTRAINT "ParentNotificationDeliveryLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "ParentNotification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactRequest" ADD CONSTRAINT "ParentTeacherContactRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactRequest" ADD CONSTRAINT "ParentTeacherContactRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactRequest" ADD CONSTRAINT "ParentTeacherContactRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactRequest" ADD CONSTRAINT "ParentTeacherContactRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactMessage" ADD CONSTRAINT "ParentTeacherContactMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactMessage" ADD CONSTRAINT "ParentTeacherContactMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ParentTeacherContactRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactMessage" ADD CONSTRAINT "ParentTeacherContactMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactMessage" ADD CONSTRAINT "ParentTeacherContactMessage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherContactMessage" ADD CONSTRAINT "ParentTeacherContactMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentActivityEvent" ADD CONSTRAINT "ParentActivityEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentActivityEvent" ADD CONSTRAINT "ParentActivityEvent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentActivityEvent" ADD CONSTRAINT "ParentActivityEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentActivityEvent" ADD CONSTRAINT "ParentActivityEvent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_periodTemplateId_fkey" FOREIGN KEY ("periodTemplateId") REFERENCES "SchoolPeriodTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAConfig" ADD CONSTRAINT "CAConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CABucket" ADD CONSTRAINT "CABucket_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CABucket" ADD CONSTRAINT "CABucket_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CABucket" ADD CONSTRAINT "CABucket_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CABucket" ADD CONSTRAINT "CABucket_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivity" ADD CONSTRAINT "CAActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivity" ADD CONSTRAINT "CAActivity_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "CABucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivity" ADD CONSTRAINT "CAActivity_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivity" ADD CONSTRAINT "CAActivity_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivity" ADD CONSTRAINT "CAActivity_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivityScore" ADD CONSTRAINT "CAActivityScore_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivityScore" ADD CONSTRAINT "CAActivityScore_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CAActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivityScore" ADD CONSTRAINT "CAActivityScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAActivityScore" ADD CONSTRAINT "CAActivityScore_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAAuditLog" ADD CONSTRAINT "CAAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuousAssessment" ADD CONSTRAINT "ContinuousAssessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuousAssessment" ADD CONSTRAINT "ContinuousAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuousAssessment" ADD CONSTRAINT "ContinuousAssessment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuousAssessment" ADD CONSTRAINT "ContinuousAssessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuousAssessment" ADD CONSTRAINT "ContinuousAssessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardPublication" ADD CONSTRAINT "ReportCardPublication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardPublication" ADD CONSTRAINT "ReportCardPublication_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEntryWindow" ADD CONSTRAINT "ExamEntryWindow_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEntryWindow" ADD CONSTRAINT "ExamEntryWindow_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "Syllabus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopicProgress" ADD CONSTRAINT "SyllabusTopicProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopicProgress" ADD CONSTRAINT "SyllabusTopicProgress_syllabusTopicId_fkey" FOREIGN KEY ("syllabusTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopicProgress" ADD CONSTRAINT "SyllabusTopicProgress_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopicProgress" ADD CONSTRAINT "SyllabusTopicProgress_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeItem" ADD CONSTRAINT "FeeItem_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionType" ADD CONSTRAINT "DailyCollectionType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionTypeCollector" ADD CONSTRAINT "DailyCollectionTypeCollector_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionTypeCollector" ADD CONSTRAINT "DailyCollectionTypeCollector_collectionTypeId_fkey" FOREIGN KEY ("collectionTypeId") REFERENCES "DailyCollectionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionSession" ADD CONSTRAINT "DailyCollectionSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionSession" ADD CONSTRAINT "DailyCollectionSession_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionSession" ADD CONSTRAINT "DailyCollectionSession_collectionTypeId_fkey" FOREIGN KEY ("collectionTypeId") REFERENCES "DailyCollectionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionEntry" ADD CONSTRAINT "DailyCollectionEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionEntry" ADD CONSTRAINT "DailyCollectionEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DailyCollectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionEntry" ADD CONSTRAINT "DailyCollectionEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionEntry" ADD CONSTRAINT "DailyCollectionEntry_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionAuditLog" ADD CONSTRAINT "DailyCollectionAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionAuditLog" ADD CONSTRAINT "DailyCollectionAuditLog_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCollectionAuditLog" ADD CONSTRAINT "DailyCollectionAuditLog_collectionTypeId_fkey" FOREIGN KEY ("collectionTypeId") REFERENCES "DailyCollectionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBill" ADD CONSTRAINT "StudentBill_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBill" ADD CONSTRAINT "StudentBill_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBill" ADD CONSTRAINT "StudentBill_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLineItem" ADD CONSTRAINT "BillLineItem_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLineItem" ADD CONSTRAINT "BillLineItem_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "FeeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntentLine" ADD CONSTRAINT "PaymentIntentLine_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntentLine" ADD CONSTRAINT "PaymentIntentLine_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrectionRequest" ADD CONSTRAINT "PaymentCorrectionRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrectionRequest" ADD CONSTRAINT "PaymentCorrectionRequest_originalPaymentId_fkey" FOREIGN KEY ("originalPaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrectionRequest" ADD CONSTRAINT "PaymentCorrectionRequest_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrectionRequest" ADD CONSTRAINT "PaymentCorrectionRequest_correctedPaymentId_fkey" FOREIGN KEY ("correctedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReversal" ADD CONSTRAINT "PaymentReversal_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptCounter" ADD CONSTRAINT "ReceiptCounter_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAuditLog" ADD CONSTRAINT "FinanceAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuery" ADD CONSTRAINT "FinanceQuery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuery" ADD CONSTRAINT "FinanceQuery_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuery" ADD CONSTRAINT "FinanceQuery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuery" ADD CONSTRAINT "FinanceQuery_studentBillId_fkey" FOREIGN KEY ("studentBillId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceQuery" ADD CONSTRAINT "FinanceQuery_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJob" ADD CONSTRAINT "FinanceJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolInvite" ADD CONSTRAINT "SchoolInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInvite" ADD CONSTRAINT "TeacherInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInvite" ADD CONSTRAINT "TeacherInvite_acceptedTeacherId_fkey" FOREIGN KEY ("acceptedTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInvite" ADD CONSTRAINT "ParentInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInvite" ADD CONSTRAINT "ParentInvite_acceptedParentId_fkey" FOREIGN KEY ("acceptedParentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInviteStudent" ADD CONSTRAINT "ParentInviteStudent_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ParentInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInviteStudent" ADD CONSTRAINT "ParentInviteStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInviteAuditLog" ADD CONSTRAINT "ParentInviteAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentInviteAuditLog" ADD CONSTRAINT "ParentInviteAuditLog_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ParentInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BursarInvite" ADD CONSTRAINT "BursarInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BursarInvite" ADD CONSTRAINT "BursarInvite_acceptedBursarId_fkey" FOREIGN KEY ("acceptedBursarId") REFERENCES "Bursar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BursarInviteAuditLog" ADD CONSTRAINT "BursarInviteAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BursarInviteAuditLog" ADD CONSTRAINT "BursarInviteAuditLog_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "BursarInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorInvite" ADD CONSTRAINT "CollectorInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorInvite" ADD CONSTRAINT "CollectorInvite_acceptedCollectorId_fkey" FOREIGN KEY ("acceptedCollectorId") REFERENCES "Collector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorInviteAuditLog" ADD CONSTRAINT "CollectorInviteAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorInviteAuditLog" ADD CONSTRAINT "CollectorInviteAuditLog_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "CollectorInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ParentInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAccessAuditLog" ADD CONSTRAINT "ParentAccessAuditLog_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "ParentStudentRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInviteAuditLog" ADD CONSTRAINT "TeacherInviteAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInviteAuditLog" ADD CONSTRAINT "TeacherInviteAuditLog_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "TeacherInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAuditLog" ADD CONSTRAINT "OnboardingAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationStagedUpload" ADD CONSTRAINT "MigrationStagedUpload_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubjectToTeacher" ADD CONSTRAINT "_SubjectToTeacher_A_fkey" FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubjectToTeacher" ADD CONSTRAINT "_SubjectToTeacher_B_fkey" FOREIGN KEY ("B") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Database-only safeguards recovered from the immutable legacy migration history.
ALTER TABLE public."AppNotification" ADD CONSTRAINT "AppNotif_idempotency_not_blank_chk" CHECK ((("idempotencyKey" IS NULL) OR (length(btrim("idempotencyKey")) > 0)));
ALTER TABLE public."AppNotificationDelivery" ADD CONSTRAINT "AppNotifDelivery_attempts_nonnegative_chk" CHECK ((attempts >= 0));
ALTER TABLE public."AppNotificationDelivery" ADD CONSTRAINT "AppNotifDelivery_destination_not_blank_chk" CHECK ((length(btrim(destination)) > 0));
ALTER TABLE public."AppNotificationDelivery" ADD CONSTRAINT "AppNotifDelivery_provider_msg_not_blank_chk" CHECK ((("providerMessageId" IS NULL) OR (length(btrim("providerMessageId")) > 0)));
ALTER TABLE public."AppNotificationDelivery" ADD CONSTRAINT "AppNotifDelivery_terminal_timestamp_chk" CHECK ((((status <> 'DELIVERED'::"AppNotificationDeliveryStatus") OR ("deliveredAt" IS NOT NULL)) AND ((status <> 'FAILED'::"AppNotificationDeliveryStatus") OR ("failedAt" IS NOT NULL)) AND ((status <> 'SENT'::"AppNotificationDeliveryStatus") OR ("sentAt" IS NOT NULL))));
ALTER TABLE public."AppNotificationPreference" ADD CONSTRAINT "AppNotifPref_quiet_end_format_chk" CHECK ((("quietHoursEnd" IS NULL) OR ("quietHoursEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)));
ALTER TABLE public."AppNotificationPreference" ADD CONSTRAINT "AppNotifPref_quiet_start_format_chk" CHECK ((("quietHoursStart" IS NULL) OR ("quietHoursStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)));
ALTER TABLE public."AppNotificationPreference" ADD CONSTRAINT "AppNotifPref_recipient_not_blank_chk" CHECK ((length(btrim("recipientId")) > 0));
ALTER TABLE public."AppNotificationSetting" ADD CONSTRAINT "AppNotifSetting_quiet_end_format_chk" CHECK (("quietHoursEnd" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text));
ALTER TABLE public."AppNotificationSetting" ADD CONSTRAINT "AppNotifSetting_quiet_start_format_chk" CHECK (("quietHoursStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text));
ALTER TABLE public."AppNotificationSetting" ADD CONSTRAINT "AppNotifSetting_timezone_not_blank_chk" CHECK ((length(btrim(timezone)) > 0));
ALTER TABLE public."CAActivity" ADD CONSTRAINT "CAActivity_allocationMarks_positive_or_null" CHECK ((("allocationMarks" IS NULL) OR ("allocationMarks" > (0)::numeric)));
ALTER TABLE public."CAActivity" ADD CONSTRAINT "CAActivity_rawMaxScore_positive" CHECK (("rawMaxScore" > (0)::numeric));
ALTER TABLE public."CAActivityScore" ADD CONSTRAINT "CAActivityScore_normalizedContribution_nonnegative" CHECK (("normalizedContribution" >= (0)::numeric));
ALTER TABLE public."CAActivityScore" ADD CONSTRAINT "CAActivityScore_rawScore_nonnegative" CHECK (("rawScore" >= (0)::numeric));
ALTER TABLE public."CABucket" ADD CONSTRAINT "CABucket_allocationMarks_positive" CHECK (("allocationMarks" > (0)::numeric));
ALTER TABLE public."MigrationStagedUpload" ADD CONSTRAINT "MigrationStagedUpload_byteSize_check" CHECK ((("byteSize" > 0) AND ("byteSize" <= 1000000)));
ALTER TABLE public."MigrationStagedUpload" ADD CONSTRAINT "MigrationStagedUpload_rowCount_check" CHECK ((("rowCount" > 0) AND ("rowCount" <= 2000)));
CREATE UNIQUE INDEX "ContinuousAssessment_studentId_subjectId_classId_term_acade_key" ON public."ContinuousAssessment" USING btree ("studentId", "subjectId", "classId", term, "academicYear");
CREATE UNIQUE INDEX "Payment_school_method_reference_active_unique" ON public."Payment" USING btree ("schoolId", "paymentMethod", lower("referenceNo")) WHERE (("referenceNo" IS NOT NULL) AND (status = ANY (ARRAY['PENDING'::"PaymentStatus", 'CONFIRMED'::"PaymentStatus"])));
CREATE UNIQUE INDEX "PaymentCorrectionRequest_one_open_per_payment" ON public."PaymentCorrectionRequest" USING btree ("schoolId", "originalPaymentId") WHERE (status = ANY (ARRAY['PENDING_REVIEW'::"PaymentCorrectionStatus", 'APPROVED'::"PaymentCorrectionStatus"]));
CREATE INDEX "ReportCardPublication_schoolId_status_submittedAt_idx" ON public."ReportCardPublication" USING btree ("schoolId", status, "submittedAt");
CREATE INDEX "ReportCardPublication_schoolId_submittedBy_status_idx" ON public."ReportCardPublication" USING btree ("schoolId", "submittedBy", status);

COMMIT;
