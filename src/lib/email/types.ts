/**
 * Shared types for email template CMS settings (F32).
 * Used by: EmailTemplateSettings collection, lookup API, template renderer.
 */

export type EmailRecipient = 'buyer' | 'seller'

export const EMAIL_TEMPLATE_TYPES = [
  'welcome',
  'otp-verification',
  'forgot-password',
  'password-changed',
  'order-confirmation',
  'order-status',
  'order-cancelled',
  'order-shipped',
  'order-expired',
  'new-order-seller',
  'bank-transfer-instructions',
  'payment-confirmed',
  'payment-rejected',
  'resend-upload-link',
  'staff-invitation',
] as const

export type EmailTemplateType = typeof EMAIL_TEMPLATE_TYPES[number]

export interface EmailTemplateConfig {
  enabled: boolean
  subject?: string
  greeting?: string
  ctaLabel?: string
  closing?: string
}

/**
 * Maps each template type to the recipient(s) it applies to.
 * Used for UI tab gating and seeding default rows.
 */
export const EMAIL_TEMPLATE_RECIPIENTS: Record<EmailTemplateType, EmailRecipient[]> = {
  'welcome':                   ['buyer'],
  'otp-verification':          ['buyer'],
  'forgot-password':           ['buyer'],
  'password-changed':          ['buyer'],
  'order-confirmation':        ['buyer'],
  'order-status':              ['buyer'],
  'order-cancelled':           ['buyer'],
  'order-shipped':             ['buyer'],
  'order-expired':             ['buyer'],
  'new-order-seller':          ['seller'],
  'bank-transfer-instructions': ['buyer'],
  'payment-confirmed':         ['buyer'],
  'payment-rejected':          ['buyer'],
  'resend-upload-link':        ['buyer'],
  'staff-invitation':          ['buyer', 'seller'],
}

/**
 * Maps each template type to the available {varName} placeholder names.
 * Used to render hint text in the CMS editor so admins know what variables
 * they can embed in subject/greeting/ctaLabel/closing fields.
 */
export const EMAIL_TEMPLATE_VARIABLES: Record<EmailTemplateType, string[]> = {
  'welcome': [
    'userName', 'brandName', 'dashboardUrl', 'supportEmail',
  ],
  'otp-verification': [
    'userName', 'otpCode', 'brandName', 'supportEmail',
  ],
  'forgot-password': [
    'userName', 'resetLink', 'brandName', 'supportEmail',
  ],
  'password-changed': [
    'userName', 'brandName', 'supportEmail',
  ],
  'order-confirmation': [
    'customerName', 'orderNumber', 'orderTotal', 'brandName',
    'dashboardUrl', 'supportEmail',
  ],
  'order-status': [
    'customerName', 'orderNumber', 'orderStatus', 'brandName',
    'dashboardUrl', 'supportEmail',
  ],
  'order-cancelled': [
    'customerName', 'orderNumber', 'orderTotal', 'brandName',
    'supportEmail',
  ],
  'order-shipped': [
    'customerName', 'orderNumber', 'trackingNumber', 'brandName',
    'supportEmail',
  ],
  'order-expired': [
    'customerName', 'orderNumber', 'brandName', 'supportEmail',
  ],
  'new-order-seller': [
    'orderNumber', 'orderTotal', 'brandName', 'dashboardUrl',
  ],
  'bank-transfer-instructions': [
    'customerName', 'orderNumber', 'orderTotal', 'bankName',
    'bankAccountNo', 'bankAccountHolder', 'brandName', 'supportEmail',
  ],
  'payment-confirmed': [
    'customerName', 'orderNumber', 'orderTotal', 'brandName',
    'dashboardUrl', 'supportEmail',
  ],
  'payment-rejected': [
    'customerName', 'orderNumber', 'rejectionReason', 'brandName',
    'supportEmail',
  ],
  'resend-upload-link': [
    'customerName', 'uploadLink', 'brandName', 'supportEmail',
  ],
  'staff-invitation': [
    'inviteeName', 'inviterName', 'brandName', 'dashboardUrl',
    'supportEmail',
  ],
}
