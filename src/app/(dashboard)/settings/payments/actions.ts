"use server";

import { getPayload } from 'payload';
import config from '@payload-config';
import { getCurrentTenantId, getCurrentUser } from '@/lib/auth';
import { canReadPayoutAccount, maskAccountNumber, withoutPayoutAccount } from '@/lib/payment/payout-account-access';
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription';
import type { PlanCode } from '@/collections/PlanSubscriptions';
import { deauthorizeStripeAccount } from '@/lib/payment/stripe';
import { xenditFetch, XenditError } from '@/lib/payment/xendit-client'
import { setCallbackUrl } from '@/lib/payment/xendit';
import { XENDIT_ENABLED } from '@/lib/payment/xendit-visibility';
import { IMPERSONATION_FORBIDDEN, isMerchantAccessSessionFromHeaders } from '@/lib/support/merchant-access-session';
import { withTenantRowLock } from '@/lib/payload/tenant-row-lock';

export type PaymentUpdates = {
    payment_cod?: boolean;
    payment_qr?: boolean;
    qr_image?: string | number | null;
    payment_card?: boolean;
    payment_fpx?: boolean;
    account_holder_name?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
};

type PaymentMedia = {
    id: string | number;
    url?: string | null;
    thumbnailURL?: string | null;
    filename?: string | null;
};

export type SavedPaymentSettings = Omit<PaymentUpdates, 'qr_image'> & {
    payment_cod: boolean;
    payment_qr: boolean;
    payment_card: boolean;
    payment_fpx: boolean;
    qr_image: string | number | PaymentMedia | null;
    account_holder_name: string | null;
    bank_name: string | null;
    account_number: string | null;
    /** True when the caller may not read or change the payout account (not owner / admin). */
    bankHidden?: boolean;
    /** `•••• 1234` of the saved account number, sent only with `bankHidden`. */
    account_number_masked?: string | null;
};

export type UpdatePaymentSettingsResult =
    | { success: true; payments: SavedPaymentSettings }
    | { success: false; error: string };

function editablePaymentSettings(value: unknown): SavedPaymentSettings {
    const payments = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    const rawQrImage = payments.qr_image;
    let qrImage: SavedPaymentSettings['qr_image'] = null;
    if (typeof rawQrImage === 'string' || typeof rawQrImage === 'number') {
        qrImage = rawQrImage;
    } else if (rawQrImage && typeof rawQrImage === 'object' && !Array.isArray(rawQrImage)) {
        const media = rawQrImage as Record<string, unknown>;
        if (typeof media.id === 'string' || typeof media.id === 'number') {
            qrImage = {
                id: media.id,
                ...(typeof media.url === 'string' ? { url: media.url } : {}),
                ...(typeof media.thumbnailURL === 'string' ? { thumbnailURL: media.thumbnailURL } : {}),
                ...(typeof media.filename === 'string' ? { filename: media.filename } : {}),
            };
        }
    }

    return {
        payment_cod: payments.payment_cod === true,
        payment_qr: payments.payment_qr === true,
        payment_card: payments.payment_card === true,
        payment_fpx: payments.payment_fpx === true,
        qr_image: qrImage,
        account_holder_name: typeof payments.account_holder_name === 'string' ? payments.account_holder_name : null,
        bank_name: typeof payments.bank_name === 'string' ? payments.bank_name : null,
        account_number: typeof payments.account_number === 'string' ? payments.account_number : null,
    };
}

/**
 * What a member who may not read the payout account gets instead of it: a flag so the form skips the bank
 * checks and never sends bank fields, plus the masked number so they can tell an account is set
 * (TC-PERF-175).
 */
function hiddenPayoutAccount<T extends object>(payments: T): T & { bankHidden: true; account_number_masked: string | null } {
    const raw = payments as Record<string, unknown>;
    return {
        ...withoutPayoutAccount(payments),
        bankHidden: true,
        account_number_masked: maskAccountNumber(raw.account_number),
    };
}

/**
 * Fields only an owner / admin may change: the payout account, and the payment QR image, which redirects
 * buyer payments just like a new account number (TC-PERF-176, TC-PERF-179).
 */
const PAYOUT_ACCOUNT_UPDATE_KEYS = ['account_holder_name', 'bank_name', 'account_number', 'qr_image'] as const;
const PAYOUT_OWNER_ONLY_ERROR = 'Only the shop owner or an admin can change bank details and the payment QR.';

/**
 * Payout-account rights for the current caller. Inside a merchant-access session (support acting as the
 * merchant) there are none, whatever the merchant's own role: support can never read or move the payout
 * destination (TC-F15.39). Detected from every token on the request, not only the one getCurrentUser picked.
 */
async function hasPayoutRights(tenantId: unknown): Promise<boolean> {
    if (await isMerchantAccessSessionFromHeaders()) return false;
    return canReadPayoutAccount(await getCurrentUser(), tenantId);
}

/** Error for a blocked payout write: the impersonation code in a support session, else the role message. */
async function payoutDeniedError(): Promise<string> {
    return (await isMerchantAccessSessionFromHeaders()) ? IMPERSONATION_FORBIDDEN : PAYOUT_OWNER_ONLY_ERROR;
}

export async function getPaymentSettings() {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' };
        }

        const tenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
        });
        const payments = tenant.payments || {};

        // The payout account is for owners / admins only (TC-PERF-151, TC-PERF-175).
        return {
            success: true,
            payments: await hasPayoutRights(tenantId)
                ? payments
                : hiddenPayoutAccount(payments),
        };
    } catch (error: unknown) {
        console.error("Failed to get payment settings via action:", error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function updatePaymentSettings(updates: PaymentUpdates): Promise<UpdatePaymentSettingsResult> {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' };
        }

        // Only owners / admins may change the payout account or the QR image; other members with settings access
        // can still toggle methods (TC-PERF-176, TC-PERF-179). Checked on the server, not just hidden in the form.
        const canEditPayoutAccount = await hasPayoutRights(tenantId);
        if (!canEditPayoutAccount && PAYOUT_ACCOUNT_UPDATE_KEYS.some((key) => updates[key] !== undefined)) {
            return { success: false, error: await payoutDeniedError() };
        }

        const sub = await getActivePlanSubscription(payload, tenantId);
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'payment_integration')) {
            return { success: false, error: 'Payment integration is not available on your current plan.' };
        }

        // Whitelist and validate fields, then send nested under payments group
        const paymentsData: Record<string, any> = {}

        if (updates.payment_cod !== undefined) {
            if (typeof updates.payment_cod === 'boolean') {
                paymentsData.payment_cod = updates.payment_cod;
            } else {
                return { success: false, error: 'Invalid type for payment_cod. Expected boolean.' };
            }
        }

        if (updates.payment_qr !== undefined) {
            if (typeof updates.payment_qr === 'boolean') {
                paymentsData.payment_qr = updates.payment_qr;
            } else {
                return { success: false, error: 'Invalid type for payment_qr. Expected boolean.' };
            }
        }

        if (updates.qr_image !== undefined) {
            if (updates.qr_image !== null) {
                // Verify the media was uploaded by this tenant (alt field tagged at upload time)
                const media = await payload.findByID({ collection: 'media', id: updates.qr_image as string });
                if (!media || (media as any).alt !== `qr-${tenantId}`) {
                    return { success: false, error: 'Invalid media: not uploaded by this tenant.' };
                }
            }
            paymentsData.qr_image = updates.qr_image;
        }

        if (updates.payment_card !== undefined) {
            if (typeof updates.payment_card === 'boolean') {
                paymentsData.payment_card = updates.payment_card;
            } else {
                return { success: false, error: 'Invalid type for payment_card. Expected boolean.' };
            }
        }

        if (updates.payment_fpx !== undefined) {
            if (typeof updates.payment_fpx === 'boolean') {
                paymentsData.payment_fpx = updates.payment_fpx;
            } else {
                return { success: false, error: 'Invalid type for payment_fpx. Expected boolean.' };
            }
        }

        if (updates.account_holder_name !== undefined) {
            if (updates.account_holder_name === null) {
                paymentsData.account_holder_name = null;
            } else if (typeof updates.account_holder_name === 'string' && updates.account_holder_name.length <= 150) {
                paymentsData.account_holder_name = updates.account_holder_name;
            } else {
                return { success: false, error: 'Invalid account_holder_name: must be string, max 150 chars.' };
            }
        }

        if (updates.bank_name !== undefined) {
            if (updates.bank_name === null) {
                paymentsData.bank_name = null;
            } else if (typeof updates.bank_name === 'string' && updates.bank_name.length <= 100) {
                paymentsData.bank_name = updates.bank_name;
            } else {
                return { success: false, error: 'Invalid bank_name: must be string, max 100 chars.' };
            }
        }

        if (updates.account_number !== undefined) {
            if (updates.account_number === null) {
                paymentsData.account_number = null;
            } else if (typeof updates.account_number === 'string' && updates.account_number.length <= 50) {
                paymentsData.account_number = updates.account_number;
            } else {
                return { success: false, error: 'Invalid account_number: must be string, max 50 chars.' };
            }
        }

        if (Object.keys(paymentsData).length === 0) {
            return { success: false, error: 'No valid payment fields provided' };
        }

        return await withTenantRowLock(payload, tenantId, async (req) => {
            // The row lock keeps the read/validate/write sequence atomic across tabs.
            const currentTenant = await payload.findByID({ collection: 'tenants', id: tenantId, req });
            const currentPayments = (currentTenant as { payments?: Record<string, unknown> }).payments || {};
            const effective = {
                payment_cod: currentPayments.payment_cod === true,
                payment_qr: currentPayments.payment_qr === true,
                payment_card: currentPayments.payment_card === true,
                payment_fpx: currentPayments.payment_fpx === true,
                ...paymentsData,
            };
            const effectiveQrImage = paymentsData.qr_image !== undefined
                ? paymentsData.qr_image
                : currentPayments.qr_image;
            if (paymentsData.qr_image === null || (effective.payment_qr && !effectiveQrImage)) {
                effective.payment_qr = false;
            }
            const stripeReady = (currentTenant as { stripeOnboardingComplete?: boolean }).stripeOnboardingComplete === true;
            if (paymentsData.payment_card === true && !stripeReady) effective.payment_card = false;
            if (paymentsData.payment_fpx === true && !stripeReady) effective.payment_fpx = false;
            if (!effective.payment_cod && !effective.payment_qr && !effective.payment_card && !effective.payment_fpx) {
                return { success: false, error: 'At least one payment method must remain active.' } as const;
            }
            // A member who can't see the bank fields can't fill them in, so they may only turn bank transfer on
            // once the owner has saved a holder name and account number.
            if (!canEditPayoutAccount && paymentsData.payment_qr === true
                && (!currentPayments.account_holder_name || !currentPayments.account_number)) {
                return { success: false, error: 'Ask the shop owner or an admin to add the payout bank account first.' } as const;
            }

            const updatedTenant = await payload.update({
                collection: 'tenants',
                id: tenantId,
                data: { payments: paymentsData } as any,
                req,
            });

            const saved = editablePaymentSettings((updatedTenant as { payments?: unknown }).payments);
            return {
                success: true,
                // The save reply must not hand the payout account back to a member who can't read it (TC-PERF-176).
                payments: canEditPayoutAccount
                    ? saved
                    : {
                        ...hiddenPayoutAccount(saved),
                        account_holder_name: null,
                        bank_name: null,
                        account_number: null,
                    },
            } as const;
        });
    } catch (error: unknown) {
        console.error("Failed to update payment settings via action:", error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function uploadQrMedia(formData: FormData) {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant session found.' };
        }
        // The upload only exists to become the payment QR, which is owner / admin only (TC-PERF-179).
        if (!(await hasPayoutRights(tenantId))) {
            return { success: false, error: await payoutDeniedError() };
        }

        const file = formData.get('file') as File;
        if (!file) return { success: false, error: 'No file provided' };

        // Server-side validation
        if (file.size > 2 * 1024 * 1024) {
            return { success: false, error: 'File size exceeds 2MB limit.' };
        }
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            return { success: false, error: 'Only JPEG and PNG images are allowed.' };
        }

        // Convert the File to a Buffer for Payload CMS local API
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const media = await payload.create({
            collection: 'media',
            data: {
                // Embed tenantId in alt to enable ownership verification in updatePaymentSettings
                alt: `qr-${tenantId}`,
                tenant: /^\d+$/.test(String(tenantId)) ? Number(tenantId) : tenantId,
            },
            file: {
                data: buffer,
                name: file.name,
                size: file.size,
                mimetype: file.type,
            }
        });

        return { success: true, doc: media };
    } catch (error: unknown) {
        console.error("Media upload action error:", error);
        return { success: false, error: 'Internal server error' };
    }
}

// Model C: save merchant's own Xendit API keys
export async function saveXenditKeys(secretKey: string, callbackToken: string) {
    if (await isMerchantAccessSessionFromHeaders()) return { success: false, error: IMPERSONATION_FORBIDDEN };
    // GH-2132: UI is hidden; block direct server-action calls too. disconnectXendit stays allowed (only removes keys).
    if (!XENDIT_ENABLED) return { success: false, error: 'Xendit is not available.' };

    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) return { success: false, error: 'Unauthorized' };
        if (!secretKey || !callbackToken) return { success: false, error: 'Both Secret Key and Callback Token are required.' };
        if (!secretKey.startsWith('xnd_')) return { success: false, error: 'Invalid Secret Key format. Must start with xnd_' };
        if (secretKey.length > 512 || callbackToken.length > 512) return { success: false, error: 'Key length exceeds maximum allowed.' };

        const sub = await getActivePlanSubscription(payload, tenantId);
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'payment_integration')) {
            return { success: false, error: 'Payment integration is not available on your current plan.' };
        }

        // Permission check using the same Invoice API endpoint called during actual checkout.
        // Xendit enforces permissions on /v2/invoices before body validation:
        //   401 = invalid key → hard block
        //   403 = missing Money-in permission → hard block
        //   400/422/other = key valid + has permission, Xendit rejected the minimal test payload → proceed
        try {
            await xenditFetch('/v2/invoices', {
                method: 'POST',
                body: { external_id: '_perm_check', amount: -1 },
                apiKey: secretKey.trim(),
            });
        } catch (err: unknown) {
            if (err instanceof XenditError) {
                if (err.status === 401) {
                    return { success: false, error: 'xenditInvalidSecretKey' }
                }
                if (err.status === 403) {
                    return { success: false, error: 'xenditMissingPermission' }
                }
                // 400/422/other = key valid + has permission, minimal payload rejected as expected → proceed
            }
            // Network or unexpected error → proceed silently
        }

        // POST /callback_urls/invoice registers ECH as webhook receiver and returns callback_token
        // (= merchant's Webhook Verification Token). Comparing it against user input catches wrong
        // tokens before they silently break payment webhooks.
        // XENDIT_WEBHOOK_URL overrides NEXT_PUBLIC_SERVER_URL in local dev (ngrok/Cloudflare tunnel).
        const baseUrl = (process.env.XENDIT_WEBHOOK_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')
        const webhookUrl = `${baseUrl}/api/webhooks/xendit`
        try {
            const cbResult = await setCallbackUrl('invoice', webhookUrl, secretKey.trim())
            if (cbResult.callback_token !== callbackToken.trim()) {
                return { success: false, error: 'xenditTokenMismatch' }
            }
        } catch (cbErr: unknown) {
            const xenditMsg = cbErr instanceof Error ? cbErr.message : String(cbErr)
            console.error('[saveXenditKeys] setCallbackUrl failed:', xenditMsg, '| url:', webhookUrl)
            const isUrlError = xenditMsg.includes('URL_NOT_VALID')
            return { success: false, error: isUrlError ? 'xenditWebhookUrlInvalid' : 'xenditWebhookRegisterFailed' }
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { xenditSecretKey: secretKey.trim(), xenditCallbackToken: callbackToken.trim() } as any,
            overrideAccess: true,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('saveXenditKeys error:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function disconnectXendit() {
    if (await isMerchantAccessSessionFromHeaders()) return { success: false, error: IMPERSONATION_FORBIDDEN };
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) return { success: false, error: 'Unauthorized' };

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                xenditSecretKey: null,
                xenditCallbackToken: null,
            } as any,
            overrideAccess: true,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('disconnectXendit error:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function disconnectStripe() {
    if (await isMerchantAccessSessionFromHeaders()) return { success: false, error: IMPERSONATION_FORBIDDEN };
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized' };
        }

        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId });
        const accountId = (tenant as any).stripeAccountId as string | null;

        if (accountId) {
            try {
                await deauthorizeStripeAccount(accountId);
            } catch (err) {
                // Non-fatal: revoke best-effort; still clear our DB record
                console.error('Stripe deauthorize failed (continuing disconnect):', err);
            }
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                stripeAccountId: null,
                stripeOnboardingComplete: false,
                payments: { payment_card: false, payment_fpx: false },
            } as any,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('Disconnect Stripe error:', error);
        return { success: false, error: 'Internal server error' };
    }
}
