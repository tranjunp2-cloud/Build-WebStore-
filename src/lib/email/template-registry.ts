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
} from './templates'

function placeholderTemplate(_fixture: Record<string, unknown>, _config?: EmailTemplateConfig): { subject: string; html: string } {
  return {
    subject: 'Template coming soon',
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;color:#374151;"><h2>Template coming soon</h2><p>This email template is not yet configured.</p></body></html>`,
  }
}

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

  'contact-from-seller': placeholderTemplate,

  'newsletter-seller-digest': placeholderTemplate,
}
