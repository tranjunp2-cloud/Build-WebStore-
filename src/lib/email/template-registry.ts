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
  orderShippedEmail,
  orderExpiredEmail,
  newOrderSellerEmail,
  bankTransferInstructionsEmail,
  paymentConfirmedEmail,
  paymentRejectedEmail,
  staffInvitationEmail,
  orderRefundedEmail,
} from './templates'

export type TemplateFn = (
  fixture: Record<string, unknown>,
  config?: EmailTemplateConfig,
) => { subject: string; html: string }

export const templateRegistry: Record<EmailTemplateType, TemplateFn> = {
  'welcome': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    welcomeEmail(fixture as any, config),

  'otp-verification': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    otpVerificationEmail(fixture as any, config),

  'forgot-password': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    forgotPasswordEmail(fixture as any, config),

  'password-changed': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    passwordChangedEmail(fixture as any, config),

  'order-confirmation': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderConfirmationEmail(fixture as any, config),

  'order-cancelled': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderCancelledEmail(fixture as any, config),

  'order-shipped': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderShippedEmail(fixture as any, config),

  'order-expired': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderExpiredEmail(fixture as any, config),

  'new-order-seller': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newOrderSellerEmail(fixture as any, config),

  'bank-transfer-instructions': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bankTransferInstructionsEmail(fixture as any, config),

  'payment-confirmed': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentConfirmedEmail(fixture as any, config),

  'payment-rejected': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentRejectedEmail(fixture as any, config),

  'staff-invitation': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    staffInvitationEmail(fixture as any, config),

  'order-refunded': (fixture, config) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderRefundedEmail(fixture as any, config),
}
