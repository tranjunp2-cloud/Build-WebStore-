/**
 * Email templates barrel export.
 */
export { welcomeEmail, type EmailLocale } from './welcome'
export { forgotPasswordEmail } from './forgot-password'
export { orderConfirmationEmail } from './order-confirmation'
export { orderStatusEmail } from './order-status'
export { otpVerificationEmail } from './otp-verification'
export { passwordChangedEmail } from './password-changed'
export {
    bankTransferInstructionsEmail,
    type BankTransferInstructionsData,
} from './bank-transfer-instructions'
export { paymentConfirmedEmail, type PaymentConfirmedData } from './payment-confirmed'
export {
    paymentRejectedEmail,
    type PaymentRejectedData,
    type RejectionReason,
} from './payment-rejected'
export { orderExpiredEmail, type OrderExpiredData } from './order-expired'
export { newOrderSellerEmail, type NewOrderSellerData } from './new-order-seller'
export { orderCancelledEmail, type OrderCancelledData } from './order-cancelled'
export { orderCompletedEmail, type OrderCompletedData } from './order-completed'
export { resendUploadLinkEmail } from './resend-upload-link'
export { staffInvitationEmail, type EmailLocale as StaffEmailLocale } from './staff-invitation'
export type { EmailTemplateConfig } from '../types'
export { orderRefundedEmail, type OrderRefundedData } from './order-refunded'
export { contactFromSellerEmail, type ContactFromSellerData } from './contact-from-seller'
export { newsletterSellerDigestEmail, type NewsletterSellerDigestData } from './newsletter-seller-digest'
