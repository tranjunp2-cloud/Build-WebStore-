/**
 * Shared types for email template CMS settings (F32).
 * Used by: EmailTemplateSettings collection, lookup API, template renderer.
 */

export type EmailRecipient = 'buyer' | 'seller'

export const EMAIL_TEMPLATE_TYPES = [
  // Account & Security
  'welcome',
  'otp-verification',
  'forgot-password',
  'password-changed',
  // Order Flow
  'order-confirmation',
  'order-completed',
  'order-cancelled',
  'order-expired',
  'order-refunded',
  // Payment
  'bank-transfer-instructions',
  'payment-confirmed',
  'payment-rejected',
  // Operations
  'new-order-seller',
  // Team
  'staff-invitation',
  // Seller Communications
  'contact-from-seller',
  'newsletter-seller-digest',
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
  // Account & Security
  'welcome':                    ['seller'],
  'otp-verification':           ['seller'],
  'forgot-password':            ['seller'],
  'password-changed':           ['seller'],
  // Order Flow
  'order-confirmation':         ['buyer'],
  'order-completed':            ['buyer'],
  'order-cancelled':            ['buyer'],
  'order-expired':              ['buyer'],
  'order-refunded':             ['buyer'],
  // Payment
  'bank-transfer-instructions': ['buyer'],
  'payment-confirmed':          ['buyer'],
  'payment-rejected':           ['buyer'],
  // Operations
  'new-order-seller':           ['seller'],
  // Team
  'staff-invitation':           ['seller'],
  // Seller Communications
  'contact-from-seller':        ['seller'],
  'newsletter-seller-digest':   ['seller'],
}

/**
 * Maps each template type to the available {varName} placeholder names.
 * Used to render hint text in the CMS editor so admins know what variables
 * they can embed in subject/greeting/ctaLabel/closing fields.
 */
export const EMAIL_TEMPLATE_VARIABLES: Record<EmailTemplateType, string[]> = {
  // Account & Security
  'welcome':                    ['userName', 'brandName', 'dashboardUrl', 'supportEmail'],
  'otp-verification':           ['userName', 'otpCode', 'brandName', 'supportEmail'],
  'forgot-password':            ['userName', 'resetLink', 'brandName', 'supportEmail'],
  'password-changed':           ['userName', 'brandName', 'supportEmail'],
  // Order Flow
  'order-confirmation':         ['customerName', 'orderNumber', 'orderTotal', 'brandName', 'dashboardUrl', 'supportEmail'],
  'order-completed':            ['customerName', 'orderNumber', 'orderTotal', 'brandName', 'dashboardUrl', 'supportEmail'],
  'order-cancelled':            ['customerName', 'orderNumber', 'orderTotal', 'brandName', 'supportEmail'],
  'order-expired':              ['customerName', 'orderNumber', 'brandName', 'supportEmail'],
  'order-refunded':             ['customerName', 'orderNumber', 'refundAmount', 'brandName', 'supportEmail'],
  // Payment
  'bank-transfer-instructions': ['customerName', 'orderNumber', 'orderTotal', 'bankName', 'bankAccountNo', 'bankAccountHolder', 'brandName', 'supportEmail'],
  'payment-confirmed':          ['customerName', 'orderNumber', 'orderTotal', 'brandName', 'dashboardUrl', 'supportEmail'],
  'payment-rejected':           ['customerName', 'orderNumber', 'rejectionReason', 'brandName', 'supportEmail'],
  // Operations
  'new-order-seller':           ['orderNumber', 'orderTotal', 'brandName', 'dashboardUrl'],
  // Team
  'staff-invitation':           ['inviteeName', 'inviterName', 'brandName', 'dashboardUrl', 'supportEmail'],
  // Seller Communications
  'contact-from-seller':        ['sellerName', 'brandName', 'dashboardUrl', 'visitorName', 'visitorEmail'],
  'newsletter-seller-digest':   ['sellerName', 'brandName', 'dashboardUrl', 'subscriberEmail'],
}
