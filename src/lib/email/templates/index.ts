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
