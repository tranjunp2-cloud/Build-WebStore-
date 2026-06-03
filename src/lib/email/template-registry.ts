/**
 * Template registry for F32 email preview.
 * Maps each EmailTemplateType to a render fn: (fixture, config?) => { subject, html }.
 * Used by /api/email-preview to render previews without DB writes or email sends.
 */

import type { EmailTemplateType, EmailTemplateConfig } from './types'
import {
  welcomeEmail,
  otpVerificationEmail,
  forgotPasswordEmail,
  passwordChangedEmail,
  orderConfirmationEmail,
  orderCancelledEmail,
  orderCompletedEmail,
  orderExpiredEmail,
  newOrderSellerEmail,
  bankTransferInstructionsEmail,
  paymentConfirmedEmail,
  paymentRejectedEmail,
  staffInvitationEmail,
  orderRefundedEmail,
  contactFromSellerEmail,
  newsletterSellerDigestEmail,
} from './templates'

export type TemplateFn = (
  fixture: Record<string, unknown>,
  config?: EmailTemplateConfig,
) => { subject: string; html: string }

export const templateRegistry: Record<EmailTemplateType, TemplateFn> = {
  'welcome': (fixture, config) =>
    welcomeEmail(fixture as any, config),

  'otp-verification': (fixture, config) =>
    otpVerificationEmail(fixture as any, config),

  'forgot-password': (fixture, config) =>
    forgotPasswordEmail(fixture as any, config),

  'password-changed': (fixture, config) =>
    passwordChangedEmail(fixture as any, config),

  'order-confirmation': (fixture, config) =>
    orderConfirmationEmail(fixture as any, config),

  'order-completed': (fixture, config) =>
    orderCompletedEmail(fixture as any, config),

  'order-cancelled': (fixture, config) =>
    orderCancelledEmail(fixture as any, config),

  'order-expired': (fixture, config) =>
    orderExpiredEmail(fixture as any, config),

  'new-order-seller': (fixture, config) =>
    newOrderSellerEmail(fixture as any, config),

  'bank-transfer-instructions': (fixture, config) =>
    bankTransferInstructionsEmail(fixture as any, config),

  'payment-confirmed': (fixture, config) =>
    paymentConfirmedEmail(fixture as any, config),

  'payment-rejected': (fixture, config) =>
    paymentRejectedEmail(fixture as any, config),

  'staff-invitation': (fixture, config) =>
    staffInvitationEmail(fixture as any, config),

  'order-refunded': (fixture, config) =>
    orderRefundedEmail(fixture as any, config),

  'contact-from-seller': (fixture, config) =>
    contactFromSellerEmail(fixture as any, config),

  'newsletter-seller-digest': (fixture, config) =>
    newsletterSellerDigestEmail(fixture as any, config),
}
